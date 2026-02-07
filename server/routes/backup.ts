/**
 * Backup Routes
 * 
 * API endpoints for system backup management.
 * All endpoints require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getUserConfig, updateUserConfig } from '../db/userConfig';
import { getSystemConfig, BackupScheduleConfig } from '../db/systemConfig';
import { getAllUsers } from '../db/users';
import {
    createBackup,
    listBackups,
    deleteBackup,
    getBackupFilePath,
    getBackupsTotalSize,
    isBackupInProgress,
    BACKUPS_DIR
} from '../utils/backup';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import {
    updateBackupSchedule,
    getSchedulerStatus,
    executeScheduledBackup
} from '../services/backupScheduler';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    displayName?: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface ImportData {
    dashboard?: unknown;
    tabs?: unknown;
    theme?: unknown;
    sidebar?: unknown;
}

interface ImportBody {
    data: ImportData;
}


// ============================================================================
// Full System Backup Endpoints (Admin Only)
// ============================================================================

/**
 * POST /api/backup/create
 * Create full system backup and save to server
 */
router.post('/create', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;

        // Check if backup already in progress
        if (isBackupInProgress()) {
            res.status(409).json({ error: 'A backup is already in progress' });
            return;
        }

        logger.info(`[Backup] Full backup requested: admin="${authReq.user!.username}"`);

        // Create backup asynchronously - progress sent via SSE
        const result = await createBackup({
            saveToServer: true,
            type: 'manual'
        });

        res.json({
            success: true,
            filename: result.filename,
            size: result.size
        });

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Backup] Failed to create: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create backup: ' + (error as Error).message });
    }
});

/**
 * GET /api/backup/list
 * List all server-stored backups
 */
router.get('/list', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const backups = listBackups();
        const totalSize = getBackupsTotalSize();

        res.json({
            backups,
            totalSize,
            count: backups.length
        });

    } catch (error) {
        logger.error(`[Backup] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

/**
 * GET /api/backup/download/:filename
 * Download a specific backup file
 */
router.get('/download/:filename', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { filename } = req.params;

        const filePath = getBackupFilePath(filename);
        if (!filePath) {
            res.status(404).json({ error: 'Backup not found' });
            return;
        }

        const stats = fs.statSync(filePath);

        logger.info(`[Backup] Download requested: admin="${authReq.user!.username}" file="${filename}" size=${stats.size}`);

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Length', stats.size);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

    } catch (error) {
        logger.error(`[Backup] Failed to download: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to download backup' });
    }
});

/**
 * DELETE /api/backup/:filename
 * Delete a specific backup file
 */
router.delete('/:filename', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { filename } = req.params;

        // Don't allow deleting safety backups (they auto-delete after 24h)
        if (filename.includes('-safety-')) {
            res.status(403).json({ error: 'Safety backups cannot be manually deleted' });
            return;
        }

        const success = deleteBackup(filename);
        if (!success) {
            res.status(404).json({ error: 'Backup not found' });
            return;
        }

        logger.info(`[Backup] Deleted: admin="${authReq.user!.username}" file="${filename}"`);

        res.json({ success: true });

    } catch (error) {
        logger.error(`[Backup] Failed to delete: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

/**
 * GET /api/backup/status
 * Get current backup status (in progress or not)
 */
router.get('/status', requireAdmin, async (_req: Request, res: Response) => {
    res.json({
        inProgress: isBackupInProgress()
    });
});

/**
 * GET /api/backup/schedule
 * Get current backup schedule configuration
 */
router.get('/schedule', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        const scheduleConfig = config.backupSchedule;
        const status = getSchedulerStatus();

        res.json({
            schedule: scheduleConfig || {
                enabled: true,
                frequency: 'weekly',
                dayOfWeek: 0,
                hour: 3,
                maxBackups: 10
            },
            status: {
                nextBackup: status.nextBackup?.toISOString() || null,
                isRunning: status.isRunning
            }
        });

    } catch (error) {
        logger.error(`[Backup] Failed to get schedule: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get backup schedule' });
    }
});

/**
 * PUT /api/backup/schedule
 * Update backup schedule configuration
 */
router.put('/schedule', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { enabled, frequency, dayOfWeek, hour, maxBackups } = req.body;

        // Validate inputs
        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled must be a boolean' });
            return;
        }
        if (frequency && !['daily', 'weekly'].includes(frequency)) {
            res.status(400).json({ error: 'frequency must be daily or weekly' });
            return;
        }
        if (hour !== undefined && (hour < 0 || hour > 23)) {
            res.status(400).json({ error: 'hour must be 0-23' });
            return;
        }
        if (maxBackups !== undefined && (maxBackups < 1 || maxBackups > 10)) {
            res.status(400).json({ error: 'maxBackups must be 1-10' });
            return;
        }
        if (frequency === 'weekly' && dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
            res.status(400).json({ error: 'dayOfWeek must be 0-6' });
            return;
        }

        // Get current config to merge with
        const currentConfig = await getSystemConfig();
        const currentSchedule = currentConfig.backupSchedule;

        const newSchedule: BackupScheduleConfig = {
            enabled,
            frequency: frequency || currentSchedule?.frequency || 'daily',
            hour: hour ?? currentSchedule?.hour ?? 3,
            maxBackups: maxBackups ?? currentSchedule?.maxBackups ?? 5,
            dayOfWeek: frequency === 'weekly'
                ? (dayOfWeek ?? currentSchedule?.dayOfWeek ?? 0)
                : undefined,
            lastBackup: currentSchedule?.lastBackup
        };

        // Update schedule (this also saves to DB)
        await updateBackupSchedule(newSchedule);

        logger.info(`[Backup] Schedule updated: admin="${authReq.user!.username}" enabled=${newSchedule.enabled} freq=${newSchedule.frequency}`);

        const status = getSchedulerStatus();

        res.json({
            success: true,
            schedule: newSchedule,
            status: {
                nextBackup: status.nextBackup?.toISOString() || null
            }
        });

    } catch (error) {
        logger.error(`[Backup] Failed to update schedule: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update backup schedule' });
    }
});


// ============================================================================
// User Config Export/Import (Any authenticated user)
// ============================================================================

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
