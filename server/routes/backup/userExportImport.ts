/**
 * Backup User Export/Import Routes
 *
 * User config export/import and system config export.
 * Export and import use requireAuth (any authenticated user).
 * System export uses requireAdmin.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { getUserConfig, updateUserConfig } from '../../db/userConfig';
import { getSystemConfig } from '../../db/systemConfig';
import { getAllUsers } from '../../db/users';
import logger from '../../utils/logger';
import { AuthenticatedRequest, ImportBody, ImportData } from './types';

const router = Router();

/**
 * GET /api/backup/export
 * Export current user's configuration as JSON
 */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);

        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            user: {
                username: authReq.user!.username,
                displayName: authReq.user!.displayName
            },
            data: {
                dashboard: userConfig.dashboard,
                tabs: userConfig.tabs,
                theme: userConfig.theme,
                sidebar: userConfig.sidebar
            }
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `dashboard-backup-${authReq.user!.username}-${timestamp}.json`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(backup);

        logger.info(`[Backup] User config exported: user=${authReq.user!.id} username="${authReq.user!.username}"`);

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Backup] Failed to export user config: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to export configuration' });
    }
});

/**
 * POST /api/backup/import
 * Import user configuration from JSON backup
 */
router.post('/import', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { data } = req.body as ImportBody;

        if (!data || typeof data !== 'object') {
            res.status(400).json({
                error: 'Invalid backup data. Must include "data" object.'
            });
            return;
        }

        // Validate backup structure
        const validFields = ['dashboard', 'tabs', 'theme', 'sidebar'] as const;
        const importData: Partial<ImportData> = {};

        for (const field of validFields) {
            if (data[field]) {
                importData[field] = data[field];
            }
        }

        if (Object.keys(importData).length === 0) {
            res.status(400).json({
                error: 'No valid data to import'
            });
            return;
        }

        // Import data
        await updateUserConfig(authReq.user!.id, importData as Parameters<typeof updateUserConfig>[1]);

        logger.info(`[Backup] User config imported: user=${authReq.user!.id} fields=[${Object.keys(importData).join(',')}]`);

        res.json({
            success: true,
            imported: Object.keys(importData),
            message: 'Configuration imported successfully. Please refresh the page.'
        });

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Backup] Failed to import user config: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to import configuration' });
    }
});

/**
 * GET /api/backup/system
 * Export full system configuration (admin only)
 */
router.get('/system', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const systemConfig = await getSystemConfig();
        const users = await getAllUsers();

        // Read all user configs
        const userConfigs: Record<string, unknown> = {};
        for (const user of users) {
            try {
                const config = await getUserConfig(user.id);
                userConfigs[user.id] = {
                    username: user.username,
                    displayName: user.displayName,
                    group: user.group,
                    config: config
                };
            } catch (err) {
                logger.warn(`[Backup] Failed to load config for user: user="${user.username}" error="${(err as Error).message}"`);
            }
        }

        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: authReq.user!.username,
            system: systemConfig,
            users: userConfigs
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `dashboard-system-backup-${timestamp}.json`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(backup);

        logger.info(`[Backup] System backup exported: admin="${authReq.user!.username}" users=${Object.keys(userConfigs).length}`);

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Backup] Failed to export system backup: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to export system backup' });
    }
});

export default router;
