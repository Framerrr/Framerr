/**
 * Backup Utility
 * 
 * Creates ZIP backups of Framerr system (database + assets).
 * Supports server-side storage and progress broadcasting.
 */

import archiver from 'archiver';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough, Readable } from 'stream';
import Database from 'better-sqlite3';
import { getDb } from '../database/db';
import logger from './logger';
import { broadcast } from '../services/sseStreamService';
import { decryptConfigsInDb, encryptConfigsInDb } from './encryption';

// Environment paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.FRAMERR_DB_PATH || path.join(DATA_DIR, 'framerr.db');

// Backup storage directory
const DOCKER_CONFIG = '/config';
const isDocker = fs.existsSync(DOCKER_CONFIG);
export const BACKUPS_DIR = isDocker
    ? path.join(DOCKER_CONFIG, 'backups')
    : path.join(DATA_DIR, 'backups');

// Asset directories (relative to DATA_DIR or Docker paths)
function getAssetPaths() {
    const base = isDocker ? DOCKER_CONFIG : DATA_DIR;
    return {
        profilePictures: isDocker
            ? path.join(DOCKER_CONFIG, 'upload', 'profile-pictures')
            : path.join(__dirname, '..', 'public', 'profile-pictures'),
        customIcons: isDocker
            ? path.join(DOCKER_CONFIG, 'upload', 'custom-icons')
            : path.join(DATA_DIR, 'upload', 'custom-icons'),
        favicon: path.join(base, 'public', 'favicon')
    };
}

// ============================================================================
// Types
// ============================================================================

export interface BackupOptions {
    saveToServer?: boolean;
    type?: 'manual' | 'scheduled' | 'safety';
}

export interface BackupResult {
    stream?: Readable;
    filename: string;
    size: number;
    savedToServer: boolean;
}

export interface BackupInfo {
    filename: string;
    type: 'manual' | 'scheduled' | 'safety';
    size: number;
    createdAt: string;
}

export interface BackupProgress {
    id: string;
    step: string;
    percent: number;
}

// ============================================================================
// Progress Broadcasting
// ============================================================================

let currentBackupId: string | null = null;

function generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function broadcastProgress(id: string, step: string, percent: number): void {
    broadcast('backup:progress', { id, step, percent });
}

function broadcastComplete(id: string, filename: string, size: number): void {
    broadcast('backup:complete', { id, filename, size });
}

function broadcastError(id: string, error: string): void {
    broadcast('backup:error', { id, error });
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Checkpoint WAL to ensure database is consistent
 */
function checkpointDatabase(): void {
    try {
        getDb().pragma('wal_checkpoint(TRUNCATE)');
        logger.debug('[Backup] WAL checkpoint complete');
    } catch (error) {
        logger.warn(`[Backup] WAL checkpoint failed, proceeding: error="${(error as Error).message}"`);
    }
}

// ============================================================================
// Backup Storage Functions
// ============================================================================

/**
 * Ensure backups directory exists
 */
function ensureBackupsDir(): void {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        logger.info(`[Backup] Created backups directory: path=${BACKUPS_DIR}`);
    }
}

/**
 * Parse backup filename to extract type and timestamp
 */
function parseBackupFilename(filename: string): { type: 'manual' | 'scheduled' | 'safety'; timestamp: string } | null {
    // Format: framerr-{type}-{timestamp}.zip
    const match = filename.match(/^framerr-(manual|scheduled|safety)-(.+)\.zip$/);
    if (!match) return null;
    return {
        type: match[1] as 'manual' | 'scheduled' | 'safety',
        timestamp: match[2]
    };
}

/**
 * List all backups in the backups directory
 */
export function listBackups(): BackupInfo[] {
    ensureBackupsDir();

    try {
        const files = fs.readdirSync(BACKUPS_DIR);
        const backups: BackupInfo[] = [];

        for (const filename of files) {
            if (!filename.endsWith('.zip')) continue;

            const parsed = parseBackupFilename(filename);
            if (!parsed) continue;

            const filePath = path.join(BACKUPS_DIR, filename);
            const stats = fs.statSync(filePath);

            backups.push({
                filename,
                type: parsed.type,
                size: stats.size,
                // Use mtime instead of birthtime - birthtime is unreliable on Docker/Linux
                createdAt: stats.mtime.toISOString()
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
    // Security: prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        logger.warn(`[Backup] Invalid filename (path traversal): file="${filename}"`);
        return null;
    }

    if (!filename.endsWith('.zip')) {
        logger.warn(`[Backup] Invalid filename (not zip): file="${filename}"`);
        return null;
    }

    const filePath = path.join(BACKUPS_DIR, filename);

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

// ============================================================================
// Backup Creation
// ============================================================================

/**
 * Create a full system backup
 */
export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const { saveToServer = true, type = 'manual' } = options;
    const startTime = Date.now();
    const backupId = generateBackupId();
    currentBackupId = backupId;

    logger.info(`[Backup] Creating backup: type=${type}`);
    logger.debug(`[Backup] Config: id=${backupId} saveToServer=${saveToServer} docker=${isDocker}`);

    // Broadcast start
    broadcast('backup:started', { id: backupId, type });

    try {
        // Step 1: Checkpoint WAL (10%)
        broadcastProgress(backupId, 'Preparing database...', 10);
        checkpointDatabase();

        // Step 2: Verify DB exists (15%)
        broadcastProgress(backupId, 'Checking database...', 15);
        if (!fs.existsSync(DB_PATH)) {
            throw new Error(`Database file not found at: ${DB_PATH}`);
        }
        const dbStats = fs.statSync(DB_PATH);
        logger.debug(`[Backup] Database found: size=${(dbStats.size / 1024 / 1024).toFixed(2)}MB`);

        // Step 3: Create archive (20%)
        broadcastProgress(backupId, 'Creating archive...', 20);
        const archive = archiver('zip', { zlib: { level: 6 } });
        const chunks: Buffer[] = [];

        archive.on('warning', (err) => {
            logger.warn(`[Backup] Archive warning: error="${err.message}"`);
        });
        archive.on('error', (err) => {
            logger.error(`[Backup] Archive error: error="${err.message}"`);
            throw err;
        });

        // Collect archive data via promise
        const archiveComplete = new Promise<Buffer>((resolve, reject) => {
            const passthrough = new PassThrough();

            passthrough.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            passthrough.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            passthrough.on('error', (err) => {
                reject(err);
            });

            archive.pipe(passthrough);
        });

        // Step 4: Add database with decrypted configs (40%)
        broadcastProgress(backupId, 'Adding database...', 40);
        const dbBuffer = fs.readFileSync(DB_PATH);

        // Decrypt integration configs for portability
        // Write to temp file, open with better-sqlite3, decrypt, read back
        const tmpDbPath = path.join(os.tmpdir(), `framerr-backup-${Date.now()}.db`);
        try {
            fs.writeFileSync(tmpDbPath, dbBuffer);
            const tmpDb = new Database(tmpDbPath);
            try {
                decryptConfigsInDb(tmpDb);
            } finally {
                tmpDb.close();
            }
            const portableDbBuffer = fs.readFileSync(tmpDbPath);
            archive.append(portableDbBuffer, { name: 'framerr.db' });
            logger.debug(`[Backup] Database added (configs decrypted): size=${portableDbBuffer.length}`);
        } finally {
            // Clean up temp file
            if (fs.existsSync(tmpDbPath)) {
                fs.unlinkSync(tmpDbPath);
            }
        }

        // Step 5: Add assets (60%)
        broadcastProgress(backupId, 'Adding assets...', 60);
        const assets = getAssetPaths();

        if (fs.existsSync(assets.profilePictures)) {
            const files = fs.readdirSync(assets.profilePictures);
            archive.directory(assets.profilePictures, 'profile-pictures');
            logger.debug(`[Backup] Added profile pictures: count=${files.length}`);
        }

        if (fs.existsSync(assets.customIcons)) {
            const files = fs.readdirSync(assets.customIcons);
            archive.directory(assets.customIcons, 'custom-icons');
            logger.debug(`[Backup] Added custom icons: count=${files.length}`);
        }

        if (fs.existsSync(assets.favicon)) {
            const files = fs.readdirSync(assets.favicon);
            archive.directory(assets.favicon, 'favicon');
            logger.debug(`[Backup] Added favicon: count=${files.length}`);
        }

        // Step 6: Add manifest (70%)
        broadcastProgress(backupId, 'Adding manifest...', 70);
        const manifest = {
            version: '2.0',
            type,
            createdAt: new Date().toISOString(),
            encryption: 'plaintext',
            purgedOnRestore: [
                'media_library', 'library_sync_status', 'media_cache',
                'media_search_history', 'sessions', 'push_subscriptions',
                'plex_setup_tokens', 'notifications',
                'service_monitor_history', 'service_monitor_aggregates'
            ],
            assets: {
                profilePictures: fs.existsSync(assets.profilePictures),
                customIcons: fs.existsSync(assets.customIcons),
                favicon: fs.existsSync(assets.favicon)
            }
        };
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        // Step 7: Finalize (80%)
        broadcastProgress(backupId, 'Finalizing...', 80);
        await archive.finalize();

        // Wait for all data to be collected
        const zipBuffer = await archiveComplete;
        logger.info(`[Backup] Archive complete: size=${zipBuffer.length} sizeMB=${(zipBuffer.length / 1024 / 1024).toFixed(2)}`);

        // Generate filename with local timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `framerr-${type}-${timestamp}.zip`;

        // Step 8: Save to server (90%)
        let savedToServer = false;
        if (saveToServer) {
            broadcastProgress(backupId, 'Saving to server...', 90);
            ensureBackupsDir();
            const filePath = path.join(BACKUPS_DIR, filename);
            fs.writeFileSync(filePath, zipBuffer);
            savedToServer = true;
            logger.debug(`[Backup] Saved to server: path=${filePath}`);
        }

        // Complete (100%)
        broadcastProgress(backupId, 'Complete!', 100);
        broadcastComplete(backupId, filename, zipBuffer.length);

        const elapsed = Date.now() - startTime;
        logger.info(`[Backup] Complete: file=${filename} size=${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB`);
        logger.debug(`[Backup] Stats: elapsed=${elapsed}ms savedToServer=${savedToServer}`);

        currentBackupId = null;

        return {
            stream: saveToServer ? undefined : Readable.from(zipBuffer),
            filename,
            size: zipBuffer.length,
            savedToServer
        };

    } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`[Backup] Failed: error="${errorMessage}"`);
        broadcastError(backupId, errorMessage);
        currentBackupId = null;
        throw error;
    }
}

/**
 * Check if a backup is currently in progress
 */
export function isBackupInProgress(): boolean {
    return currentBackupId !== null;
}

/**
 * Get current backup ID if one is in progress
 */
export function getCurrentBackupId(): string | null {
    return currentBackupId;
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

// ============================================================================
// Restore Functions
// ============================================================================

export interface RestoreValidationResult {
    valid: boolean;
    error?: string;
    manifest?: {
        version: string;
        type: string;
        createdAt: string;
        assets: {
            profilePictures: boolean;
            customIcons: boolean;
            favicon: boolean;
        };
    };
}

/**
 * Validate a backup ZIP file
 * Checks for required files: manifest.json and framerr.db
 */
export async function validateBackupZip(zipPath: string): Promise<RestoreValidationResult> {
    const unzipper = await import('unzipper');

    return new Promise((resolve) => {
        let hasManifest = false;
        let hasDatabase = false;
        let manifest: RestoreValidationResult['manifest'];

        fs.createReadStream(zipPath)
            .pipe(unzipper.Parse())
            .on('entry', async (entry: { path: string; type: string; autodrain: () => void; buffer: () => Promise<Buffer> }) => {
                const fileName = entry.path;

                if (fileName === 'manifest.json') {
                    hasManifest = true;
                    try {
                        const content = await entry.buffer();
                        manifest = JSON.parse(content.toString());
                    } catch {
                        // Invalid JSON, will fail validation
                    }
                } else if (fileName === 'framerr.db') {
                    hasDatabase = true;
                    entry.autodrain();
                } else {
                    entry.autodrain();
                }
            })
            .on('close', () => {
                if (!hasDatabase) {
                    resolve({ valid: false, error: 'Backup is missing database file (framerr.db)' });
                } else if (!hasManifest) {
                    resolve({ valid: false, error: 'Backup is missing manifest file' });
                } else if (!manifest) {
                    resolve({ valid: false, error: 'Invalid manifest file format' });
                } else {
                    resolve({ valid: true, manifest });
                }
            })
            .on('error', (err: Error) => {
                resolve({ valid: false, error: `Invalid ZIP file: ${err.message}` });
            });
    });
}

/**
 * Post-restore processing: re-encrypt configs and purge stale data.
 * Called after the backup DB file has been written to disk.
 */
async function postRestoreProcessing(): Promise<void> {
    logger.info('[Restore] Starting post-restore processing...');

    const restoredDb = new Database(DB_PATH);

    try {
        // Step 1: Re-encrypt integration configs with this instance's key
        logger.info('[Restore] Re-encrypting integration configs...');
        const encrypted = encryptConfigsInDb(restoredDb);
        logger.info(`[Restore] Re-encrypted ${encrypted} integration configs`);

        // Step 2: Purge instance-specific and cache tables
        logger.info('[Restore] Purging stale data...');

        const tablesToPurge = [
            'media_library',
            'library_sync_status',
            'media_cache',
            'media_search_history',
            'sessions',
            'push_subscriptions',
            'plex_setup_tokens',
            'notifications',
            'service_monitor_history',
            'service_monitor_aggregates',
        ];

        const purgeTransaction = restoredDb.transaction(() => {
            for (const table of tablesToPurge) {
                try {
                    const result = restoredDb.prepare(`DELETE FROM ${table}`).run();
                    if (result.changes > 0) {
                        logger.info(`[Restore] Purged ${table}: ${result.changes} rows`);
                    }
                } catch (error) {
                    // Table might not exist in older backups — skip gracefully
                    logger.debug(`[Restore] Could not purge ${table}: ${(error as Error).message}`);
                }
            }

            // Rebuild FTS index after purging media_library
            try {
                restoredDb.exec("INSERT INTO media_library_fts(media_library_fts) VALUES('rebuild')");
                logger.info('[Restore] FTS index rebuilt');
            } catch (error) {
                logger.debug(`[Restore] FTS rebuild skipped: ${(error as Error).message}`);
            }
        });

        purgeTransaction();
        logger.info('[Restore] Post-restore processing complete');
    } finally {
        restoredDb.close();
    }
}

/**
 * Extract a backup ZIP and restore database + assets
 * WARNING: This replaces the current database and assets!
 */
export async function extractBackup(zipPath: string): Promise<void> {
    const unzipper = await import('unzipper');
    const assets = getAssetPaths();

    logger.info(`[Restore] Starting extraction: zipPath="${zipPath}"`);

    return new Promise((resolve, reject) => {
        fs.createReadStream(zipPath)
            .pipe(unzipper.Parse())
            .on('entry', async (entry: { path: string; type: string; autodrain: () => void; buffer: () => Promise<Buffer> }) => {
                const fileName = entry.path;
                const entryType = entry.type;

                try {
                    if (fileName === 'framerr.db') {
                        // Delete WAL mode files first - these contain stale data from the old database
                        // If we don't delete them, SQLite will read from them instead of the new .db file
                        const walPath = DB_PATH + '-wal';
                        const shmPath = DB_PATH + '-shm';
                        if (fs.existsSync(walPath)) {
                            fs.unlinkSync(walPath);
                            logger.info('[Restore] Deleted old WAL file');
                        }
                        if (fs.existsSync(shmPath)) {
                            fs.unlinkSync(shmPath);
                            logger.info('[Restore] Deleted old SHM file');
                        }

                        // Replace database
                        const dbContent = await entry.buffer();
                        fs.writeFileSync(DB_PATH, dbContent);
                        logger.info(`[Restore] Database restored: size=${dbContent.length}`);
                    } else if (fileName === 'manifest.json') {
                        // Skip manifest, we already validated it
                        entry.autodrain();
                    } else if (fileName.startsWith('profile-pictures/') && entryType === 'File') {
                        // Restore profile picture
                        const destPath = path.join(assets.profilePictures, path.basename(fileName));
                        if (!fs.existsSync(assets.profilePictures)) {
                            fs.mkdirSync(assets.profilePictures, { recursive: true });
                        }
                        const content = await entry.buffer();
                        fs.writeFileSync(destPath, content);
                    } else if (fileName.startsWith('custom-icons/') && entryType === 'File') {
                        // Restore custom icon
                        const destPath = path.join(assets.customIcons, path.basename(fileName));
                        if (!fs.existsSync(assets.customIcons)) {
                            fs.mkdirSync(assets.customIcons, { recursive: true });
                        }
                        const content = await entry.buffer();
                        fs.writeFileSync(destPath, content);
                    } else if (fileName.startsWith('favicon/') && entryType === 'File') {
                        // Restore favicon
                        const destPath = path.join(assets.favicon, path.basename(fileName));
                        if (!fs.existsSync(assets.favicon)) {
                            fs.mkdirSync(assets.favicon, { recursive: true });
                        }
                        const content = await entry.buffer();
                        fs.writeFileSync(destPath, content);
                    } else {
                        entry.autodrain();
                    }
                } catch (error) {
                    logger.error(`[Restore] Error processing entry: file="${fileName}" error="${(error as Error).message}"`);
                    entry.autodrain();
                }
            })
            .on('close', async () => {
                try {
                    // Post-restore: re-encrypt configs and purge stale data
                    await postRestoreProcessing();
                    logger.info('[Restore] Backup extraction and processing complete');
                    resolve();
                } catch (error) {
                    logger.error(`[Restore] Post-restore processing failed: error="${(error as Error).message}"`);
                    // Still resolve — DB is restored, just processing failed
                    resolve();
                }
            })
            .on('error', (err: Error) => {
                logger.error(`[Restore] Extraction failed: error="${err.message}"`);
                reject(new Error(`Failed to extract backup: ${err.message}`));
            });
    });
}

