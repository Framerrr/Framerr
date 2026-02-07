/**
 * Service Monitors Sharing Routes
 * 
 * Admin-only endpoints for sharing monitors with users.
 * 
 * Endpoints:
 * - GET /:id/shares - Get shares for a monitor
 * - POST /:id/share - Share with users
 * - DELETE /:id/share - Revoke shares
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as serviceMonitorsDb from '../../db/serviceMonitors';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /:id/shares
 * Get shares for a monitor (admin only)
 */
router.get('/:id/shares', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const shares = await serviceMonitorsDb.getMonitorShares(id);
        res.json({ shares });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get shares: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch shares' });
    }
});

/**
 * POST /:id/share
 * Share a monitor with users (admin only)
 */
router.post('/:id/share', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userIds, notify } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            res.status(400).json({ error: 'userIds array is required' });
            return;
        }

        const shares = await serviceMonitorsDb.shareMonitor(id, userIds, notify !== false);
        res.json({ shares });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to share: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to share monitor' });
    }
});

/**
 * DELETE /:id/share
 * Revoke sharing for a monitor (admin only)
 */
router.delete('/:id/share', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body;

        const count = await serviceMonitorsDb.unshareMonitor(id, userIds);
        res.json({ success: true, revokedCount: count });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to revoke shares: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to revoke shares' });
    }
});

export default router;
