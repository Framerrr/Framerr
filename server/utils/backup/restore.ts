/**
 * Backup Module — Restore
 *
 * Restore validation and extraction logic.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import logger from '../logger';
import { encryptConfigsInDb } from '../encryption';
import { DATA_DIR, DB_PATH, getAssetPaths } from './constants';
import type { RestoreValidationResult } from './types';

// ============================================================================
// Internal Helpers
// ============================================================================

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
            'sso_setup_tokens',
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

        // Step 3: Clean up cached image files (orphaned after DB purge)
        // These directories contain images from the previous system that are no longer referenced
        const cacheDirsToClean = [
            path.join(DATA_DIR, 'cache', 'library'),  // Library sync thumbnails
            path.join(DATA_DIR, 'cache', 'images'),    // TMDB poster cache
        ];
        for (const dir of cacheDirsToClean) {
            try {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true });
                    logger.info(`[Restore] Deleted cache directory: ${dir}`);
                }
            } catch (error) {
                logger.warn(`[Restore] Failed to delete cache directory: dir="${dir}" error="${(error as Error).message}"`);
            }
        }

        logger.info('[Restore] Post-restore processing complete');
    } finally {
        restoredDb.close();
    }
}

// ============================================================================
// Public API
// ============================================================================

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
