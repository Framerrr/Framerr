/**
 * Backup Schedule Routes
 *
 * Schedule management: get and update backup schedule configuration.
 * All endpoints require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { getSystemConfig, BackupScheduleConfig } from '../../db/systemConfig';
import { updateBackupSchedule, getSchedulerStatus } from '../../services/backupScheduler';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from './types';

const router = Router();

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

export default router;
