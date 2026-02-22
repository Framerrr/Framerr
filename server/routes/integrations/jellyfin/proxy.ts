/**
 * Jellyfin Proxy Routes
 * 
 * Handles proxying requests to Jellyfin server:
 * - /Items/:itemId/Images/* - Proxy item images
 * - /Sessions - Get active sessions (for direct access)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';

const router = Router();

/**
 * GET /:id/proxy/* - Wildcard route for Jellyfin API paths
 * 
 * Handles:
 * - /Items/:itemId/Images/Primary
 * - /Items/:itemId/Images/Backdrop
 * - /Items/:itemId/Images/Thumb
 * - /Sessions
 */
router.get('/:id/proxy/*', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const path = '/' + (req.params[0] || '');

    // Check if this is a Jellyfin integration - if not, pass to next router
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'jellyfin') {
        next();
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Jellyfin configuration' });
        return;
    }

    // Check if this is an image request
    const isImagePath = path.includes('/Images/');

    if (!isImagePath) {
        // For non-image paths, just 404 - real-time uses WebSocket
        res.status(404).json({ error: 'Not found' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        // Jellyfin uses api_key query param
        const imageUrl = `${translatedUrl}${path}?api_key=${apiKey}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 15000
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

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'jellyfin') {
        res.status(404).json({ error: 'Jellyfin integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Jellyfin configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const stopUrl = `${translatedUrl}/Sessions/${sessionKey}/Playing/Stop`;
        // Full MediaBrowser header gives Jellyfin a session context to route the command.
        // Without Client/Device/DeviceId, Jellyfin accepts the request but can't dispatch it.
        const headers = {
            'Authorization': `MediaBrowser Client="Framerr", Device="Server", DeviceId="framerr-server", Version="0.1.5", Token="${apiKey}"`
        };

        logger.info(`[Jellyfin Proxy] Sending stop command: url="${stopUrl}"`);

        // Jellyfin's stop is a client command via WebSocket — the first attempt
        // is often ignored by clients. Send twice with a delay for reliability.
        const resp1 = await axios.post(stopUrl, {}, { headers, httpsAgent, timeout: 10000 });
        logger.info(`[Jellyfin Proxy] Stop attempt 1: status=${resp1.status}, data=${JSON.stringify(resp1.data ?? 'empty')}`);

        // Wait 750ms then send again
        await new Promise(resolve => setTimeout(resolve, 750));
        try {
            const resp2 = await axios.post(stopUrl, {}, { headers, httpsAgent, timeout: 10000 });
            logger.info(`[Jellyfin Proxy] Stop attempt 2: status=${resp2.status}, data=${JSON.stringify(resp2.data ?? 'empty')}`);
        } catch (retryErr) {
            const axErr = retryErr as { response?: { status?: number; data?: unknown }; message?: string };
            logger.info(`[Jellyfin Proxy] Stop attempt 2 failed (expected if session ended): status=${axErr.response?.status}, data=${JSON.stringify(axErr.response?.data ?? 'none')}, message="${axErr.message}"`);
        }

        logger.info(`[Jellyfin Proxy] Session termination request sent: sessionId=${sessionKey}`);
        res.json({ success: true });
    } catch (error) {
        const axErr = error as { response?: { status?: number; data?: unknown }; message?: string };
        logger.error(`[Jellyfin Proxy] Stop session failed: sessionId=${sessionKey}, status=${axErr.response?.status}, data=${JSON.stringify(axErr.response?.data ?? 'none')}, error="${axErr.message}"`);
        res.status(500).json({ error: 'Failed to stop playback' });
    }
});

export default router;
