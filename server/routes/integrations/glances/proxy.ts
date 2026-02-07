/**
 * Glances Proxy Routes
 * 
 * Handles Glances API proxying:
 * - /status - Get system status
 * - /history - Get metric history
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * GET /:id/proxy/status - Get Glances system status
 */
router.get('/:id/proxy/status', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!instance || instance.type !== 'glances') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('glances', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const password = instance.config.password as string | undefined;

    if (!url) {
        res.status(400).json({ error: 'Invalid Glances configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const headers: Record<string, string> = {};
        if (password) {
            headers['X-Auth'] = password;
        }

        // Fetch multiple endpoints in parallel
        const [cpuRes, memRes, diskRes, networkRes] = await Promise.all([
            axios.get(`${translatedUrl}/api/4/cpu`, { headers, httpsAgent, timeout: 5000 }),
            axios.get(`${translatedUrl}/api/4/mem`, { headers, httpsAgent, timeout: 5000 }),
            axios.get(`${translatedUrl}/api/4/fs`, { headers, httpsAgent, timeout: 5000 }),
            axios.get(`${translatedUrl}/api/4/network`, { headers, httpsAgent, timeout: 5000 }).catch(() => ({ data: [] }))
        ]);

        res.json({
            cpu: cpuRes.data,
            memory: memRes.data,
            disk: diskRes.data,
            network: networkRes.data
        });
    } catch (error) {
        logger.error(`[Glances Proxy] Status error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Glances status' });
    }
});

/**
 * GET /:id/proxy/history - Get Glances metric history
 */
router.get('/:id/proxy/history', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!instance || instance.type !== 'glances') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('glances', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const password = instance.config.password as string | undefined;

    if (!url) {
        res.status(400).json({ error: 'Invalid Glances configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const headers: Record<string, string> = {};
        if (password) {
            headers['X-Auth'] = password;
        }

        const response = await axios.get(`${translatedUrl}/api/4/all/history`, {
            headers,
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Glances Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Glances history' });
    }
});

export default router;
