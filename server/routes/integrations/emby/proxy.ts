/**
 * Emby Proxy Routes
 * 
 * Handles proxying requests to Emby server:
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
 * GET /:id/proxy/* - Wildcard route for Emby API paths
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

    // Check if this is an Emby integration - if not, pass to next router
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'emby') {
        next();
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Emby configuration' });
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
        // Emby uses api_key query param (same as Jellyfin)
        const imageUrl = `${translatedUrl}${path}?api_key=${apiKey}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 15000
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Emby Proxy] Image error: path="${path}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

export default router;
