import { Router, Request, Response } from 'express';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';
import { requireAdmin } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * GET /api/system/config
 * Get system configuration (admin only)
 */
router.get('/config', requireAdmin, async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        logger.error(`[System] Failed to get config: error="${(error as Error).message}"`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_READ_ERROR',
                message: 'Failed to read system configuration'
            }
        });
    }
});

/**
 * PUT /api/system/config
 * Update system configuration (admin only)
 */
router.put('/config', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const updates = req.body;
        const newConfig = await updateSystemConfig(updates);
        // Refresh in-memory cached config for middleware
        req.app.set('systemConfig', newConfig);
        logger.info(`[System] Config updated: user="${authReq.user?.username}" keys=${Object.keys(updates).join(',')}`);
        res.json({
            success: true,
            config: newConfig
        });
    } catch (error) {
        logger.error(`[System] Failed to update config: error="${(error as Error).message}"`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_UPDATE_ERROR',
                message: (error as Error).message || 'Failed to update system configuration'
            }
        });
    }
});

export default router;

