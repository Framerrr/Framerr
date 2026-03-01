/**
 * Custom System Status Proxy Routes
 * 
 * Handles Custom System Status API proxying:
 * - /status - Get system status from custom backend
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
const adapter = getPlugin('customsystemstatus')!.adapter;

/**
 * GET /:id/proxy/status - Get custom system status
 */
router.get('/:id/proxy/status', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!dbInstance || dbInstance.type !== 'customsystemstatus') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('customsystemstatus', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid Custom System Status configuration' });
        return;
    }

    try {
        const response = await adapter.get!(instance, '/status', {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[CustomSystemStatus Proxy] Status error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

/**
 * GET /:id/proxy/history - Get metric history
 */
router.get('/:id/proxy/history', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    // If instance not found or wrong type, let next router handle it
    if (!dbInstance || dbInstance.type !== 'customsystemstatus') {
        return next();
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('customsystemstatus', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid Custom System Status configuration' });
        return;
    }

    try {
        const response = await adapter.get!(instance, '/history', {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[CustomSystemStatus Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

export default router;
