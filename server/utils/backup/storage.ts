/**
 * Backup Module — Storage
 *
 * File system operations for backup file management:
 * listing, path resolution, deletion, size calculation, and cleanup.
 */

import fs from 'fs';
import path from 'path';
import logger from '../logger';
import { safePath } from '../pathSanitize';
import { BACKUPS_DIR } from './constants';
import type { BackupInfo } from './types';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Ensure backups directory exists
 */
export function ensureBackupsDir(): void {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        logger.info(`[Backup] Created backups directory: path=${BACKUPS_DIR}`);
    }
}

/**
 * Parse backup filename to extract type and timestamp
 * Supports both .zip (plain) and .framerr-backup (encrypted) extensions
 */
export function parseBackupFilename(filename: string): { type: 'manual' | 'scheduled' | 'safety'; timestamp: string; encrypted: boolean } | null {
    // Format: framerr-{type}-{timestamp}.zip or framerr-{type}-{timestamp}.framerr-backup
    const match = filename.match(/^framerr-(manual|scheduled|safety)-(.+)\.(zip|framerr-backup)$/);
    if (!match) return null;
    return {
        type: match[1] as 'manual' | 'scheduled' | 'safety',
        timestamp: match[2],
        encrypted: match[3] === 'framerr-backup'
    };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List all backups in the backups directory
 */
export function listBackups(): BackupInfo[] {
    ensureBackupsDir();

    try {
        const files = fs.readdirSync(BACKUPS_DIR);
        const backups: BackupInfo[] = [];

        for (const filename of files) {
            if (!filename.endsWith('.zip') && !filename.endsWith('.framerr-backup')) continue;

            const parsed = parseBackupFilename(filename);
            if (!parsed) continue;

            const filePath = path.join(BACKUPS_DIR, filename);
            const stats = fs.statSync(filePath);

            backups.push({
                filename,
                type: parsed.type,
                size: stats.size,
                // Use mtime instead of birthtime - birthtime is unreliable on Docker/Linux
                createdAt: stats.mtime.toISOString(),
                encrypted: parsed.encrypted
            });
        }

        // Sort by creation date, newest first
        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return backups;
    } catch (error) {
        logger.error(`[Backup] Failed to list backups: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Get the full path to a backup file (with security validation)
 */
export function getBackupFilePath(filename: string): string | null {
    // Security: validate filename and prevent path traversal
    if (!filename.endsWith('.zip') && !filename.endsWith('.framerr-backup')) {
        logger.warn(`[Backup] Invalid filename (not backup): file="${filename}"`);
        return null;
    }

    let filePath: string;
    try {
        filePath = safePath(BACKUPS_DIR, filename);
    } catch {
        logger.warn(`[Backup] Invalid filename (path traversal): file="${filename}"`);
        return null;
    }

    // Verify file exists
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return filePath;
}

/**
 * Delete a backup file
 */
export function deleteBackup(filename: string): boolean {
    const filePath = getBackupFilePath(filename);
    if (!filePath) {
        return false;
    }

    try {
        fs.unlinkSync(filePath);
        logger.info(`[Backup] Deleted: file="${filename}"`);
        return true;
    } catch (error) {
        logger.error(`[Backup] Failed to delete: file="${filename}" error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Get total size of all backups
 */
export function getBackupsTotalSize(): number {
    const backups = listBackups();
    return backups.reduce((total, backup) => total + backup.size, 0);
}

/**
 * Cleanup old backups when count exceeds maxBackups
 * Only considers manual and scheduled backups (not safety)
 *
 * @param maxBackups Maximum number of backups to keep
 * @returns Number of backups deleted
 */
export function cleanupOldBackups(maxBackups: number): number {
    ensureBackupsDir();

    // Get all backups, excluding safety backups
    const allBackups = listBackups().filter(b => b.type !== 'safety');

    // Sort by date (oldest first)
    allBackups.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Calculate how many to delete
    const toDelete = Math.max(0, allBackups.length - maxBackups);

    if (toDelete === 0) {
        return 0;
    }

    // Delete oldest backups
    let deleted = 0;
    for (let i = 0; i < toDelete; i++) {
        const backup = allBackups[i];
        try {
            const filePath = path.join(BACKUPS_DIR, backup.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deleted++;
                logger.info(`[Backup] Auto-cleanup: deleted "${backup.filename}" age=${backup.createdAt}`);
            }
        } catch (error) {
            logger.error(`[Backup] Cleanup delete failed: file="${backup.filename}" error="${(error as Error).message}"`);
        }
    }

    logger.info(`[Backup] Auto-cleanup complete: deleted=${deleted} remaining=${allBackups.length - deleted} max=${maxBackups}`);

    return deleted;
}
