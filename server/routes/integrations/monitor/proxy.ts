/**
 * Monitor Proxy Routes
 * 
 * Handles Monitor integration API proxying:
 * - /monitors - Get all monitors with status
 * - /monitor/:monitorId/history - Get monitor history/aggregates
 */

import { Router, Request, Response } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import * as serviceMonitorsDb from '../../../db/serviceMonitors';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * GET /:id/proxy/monitors - Get monitors for this integration instance
 */
router.get('/:id/proxy/monitors', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'monitor') {
        logger.warn(`[Monitor Proxy] 404 - Instance not found: id=${id} type=${instance?.type}`);
        res.status(404).json({ error: 'Monitor integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('monitor', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    try {
        const monitors = await serviceMonitorsDb.getMonitorsByIntegrationInstance(id);
        const monitorsWithStatus = await Promise.all(monitors.map(async (m) => {
            const recentChecks = await serviceMonitorsDb.getRecentChecks(m.id, 1);
            const lastCheck = recentChecks[0];
            return {
                ...m,
                status: lastCheck?.status || 'pending',
                responseTimeMs: lastCheck?.responseTimeMs || null,
                lastCheck: lastCheck?.checkedAt || null,
                uptimePercent: null
            };
        }));
        res.json({ monitors: monitorsWithStatus });
    } catch (error) {
        logger.error(`[Monitor Proxy] Monitors error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch monitors' });
    }
});

/**
 * GET /:id/proxy/monitor/:monitorId/history - Get monitor history
 */
router.get('/:id/proxy/monitor/:monitorId/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id, monitorId } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'monitor') {
        res.status(404).json({ error: 'Monitor integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('monitor', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    try {
        const aggregates = await serviceMonitorsDb.getHourlyAggregates(monitorId, hours);
        res.json({ aggregates });
    } catch (error) {
        logger.error(`[Monitor Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

export default router;
