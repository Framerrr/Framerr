/**
 * Backup Encryption Routes
 *
 * Encryption management: status, enable, disable, change password.
 * All endpoints require admin authentication.
 * Includes the rewriteBackupHeaders helper for password change operations.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import {
    isBackupEncryptionEnabled,
    enableBackupEncryption,
    disableBackupEncryption,
    changeBackupPassword,
    getBackupEncryption,
} from '../../db/backupEncryption';
import {
    deriveKEK,
    wrapKey,
    unwrapKey,
    generateSalt,
    CRYPTO_CONSTANTS,
} from '../../utils/backupCrypto';
import {
    parseEncryptedHeader,
} from '../../utils/backupInspector';
import { BACKUPS_DIR } from '../../utils/backup';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from './types';

const router = Router();

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
