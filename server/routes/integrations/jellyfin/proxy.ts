/**
 * Jellyfin Proxy Routes
 * 
 * Handles proxying requests to Jellyfin server:
 * - /Items/:itemId/Images/* - Proxy item images
 * - /Sessions - Get active sessions (for direct access)
 * 
 * All HTTP requests flow through the adapter for centralized auth + reauth.
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';

const router = Router();
const adapter = getPlugin('jellyfin')!.adapter;

/**
 * GET /:id/proxy/* - Wildcard route for Jellyfin API paths
 * 
 * Handles:
 * - /Items/:itemId/Images/Primary
 * - /Items/:itemId/Images/Backdrop
 * - /Items/:itemId/Images/Thumb
 * - /Sessions
 */
router.get('/:id/proxy/*', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const path = '/' + (req.params[0] || '');

    // Check if this is a Jellyfin integration - if not, pass to next router
    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'jellyfin') {
        next();
        return;
    }

    // Check if this is an image request
    const isImagePath = path.includes('/Images/');

    if (!isImagePath) {
        // For non-image paths, just 404 - real-time uses WebSocket
        res.status(404).json({ error: 'Not found' });
        return;
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.apiKey) {
        res.status(400).json({ error: 'Invalid Jellyfin configuration' });
        return;
    }

    try {
        const response = await adapter.get!(instance, path, {
            responseType: 'arraybuffer',
            timeout: 15000,
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=14400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Jellyfin Proxy] Image error: path="${path}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

/**
 * POST /:id/proxy/stop - Stop a Jellyfin playback session (ADMIN ONLY)
 * 
 * Sends a stop command to the Jellyfin session via:
 *   POST /Sessions/{sessionId}/Playing/Stop
 */
router.post('/:id/proxy/stop', requireAuth, async (req: Request, res: Response): Promise<void> => {
    if (req.user!.group !== 'admin') {
        res.status(403).json({ error: 'Admin access required to stop sessions' });
        return;
    }

    const { id } = req.params;
    const { sessionKey } = req.body;

    if (!sessionKey) {
        res.status(400).json({ error: 'Session key required' });
        return;
    }

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'jellyfin') {
        res.status(404).json({ error: 'Jellyfin integration not found' });
        return;
    }

    const instance = toPluginInstance(dbInstance);
    const apiKey = instance.config.apiKey as string;

    if (!instance.config.url || !apiKey) {
        res.status(400).json({ error: 'Invalid Jellyfin configuration' });
        return;
    }

    try {
        const stopPath = `/Sessions/${sessionKey}/Playing/Stop`;
        // Full MediaBrowser header gives Jellyfin a session context to route the command.
        // Without Client/Device/DeviceId, Jellyfin accepts the request but can't dispatch it.
        const stopHeaders = {
            'Authorization': `MediaBrowser Client="Framerr", Device="Server", DeviceId="framerr-server", Version="0.1.5", Token="${apiKey}"`
        };

        logger.info(`[Jellyfin Proxy] Sending stop command: sessionId=${sessionKey}`);

        // Jellyfin's stop is a client command via WebSocket — the first attempt
        // is often ignored by clients. Send twice with a delay for reliability.
        await adapter.post!(instance, stopPath, {}, { headers: stopHeaders, timeout: 10000 });

        // Wait 750ms then send again
        await new Promise(resolve => setTimeout(resolve, 750));
        try {
            await adapter.post!(instance, stopPath, {}, { headers: stopHeaders, timeout: 10000 });
        } catch {
            // Second attempt may fail if session already ended — that's fine
        }

        logger.info(`[Jellyfin Proxy] Session termination request sent: sessionId=${sessionKey}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Jellyfin Proxy] Stop session failed: sessionId=${sessionKey}, error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to stop playback' });
    }
});

export default router;
