import { Router, Request, Response } from 'express';
import { hashPassword } from '../auth/password';
import { createUser, listUsers } from '../db/users';
import { createInstance } from '../db/integrationInstances';
import logger from '../utils/logger';
import { onFirstUserCreated } from '../services/IntegrationManager';

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

        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
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
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validateBackupZip, extractBackup } from '../utils/backup';

// Configure multer for backup upload
const uploadDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'temp');
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
            file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    }
});

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

        const zipPath = req.file.path;
        logger.info(`[Restore] Backup file received: filename=${req.file.originalname} size=${req.file.size}`);

        // Validate backup
        const validation = await validateBackupZip(zipPath);
        if (!validation.valid) {
            // Clean up uploaded file
            fs.unlinkSync(zipPath);
            res.status(400).json({ error: validation.error });
            return;
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

        // Clean up uploaded file
        fs.unlinkSync(zipPath);

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

        res.json({
            success: true,
            message: 'Backup restored successfully.',
            manifest: validation.manifest
        });

        // With the getDb() pattern, the database connection is now hot-swapped
        // No server restart is needed - the new database is immediately active
    } catch (error) {
        logger.error(`[Restore] Setup restore error: error="${(error as Error).message}"`);

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: (error as Error).message || 'Restore failed' });
    }
});

export default router;


