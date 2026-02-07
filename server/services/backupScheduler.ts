/**
 * Backup Scheduler Service
 * 
 * Handles automated scheduled backups and cleanup.
 * Uses jobScheduler cron for wall-clock reliable scheduling.
 */

import logger from '../utils/logger';
import { createBackup, cleanupOldBackups } from '../utils/backup';
import { getSystemConfig, updateSystemConfig, BackupScheduleConfig } from '../db/systemConfig';
import { broadcast } from './sseStreamService';
import { registerJob, unregisterJob, getJobStatus } from './jobScheduler';

// ============================================================================
// Constants
// ============================================================================

const JOB_ID = 'scheduled-backup';
let isRunning = false;

/**
 * Convert backup schedule config to a cron expression.
 * Daily at hour H: '0 H * * *'
 * Weekly on day D at hour H: '0 H * * D'
 */
function configToCron(config: BackupScheduleConfig): string {
    if (config.frequency === 'weekly') {
        const dayOfWeek = config.dayOfWeek ?? 0;
        return `0 ${config.hour} * * ${dayOfWeek}`;
    }
    return `0 ${config.hour} * * *`;
}

/**
 * Get human-readable description from config.
 */
function configToDescription(config: BackupScheduleConfig): string {
    const hour = config.hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const timeStr = `${displayHour}:00 ${period}`;

    if (config.frequency === 'weekly') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[config.dayOfWeek ?? 0]} at ${timeStr}`;
    }
    return `Daily at ${timeStr}`;
}

// ============================================================================
// Backup Execution
// ============================================================================

/**
 * Execute a scheduled backup
 * Exported for testing purposes
 */
export async function executeScheduledBackup(): Promise<void> {
    if (isRunning) {
        logger.warn('[BackupScheduler] Backup already in progress, skipping');
        return;
    }

    isRunning = true;
    logger.info('[BackupScheduler] Starting scheduled backup');

    try {
        // Create the backup
        const result = await createBackup({
            saveToServer: true,
            type: 'scheduled'
        });

        logger.info(`[BackupScheduler] Scheduled backup complete: file=${result.filename} size=${result.size}`);

        // Get config for cleanup
        const config = await getSystemConfig();
        const scheduleConfig = config.backupSchedule;

        if (scheduleConfig) {
            // Run auto-cleanup
            const deleted = cleanupOldBackups(scheduleConfig.maxBackups);
            if (deleted > 0) {
                logger.info(`[BackupScheduler] Cleaned up old backups: deleted=${deleted}`);
            }

            // Update last backup time
            await updateSystemConfig({
                backupSchedule: {
                    ...scheduleConfig,
                    lastBackup: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`[BackupScheduler] Scheduled backup failed: error="${errorMessage}"`);

        // Broadcast error notification for admins
        broadcast('backup:scheduled-failed', {
            error: errorMessage,
            timestamp: new Date().toISOString()
        });

    } finally {
        isRunning = false;
    }
}

// ============================================================================
// Schedule Management
// ============================================================================

/**
 * Register the backup job with the cron scheduler.
 */
function registerBackupJob(config: BackupScheduleConfig): void {
    const cronExpression = configToCron(config);
    const description = configToDescription(config);

    registerJob({
        id: JOB_ID,
        name: 'Scheduled Backup',
        cronExpression,
        description,
        execute: executeScheduledBackup,
    });

    logger.info(`[BackupScheduler] Registered cron job: cron="${cronExpression}" description="${description}"`);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the backup scheduler on server start
 */
export async function initializeBackupScheduler(): Promise<void> {
    logger.info('[BackupScheduler] Initializing...');

    try {
        const config = await getSystemConfig();
        const scheduleConfig = config.backupSchedule;

        if (scheduleConfig?.enabled) {
            // Check for missed backups (catch-up logic)
            const missedBackup = checkForMissedBackup(scheduleConfig);

            if (missedBackup) {
                logger.info(`[BackupScheduler] Missed backup detected, triggering catch-up: lastBackup=${scheduleConfig.lastBackup} expectedInterval=${scheduleConfig.frequency}`);

                // Execute catch-up backup (don't await - let it run in background)
                executeScheduledBackup().catch(err => {
                    logger.error(`[BackupScheduler] Catch-up backup failed: error="${err.message}"`);
                });
            }

            registerBackupJob(scheduleConfig);
            logger.info(`[BackupScheduler] Scheduler started: frequency=${scheduleConfig.frequency} hour=${scheduleConfig.hour} dayOfWeek=${scheduleConfig.dayOfWeek} maxBackups=${scheduleConfig.maxBackups} catchUpTriggered=${missedBackup}`);
        } else {
            logger.info('[BackupScheduler] Scheduled backups not enabled');
        }
    } catch (error) {
        logger.error(`[BackupScheduler] Failed to initialize: error="${(error as Error).message}"`);
    }
}

/**
 * Check if a scheduled backup was missed while server was down
 */
function checkForMissedBackup(config: BackupScheduleConfig): boolean {
    if (!config.lastBackup) {
        // Never backed up before - trigger one
        return true;
    }

    const lastBackupTime = new Date(config.lastBackup).getTime();
    const now = Date.now();

    // Calculate expected interval in milliseconds
    const intervalMs = config.frequency === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000  // 7 days
        : 24 * 60 * 60 * 1000;      // 1 day

    // Add 2 hour grace period (backup might be slightly late)
    const expectedNextBackup = lastBackupTime + intervalMs + (2 * 60 * 60 * 1000);

    // If we're past the expected time, backup was missed
    return now > expectedNextBackup;
}

/**
 * Update the backup schedule (called when settings change)
 */
export async function updateBackupSchedule(config: BackupScheduleConfig): Promise<void> {
    logger.info(`[BackupScheduler] Schedule updated: enabled=${config.enabled} frequency=${config.frequency} hour=${config.hour}`);

    // Save to database
    await updateSystemConfig({
        backupSchedule: config
    });

    // Re-register or unregister
    if (config.enabled) {
        registerBackupJob(config);
    } else {
        unregisterJob(JOB_ID);
    }
}

/**
 * Shutdown the backup scheduler
 */
export function shutdownBackupScheduler(): void {
    logger.info('[BackupScheduler] Shutting down');
    unregisterJob(JOB_ID);
}

/**
 * Get the next scheduled backup time
 */
export function getNextBackupTime(): Date | null {
    const status = getJobStatus(JOB_ID);
    return status?.nextRun ? new Date(status.nextRun) : null;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
    enabled: boolean;
    nextBackup: Date | null;
    isRunning: boolean;
} {
    const status = getJobStatus(JOB_ID);
    return {
        enabled: status !== null,
        nextBackup: status?.nextRun ? new Date(status.nextRun) : null,
        isRunning: isRunning
    };
}
