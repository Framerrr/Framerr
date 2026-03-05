import { Router, Request, Response } from 'express';
import { hashPassword, validatePassword } from '../auth/password';
import { createUser, listUsers } from '../db/users';
import { createInstance } from '../db/integrationInstances';
import logger from '../utils/logger';
import { onFirstUserCreated } from '../services/IntegrationManager';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { validateBackupZip, extractBackup } from '../utils/backup';
import { inspectBackupFile, decryptBackupToZip } from '../utils/backupInspector';

// ============================================================================
// Encrypted Restore State
// ============================================================================

interface RestoreSession {
    tempPath: string;
    uploadedAt: number;
    attempts: number;
    lastAttemptAt: number;
    invalidated: boolean;
}

const restoreSessions = new Map<string, RestoreSession>();
let pbkdf2InFlight = false;

const RESTORE_SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_DECRYPT_ATTEMPTS = 5;
const DECRYPT_COOLDOWN_MS = 1000;

/**
 * Sweep stale restore sessions (older than TTL).
 * Called on each new upload to prevent orphaned temp files.
 */
function sweepStaleSessions(): void {
    const now = Date.now();
    for (const [id, session] of restoreSessions) {
        if (now - session.uploadedAt > RESTORE_SESSION_TTL) {
            // Delete temp file if it still exists
            if (fs.existsSync(session.tempPath)) {
                try {
                    fs.unlinkSync(session.tempPath);
                    logger.debug(`[Restore] Cleaned up stale temp file: restoreId=${id}`);
                } catch (err) {
                    logger.warn(`[Restore] Failed to clean temp file: restoreId=${id} error="${(err as Error).message}"`);
                }
            }
            restoreSessions.delete(id);
        }
    }
}

/**
 * Startup cleanup: remove leftover restore temp files from crashed sessions.
 * Only targets restore-*.framerr-backup files in data/temp/.
 */
const tempDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'temp');
try {
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
            if (file.startsWith('restore-') && file.endsWith('.framerr-backup')) {
                fs.unlinkSync(path.join(tempDir, file));
                logger.debug(`[Restore] Startup cleanup: removed ${file}`);
            }
        }
    }
} catch (err) {
    logger.warn(`[Restore] Startup cleanup error: error="${(err as Error).message}"`);
}

const router = Router();

interface SetupBody {
    username: string;
    password: string;
    confirmPassword: string;
    displayName?: string;
}

/**
 * GET /api/auth/setup/status
 * Check if setup is needed (no users exist)
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const users = await listUsers();
        const needsSetup = users.length === 0;

        logger.debug(`[Setup] Status check: ${needsSetup ? 'needed' : 'not needed'}`);

        res.json({ needsSetup });
    } catch (error) {
        logger.error(`[Setup] Status check error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

/**
 * POST /api/auth/setup
 * Create admin user (only works if no users exist)
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { username, password, confirmPassword, displayName } = req.body as SetupBody;

        // Security: Verify no users exist
        const users = await listUsers();
        if (users.length > 0) {
            logger.warn('[Setup] Setup attempt when users already exist');
            res.status(403).json({ error: 'Setup has already been completed' });
            return;
        }

        // Validation
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            res.status(400).json({ error: passwordValidation.errors[0] });
            return;
        }

        if (password !== confirmPassword) {
            res.status(400).json({ error: 'Passwords do not match' });
            return;
        }

        // Validate username format (alphanumeric, underscore, hyphen)
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(username)) {
            res.status(400).json({
                error: 'Username can only contain letters, numbers, underscores, and hyphens'
            });
            return;
        }

        // Create admin user
        const passwordHash = await hashPassword(password);
        const user = await createUser({
            username,
            passwordHash,
            group: 'admin'
        });

        logger.info(`[Setup] Admin user created via setup wizard: username=${username}`);

        // Start services now that first user exists
        await onFirstUserCreated();

        // Seed preset integrations (disabled, with Docker-convention URLs)
        // These give new users a starting point — edit, fill in details, enable
        try {
            const presets = [
                { type: 'plex', displayName: 'Plex', config: { url: 'http://plex:32400' } },
                { type: 'sonarr', displayName: 'Sonarr', config: { url: 'http://sonarr:8989', apiKey: '' } },
                { type: 'radarr', displayName: 'Radarr', config: { url: 'http://radarr:7878', apiKey: '' } },
                { type: 'qbittorrent', displayName: 'qBittorrent', config: { url: 'http://qbittorrent:8080' } },
                { type: 'glances', displayName: 'Glances', config: { url: 'http://glances:61208' } },
                { type: 'uptime-kuma', displayName: 'Uptime Kuma', config: { url: 'http://uptime-kuma:3001' } },
            ];

            for (const preset of presets) {
                createInstance({
                    type: preset.type,
                    displayName: preset.displayName,
                    config: preset.config,
                    enabled: false,
                });
            }
            logger.info(`[Setup] Seeded ${presets.length} preset integrations`);
        } catch (seedError) {
            // Non-fatal — setup succeeds even if presets fail
            logger.warn(`[Setup] Failed to seed preset integrations: error="${(seedError as Error).message}"`);
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                group: user.group
            }
        });
    } catch (error) {
        logger.error(`[Setup] Error: error="${(error as Error).message}"`);
        res.status(500).json({ error: (error as Error).message || 'Setup failed' });
    }
});

/**
 * POST /api/auth/setup/restore
 * Restore from backup file (only works if no users exist)
 * Supports both plain .zip and encrypted .framerr-backup files.
 */

// Configure multer for backup upload
const uploadDir = tempDir;
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, `restore-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.mimetype === 'application/octet-stream' ||
            file.originalname.endsWith('.zip') ||
            file.originalname.endsWith('.framerr-backup')) {
            cb(null, true);
        } else {
            cb(new Error('Only .zip and .framerr-backup files are allowed'));
        }
    }
});

/**
 * Execute the actual restore: validate ZIP → close DB → extract → hot-swap → start services.
 * Shared between plain restore and encrypted decrypt flows.
 */
async function executeRestore(zipPath: string): Promise<void> {
    // Validate backup contents
    const validation = await validateBackupZip(zipPath);
    if (!validation.valid) {
        throw new Error(validation.error || 'Invalid backup file');
    }

    logger.info(`[Restore] Backup validated: manifest=${JSON.stringify(validation.manifest)}`);

    // CRITICAL: Close the database connection BEFORE extracting
    // This releases the file lock so we can overwrite the database file
    const { closeDatabase, reinitializeDatabase } = await import('../database/db');
    closeDatabase();
    logger.info('[Restore] Closed old database connection');

    // Extract backup (replaces database file)
    await extractBackup(zipPath);

    // Reinitialize database connection to pick up the restored database
    reinitializeDatabase();

    logger.info('[Restore] Backup restore complete via setup wizard');

    // Start background services - the restored database has users and data,
    // but services were skipped at startup because no users existed then
    try {
        const { startAllServices } = await import('../services/IntegrationManager');
        await startAllServices();
        logger.info('[Restore] Background services started after restore');
    } catch (serviceError) {
        // Non-fatal: services can be started on next server restart
        logger.warn(`[Restore] Failed to start background services: error="${(serviceError as Error).message}"`);
    }
}

router.post('/restore', upload.single('backup'), async (req: Request, res: Response) => {
    try {
        // Security: Verify no users exist (setup mode only)
        const users = await listUsers();
        if (users.length > 0) {
            logger.warn('[Restore] Restore attempt when users already exist');
            res.status(403).json({ error: 'Restore is only available during initial setup' });
            return;
        }

        // Check file was uploaded
        if (!req.file) {
            res.status(400).json({ error: 'No backup file provided' });
            return;
        }

        const filePath = req.file.path;
        logger.info(`[Restore] Backup file received: filename=${req.file.originalname} size=${req.file.size}`);

        // Sweep stale sessions on each new upload
        sweepStaleSessions();

        // Detect file format
        let inspection;
        try {
            inspection = inspectBackupFile(filePath);
        } catch (err) {
            fs.unlinkSync(filePath);
            res.status(400).json({ error: (err as Error).message });
            return;
        }

        if (inspection.format === 'encrypted') {
            // Encrypted backup — store temp file and return restoreId for two-step flow
            const restoreId = crypto.randomUUID();
            restoreSessions.set(restoreId, {
                tempPath: filePath,
                uploadedAt: Date.now(),
                attempts: 0,
                lastAttemptAt: 0,
                invalidated: false,
            });

            logger.info(`[Restore] Encrypted backup detected — awaiting password: restoreId=${restoreId}`);
            res.json({ encrypted: true, restoreId });
            return;
        }

        // Plain ZIP — proceed with immediate restore
        await executeRestore(filePath);

        // Clean up uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            success: true,
            message: 'Backup restored successfully.',
        });
    } catch (error) {
        logger.error(`[Restore] Setup restore error: error="${(error as Error).message}"`);

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: (error as Error).message || 'Restore failed' });
    }
});

/**
 * POST /api/auth/setup/restore/decrypt
 * Decrypt an encrypted backup and restore it (setup mode only).
 *
 * Rate limiting:
 * - Per-session cooldown (1s between attempts)
 * - Global PBKDF2 concurrency guard (one derivation at a time)
 * - Max 5 attempts per restoreId, then tombstone (410)
 */
router.post('/restore/decrypt', async (req: Request, res: Response) => {
    try {
        // Security: Verify no users exist (setup mode only)
        const users = await listUsers();
        if (users.length > 0) {
            res.status(403).json({ error: 'Restore is only available during initial setup' });
            return;
        }

        const { password, restoreId } = req.body;

        // Validation
        if (!password || !restoreId) {
            res.status(400).json({ error: 'Password and restoreId are required' });
            return;
        }

        // Rate limiting chain (ordered by precedence per plan)

        // 1. Unknown restoreId
        const session = restoreSessions.get(restoreId);
        if (!session) {
            res.status(404).json({ error: 'Restore session not found or expired' });
            return;
        }

        // 2. Tombstoned session
        if (session.invalidated) {
            res.status(410).json({ error: 'Too many failed attempts. Please re-upload the backup.' });
            return;
        }

        // 3. Per-session cooldown
        const now = Date.now();
        if (session.lastAttemptAt > 0 && now - session.lastAttemptAt < DECRYPT_COOLDOWN_MS) {
            res.status(429).json({ error: 'Too many attempts. Wait 1 second.', retryAfter: 1 });
            return;
        }

        // 4. Global PBKDF2 concurrency
        if (pbkdf2InFlight) {
            res.status(429).json({ error: 'Server busy. Try again shortly.', retryAfter: 2 });
            return;
        }

        // Mark attempt timing
        session.lastAttemptAt = now;

        // Attempt decryption
        pbkdf2InFlight = true;
        let decryptedZipPath: string;
        try {
            decryptedZipPath = decryptBackupToZip(session.tempPath, password);
        } catch {
            // Wrong password or corruption
            session.attempts++;

            if (session.attempts >= MAX_DECRYPT_ATTEMPTS) {
                // Tombstone the session
                session.invalidated = true;
                // Delete temp file
                if (fs.existsSync(session.tempPath)) {
                    fs.unlinkSync(session.tempPath);
                }
                logger.warn(`[Restore] Max decrypt attempts reached — tombstoned: restoreId=${restoreId}`);
                res.status(410).json({ error: 'Too many failed attempts. Please re-upload the backup.' });
                return;
            }

            const attemptsRemaining = MAX_DECRYPT_ATTEMPTS - session.attempts;
            logger.info(`[Restore] Wrong password: restoreId=${restoreId} attemptsRemaining=${attemptsRemaining}`);
            res.status(401).json({ error: 'Incorrect password', attemptsRemaining });
            return;
        } finally {
            pbkdf2InFlight = false;
        }

        // Decryption succeeded — execute restore with the decrypted ZIP
        try {
            await executeRestore(decryptedZipPath);
        } finally {
            // Clean up decrypted temp ZIP
            if (fs.existsSync(decryptedZipPath)) {
                fs.unlinkSync(decryptedZipPath);
            }
        }

        // Clean up encrypted temp file and session
        if (fs.existsSync(session.tempPath)) {
            fs.unlinkSync(session.tempPath);
        }
        restoreSessions.delete(restoreId);

        logger.info(`[Restore] Encrypted backup restored successfully: restoreId=${restoreId}`);
        res.json({ success: true });

    } catch (error) {
        logger.error(`[Restore] Decrypt restore error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Decryption failed' });
    }
});

export default router;


