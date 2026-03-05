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
        res.setHeader('Content-Type', filename.endsWith('.framerr-backup') ? 'application/octet-stream' : 'application/zip');
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


// ============================================================================
// Encryption Management Endpoints (Admin Only)
// ============================================================================

import {
    isBackupEncryptionEnabled,
    enableBackupEncryption,
    disableBackupEncryption,
    changeBackupPassword,
    getBackupEncryption,
} from '../db/backupEncryption';
import {
    deriveKEK,
    wrapKey,
    unwrapKey,
    generateSalt,
    CRYPTO_CONSTANTS,
} from '../utils/backupCrypto';
import {
    parseEncryptedHeader,
} from '../utils/backupInspector';

/**
 * Rewrite the wrappedMbk + salt headers in all server-stored .framerr-backup files.
 * Used after password change to update headers so server backups decrypt with the new password.
 *
 * Atomic per-file: writes to .tmp then renames. Failures on individual files are logged
 * but don't abort the sweep.
 *
 * @param mbk - The unwrapped Master Backup Key
 * @param newPassword - The new backup password
 * @returns Array of filenames that failed to rewrite (empty on full success)
 */
function rewriteBackupHeaders(mbk: Buffer, newPassword: string): string[] {
    const errors: string[] = [];

    let files: string[];
    try {
        files = fs.readdirSync(BACKUPS_DIR);
    } catch {
        // Backups dir might not exist yet
        return errors;
    }

    const backupFiles = files.filter(f => f.endsWith('.framerr-backup'));
    if (backupFiles.length === 0) return errors;

    logger.info(`[Backup] Rewriting headers for ${backupFiles.length} encrypted backup(s)`);

    for (const filename of backupFiles) {
        const filePath = path.join(BACKUPS_DIR, filename);

        try {
            // Read the existing file
            const fileBuffer = fs.readFileSync(filePath);
            const fileSize = fileBuffer.length;

            // Parse existing header to get wrappedDek, payloadIv, payloadAuthTag
            const existingHeader = parseEncryptedHeader(fileBuffer, fileSize);

            // Read existing header length to find payload start
            const headerLen = fileBuffer.readUInt16LE(9); // HEADER_LEN_OFFSET = 9
            const payloadStart = 11 + headerLen; // HEADER_OFFSET = 11
            const encryptedPayload = fileBuffer.subarray(payloadStart);

            // Generate new salt and wrap MBK with new password
            const newSalt = generateSalt();
            const newKek = deriveKEK(newPassword, newSalt, CRYPTO_CONSTANTS.PBKDF2_ITERATIONS);
            const newWrappedMbk = wrapKey(mbk, newKek);

            // Build new header JSON — preserve wrappedDek, payloadIv, payloadAuthTag
            const newHeaderJson = JSON.stringify({
                version: existingHeader.version,
                kdf: existingHeader.kdf,
                iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
                salt: newSalt.toString('base64'),
                wrappedMbk: newWrappedMbk.toString('base64'),
                wrappedDek: existingHeader.wrappedDek,
                payloadIv: existingHeader.payloadIv,
                payloadAuthTag: existingHeader.payloadAuthTag,
            });

            const newHeaderBuf = Buffer.from(newHeaderJson, 'utf-8');

            // Build complete new file
            const magic = Buffer.from('FRMRBKUP', 'ascii');
            const version = Buffer.from([0x01]);
            const newHeaderLenBuf = Buffer.alloc(2);
            newHeaderLenBuf.writeUInt16LE(newHeaderBuf.length, 0);

            const newFile = Buffer.concat([magic, version, newHeaderLenBuf, newHeaderBuf, encryptedPayload]);

            // Atomic write: tmp file → rename
            const tmpPath = filePath + '.tmp';
            fs.writeFileSync(tmpPath, newFile);
            fs.renameSync(tmpPath, filePath);

            logger.debug(`[Backup] Header rewritten: file=${filename}`);
        } catch (err) {
            errors.push(filename);
            logger.error(`[Backup] Failed to rewrite header: file=${filename} error="${(err as Error).message}"`);
        }
    }

    return errors;
}

/**
 * GET /api/backup/encryption/status
 * Check if backup encryption is enabled
 */
router.get('/encryption/status', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const enabled = isBackupEncryptionEnabled();
        res.json({ enabled });
    } catch (error) {
        logger.error(`[Backup] Failed to check encryption status: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to check encryption status' });
    }
});

/**
 * POST /api/backup/encryption/enable
 * Enable backup encryption with a password
 */
router.post('/encryption/enable', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;

        if (!password) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }

        if (typeof password !== 'string' || password.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters' });
            return;
        }

        enableBackupEncryption(password);

        const authReq = req as AuthenticatedRequest;
        logger.info(`[Backup] Encryption enabled: admin="${authReq.user!.username}"`);

        res.json({ enabled: true, message: 'Backup encryption enabled' });
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Backup encryption is already enabled') {
            res.status(409).json({ error: message });
        } else {
            logger.error(`[Backup] Failed to enable encryption: error="${message}"`);
            res.status(500).json({ error: 'Failed to enable backup encryption' });
        }
    }
});

/**
 * POST /api/backup/encryption/disable
 * Disable backup encryption (requires current password)
 */
router.post('/encryption/disable', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;

        if (!password) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }

        disableBackupEncryption(password);

        const authReq = req as AuthenticatedRequest;
        logger.info(`[Backup] Encryption disabled: admin="${authReq.user!.username}"`);

        res.json({ enabled: false, message: 'Backup encryption disabled. New backups will be unencrypted.' });
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Incorrect password') {
            res.status(401).json({ error: message });
        } else if (message === 'Backup encryption is not enabled') {
            res.status(404).json({ error: message });
        } else {
            logger.error(`[Backup] Failed to disable encryption: error="${message}"`);
            res.status(500).json({ error: 'Failed to disable backup encryption' });
        }
    }
});

/**
 * POST /api/backup/encryption/change-password
 * Change the backup encryption password and rewrite server backup headers
 */
router.post('/encryption/change-password', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            res.status(400).json({ error: 'Both old and new passwords are required' });
            return;
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            res.status(400).json({ error: 'New password must be at least 8 characters' });
            return;
        }

        // Get encryption config to unwrap MBK before changing password
        const config = getBackupEncryption();
        if (!config) {
            res.status(404).json({ error: 'Backup encryption is not enabled' });
            return;
        }

        // Unwrap MBK with old password (verifies it's correct)
        const oldSalt = Buffer.from(config.kekSalt, 'base64');
        const oldKek = deriveKEK(oldPassword, oldSalt, config.kdfIterations);
        const wrappedMbk = Buffer.from(config.mbkPassword, 'base64');

        let mbk: Buffer;
        try {
            mbk = unwrapKey(wrappedMbk, oldKek);
        } catch {
            res.status(401).json({ error: 'Incorrect current password' });
            return;
        }

        // Change password in DB
        changeBackupPassword(oldPassword, newPassword);

        // Rewrite headers on server-stored backups
        const rewriteErrors = rewriteBackupHeaders(mbk, newPassword);

        const authReq = req as AuthenticatedRequest;
        logger.info(`[Backup] Password changed: admin="${authReq.user!.username}" rewriteErrors=${rewriteErrors.length}`);

        const response: { message: string; rewriteErrors?: string[] } = {
            message: 'Backup password changed. Server backups updated.',
        };
        if (rewriteErrors.length > 0) {
            response.rewriteErrors = rewriteErrors;
        }

        res.json(response);
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Incorrect current password') {
            res.status(401).json({ error: message });
        } else if (message === 'Backup encryption is not enabled') {
            res.status(404).json({ error: message });
        } else {
            logger.error(`[Backup] Failed to change password: error="${message}"`);
            res.status(500).json({ error: 'Failed to change backup password' });
        }
    }
});

export default router;
