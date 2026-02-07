/**
 * Template Backup Routes
 * 
 * Dashboard backup, revert, and draft operations.
 * 
 * Endpoints:
 * - GET /backup - Get user's dashboard backup
 * - POST /revert - Revert dashboard to backup
 * - POST /draft - Auto-save draft
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import { updateUserConfig } from '../../db/userConfig';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * GET /backup
 * Get user's dashboard backup
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const backup = await templateDb.getBackup(authReq.user!.id);

        if (!backup) {
            res.json({ backup: null });
            return;
        }

        res.json({ backup });
    } catch (error) {
        logger.error(`[Templates] Failed to get backup: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch backup' });
    }
});

/**
 * POST /revert
 * Revert dashboard to backup
 */
router.post('/revert', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const backup = await templateDb.getBackup(authReq.user!.id);

        if (!backup) {
            res.status(404).json({ error: 'No backup available' });
            return;
        }

        // Restore dashboard from backup
        await updateUserConfig(authReq.user!.id, {
            dashboard: {
                widgets: backup.widgets,
                mobileLayoutMode: backup.mobileLayoutMode,
                mobileWidgets: backup.mobileWidgets || undefined,
            },
        });

        // Delete backup after revert
        await templateDb.deleteBackup(authReq.user!.id);

        logger.info(`[Templates] Dashboard reverted: user=${authReq.user!.id}`);
        res.json({
            success: true,
            widgets: backup.widgets,
            mobileLayoutMode: backup.mobileLayoutMode,
        });
    } catch (error) {
        logger.error(`[Templates] Failed to revert: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to revert dashboard' });
    }
});

export default router;
