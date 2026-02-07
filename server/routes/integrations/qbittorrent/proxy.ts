/**
 * qBittorrent Proxy Routes
 * 
 * Handles qBittorrent API proxying:
 * - /torrents - Get torrent list
 * - /transfer - Get transfer stats
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * Login to qBittorrent and get session cookie
 */
async function qbLogin(url: string, username?: string, password?: string): Promise<string | null> {
    try {
        const formData = new URLSearchParams();
        if (username) formData.append('username', username);
        if (password) formData.append('password', password);

        const response = await axios.post(
            `${url}/api/v2/auth/login`,
            formData,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                httpsAgent,
                timeout: 5000
            }
        );

        if (response.data === 'Ok.' || response.status === 200) {
            return response.headers['set-cookie']?.[0] || null;
        }
        return null;
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Login error: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * GET /:id/proxy/torrents - Get torrent list
 */
router.get('/:id/proxy/torrents', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'qbittorrent') {
        res.status(404).json({ error: 'qBittorrent integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('qbittorrent', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const username = instance.config.username as string | undefined;
    const password = instance.config.password as string | undefined;

    if (!url) {
        res.status(400).json({ error: 'Invalid qBittorrent configuration' });
        return;
    }

    try {
        const cookie = await qbLogin(url, username, password);
        if (!cookie) {
            res.status(401).json({ error: 'qBittorrent authentication failed' });
            return;
        }

        const response = await axios.get(`${url}/api/v2/torrents/info`, {
            headers: { Cookie: cookie },
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Torrents error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch torrents' });
    }
});

/**
 * GET /:id/proxy/transfer - Get transfer stats
 */
router.get('/:id/proxy/transfer', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'qbittorrent') {
        res.status(404).json({ error: 'qBittorrent integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('qbittorrent', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const username = instance.config.username as string | undefined;
    const password = instance.config.password as string | undefined;

    if (!url) {
        res.status(400).json({ error: 'Invalid qBittorrent configuration' });
        return;
    }

    try {
        const cookie = await qbLogin(url, username, password);
        if (!cookie) {
            res.status(401).json({ error: 'qBittorrent authentication failed' });
            return;
        }

        const response = await axios.get(`${url}/api/v2/transfer/info`, {
            headers: { Cookie: cookie },
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Transfer error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch transfer stats' });
    }
});

export default router;
