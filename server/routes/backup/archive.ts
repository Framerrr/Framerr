/**
 * Backup Archive Routes
 *
 * Full system backup management: create, list, download, delete, status.
 * All endpoints require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import {
    createBackup,
    listBackups,
    deleteBackup,
    getBackupFilePath,
    getBackupsTotalSize,
    isBackupInProgress,
} from '../../utils/backup';
import logger from '../../utils/logger';
import fs from 'fs';
import { AuthenticatedRequest } from './types';

const router = Router();

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

export default router;
