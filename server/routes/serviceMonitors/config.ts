/**
 * Service Monitors Configuration
 * 
 * Configuration check and config management endpoints.
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as serviceMonitorsDb from '../../db/serviceMonitors';
import { getSystemConfig, updateSystemConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';

const router = Router();

/**
 * Check if Service Monitoring is properly configured
 * Used by the integration status system to show ✓ or ! in widget gallery
 * 
 * Requirements: at least 1 monitor exists
 */
export function isConfigured(): boolean {
    try {
        const count = serviceMonitorsDb.getMonitorCount();
        return count > 0;
    } catch {
        return false;
    }
}

/**
 * GET /config
 * Get service monitoring config (activeBackend) (admin only)
 */
router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        const smConfig = config.integrations?.['servicemonitoring'] || {};

        res.json({
            activeBackend: smConfig.activeBackend || 'framerr',
            enabled: smConfig.enabled || false
        });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to get config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

/**
 * PUT /config
 * Update service monitoring config (activeBackend) (admin only)
 */
router.put('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { activeBackend } = req.body;

        if (activeBackend && !['framerr', 'uptimekuma'].includes(activeBackend)) {
            res.status(400).json({ error: 'Invalid activeBackend value' });
            return;
        }

        const config = await getSystemConfig();
        const integrations = config.integrations || {};
        const smConfig = integrations['servicemonitoring'] || {};

        if (activeBackend) {
            smConfig.activeBackend = activeBackend;
        }

        integrations['servicemonitoring'] = smConfig;
        await updateSystemConfig({ integrations });

        logger.info(`[ServiceMonitors] Config updated: activeBackend=${activeBackend}`);

        res.json({ success: true, activeBackend: smConfig.activeBackend });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to update config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

export default router;
