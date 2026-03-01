/**
 * Glances Proxy Routes
 * 
 * Handles Glances API proxying:
 * - /status - Get system status
 * - /history - Get metric history
 */

import { Router, Request, Response } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';

const router = Router();
const adapter = getPlugin('glances')!.adapter;

/**
 * GET /:id/proxy/status - Get Glances system status
 */
router.get('/:id/proxy/status', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!dbInstance || dbInstance.type !== 'glances') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('glances', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid Glances configuration' });
        return;
    }

    try {
        // Fetch multiple endpoints in parallel
        const [cpuRes, memRes, diskRes, networkRes] = await Promise.all([
            adapter.get!(instance, '/api/4/cpu', { timeout: 5000 }),
            adapter.get!(instance, '/api/4/mem', { timeout: 5000 }),
            adapter.get!(instance, '/api/4/fs', { timeout: 5000 }),
            adapter.get!(instance, '/api/4/network', { timeout: 5000 }).catch(() => ({ data: [] }))
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

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!dbInstance || dbInstance.type !== 'glances') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('glances', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid Glances configuration' });
        return;
    }

    try {
        const response = await adapter.get!(instance, '/api/4/all/history', {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Glances Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Glances history' });
    }
});

export default router;
