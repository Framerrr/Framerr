/**
 * Service Monitors User Routes
 * 
 * Authenticated user endpoints for viewing shared monitors and status.
 * 
 * Endpoints:
 * - GET /shared - Get monitors shared with current user
 * - GET /:id/status - Get current status for a monitor
 * - GET /:id/history - Get check history for a monitor
 * - GET /:id/aggregates - Get hourly aggregates for tick-bar
 * - GET /poller/status - Get poller status (admin debug)
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as serviceMonitorsDb from '../../db/serviceMonitors';
import servicePoller, { isInMaintenanceWindow } from '../../services/servicePoller';
import { getSystemConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /shared
 * Get monitors shared with current user (filtered by activeBackend)
 */
router.get('/shared', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userGroup = req.user!.group || 'user';

        // Non-admins must check integration access first
        if (userGroup !== 'admin') {

            const { userHasIntegrationAccess } = await import('../../db/integrationShares');
            const hasAccess = await userHasIntegrationAccess('servicemonitoring', userId, userGroup);
            if (!hasAccess) {
                res.status(403).json({ error: 'Integration not shared with you' });
                return;
            }
        }

        // Get activeBackend from config
        const config = await getSystemConfig();
        const smConfig = config.integrations?.['servicemonitoring'] || {};
        const activeBackend = smConfig.activeBackend || 'framerr';

        // Get monitors owned by user + monitors shared with user
        const ownedMonitors = await serviceMonitorsDb.getMonitorsByOwner(userId);
        const sharedMonitors = await serviceMonitorsDb.getSharedMonitors(userId);

        // Combine and deduplicate
        const monitorMap = new Map<string, serviceMonitorsDb.ServiceMonitor>();
        for (const monitor of [...ownedMonitors, ...sharedMonitors]) {
            monitorMap.set(monitor.id, monitor);
        }

        // Filter by activeBackend
        const allMonitors = Array.from(monitorMap.values());
        const filteredMonitors = allMonitors.filter(m => {
            if (activeBackend === 'framerr') {
                // First-party monitors: no uptimeKumaId
                return m.uptimeKumaId == null;
            } else {
                // UK-imported monitors: has uptimeKumaId
                return m.uptimeKumaId != null;
            }
        });

        res.json({ monitors: filteredMonitors, activeBackend });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get shared: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch monitors' });
    }
});

/**
 * GET /:id/status
 * Get current status for a monitor
 */
router.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const monitor = await serviceMonitorsDb.getMonitorById(id);

        if (!monitor) {
            res.status(404).json({ error: 'Monitor not found' });
            return;
        }

        // For UK-imported monitors, status is now fetched via proxy routes
        // The widget uses /api/proxy/i/:id/monitors which returns status inline
        // This endpoint remains for backward compatibility with local checks

        // For Framerr first-party monitors, get from local checks
        const recentChecks = await serviceMonitorsDb.getRecentChecks(id, 1);
        const lastCheck = recentChecks[0] || null;

        // Get uptime aggregates for last 24 hours
        const aggregates = await serviceMonitorsDb.getHourlyAggregates(id, 24);

        // Calculate uptime percentage
        let totalChecks = 0;
        let upChecks = 0;
        for (const agg of aggregates) {
            totalChecks += agg.checksTotal;
            upChecks += agg.checksUp + agg.checksDegraded; // Degraded counts as up for uptime
        }
        const uptimePercent = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 1000) / 10 : 100;

        // Check both manual and scheduled maintenance
        const inScheduledMaintenance = isInMaintenanceWindow(monitor.maintenanceSchedule);
        const inMaintenance = monitor.maintenance || inScheduledMaintenance;

        res.json({
            monitorId: id,
            name: monitor.name,
            status: inMaintenance ? 'maintenance' : (lastCheck?.status || 'pending'),
            responseTimeMs: lastCheck?.responseTimeMs || null,
            lastCheck: lastCheck?.checkedAt || null,
            uptimePercent,
            maintenance: inMaintenance,
        });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get status: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * GET /:id/history
 * Get check history for a monitor
 */
router.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

        const history = await serviceMonitorsDb.getCheckHistory(id, limit, offset);
        res.json({ history });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get history: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * GET /:id/aggregates
 * Get hourly aggregates for tick-bar visualization
 */
router.get('/:id/aggregates', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const hours = parseInt(req.query.hours as string) || 24;

        // For UK monitors, history is now fetched via proxy routes
        // Widget uses /api/proxy/i/:id/monitor/:monitorId/history
        // This endpoint remains for backward compatibility with local monitors

        // Framerr first-party monitor
        const aggregates = await serviceMonitorsDb.getHourlyAggregates(id, hours);
        res.json({ aggregates });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get aggregates: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch aggregates' });
    }
});

/**
 * GET /poller/status
 * Get poller status for debugging (admin only)
 */
router.get('/poller/status', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const status = servicePoller.getStatus();
        res.json(status);
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get poller status: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch poller status' });
    }
});

export default router;
