/**
 * Tautulli Proxy Routes
 * 
 * Handles Tautulli-specific API proxying:
 * - /image - Proxy poster images via Tautulli's pms_image_proxy
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import logger from '../../../utils/logger';

const router = Router();

/**
 * GET /:id/proxy/image - Proxy Tautulli poster images
 * 
 * Uses Tautulli's built-in pms_image_proxy to fetch poster art.
 * Query params:
 *   - img: Plex thumb path (e.g. /library/metadata/12345/thumb/1234567890)
 *   - width: optional width in px (default 300)
 *   - height: optional height in px (default 450)
 *   - fallback: optional fallback image type
 */
router.get('/:id/proxy/tautulli-image', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { img, width = '300', height = '450' } = req.query;

    if (!img || typeof img !== 'string') {
        res.status(400).json({ error: 'Image path (img) required' });
        return;
    }

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'tautulli') {
        res.status(404).json({ error: 'Tautulli integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Tautulli configuration' });
        return;
    }

    try {
        const baseUrl = translateHostUrl(url.replace(/\/$/, ''));
        const imageUrl = `${baseUrl}/api/v2`;

        const response = await axios.get(imageUrl, {
            params: {
                apikey: apiKey,
                cmd: 'pms_image_proxy',
                img: img,
                width: String(width),
                height: String(height),
                fallback: 'poster',
            },
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 15000,
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=14400'); // 4 hours browser cache
        res.send(response.data);
    } catch (error) {
        logger.error(`[Tautulli Proxy] Image error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

export default router;
