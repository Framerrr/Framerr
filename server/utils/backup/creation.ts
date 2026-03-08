/**
 * Backup Module — Creation
 *
 * Core backup creation logic including database snapshot, asset archiving,
 * and envelope encryption.
 */

import archiver from 'archiver';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough, Readable } from 'stream';
import Database from 'better-sqlite3';
import { getDb } from '../../database/db';
import logger from '../logger';
import { broadcast } from '../../services/sseStreamService';
import { decryptConfigsInDb } from '../encryption';
import { isBackupEncryptionEnabled, getServerMBK, getBackupEncryption } from '../../db/backupEncryption';
import { generateKey, wrapKey, encryptBuffer } from '../backupCrypto';
import { DB_PATH, isDocker, BACKUPS_DIR, getAssetPaths } from './constants';
import { setCurrentBackupId, generateBackupId, broadcastProgress, broadcastComplete, broadcastError } from './progress';
import { ensureBackupsDir } from './storage';
import type { BackupOptions, BackupResult } from './types';

// ============================================================================
// Internal Helpers
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
// Public API
// ============================================================================

/**
 * Create a full system backup
 */
export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const { saveToServer = true, type = 'manual' } = options;
    const startTime = Date.now();
    const backupId = generateBackupId();
    setCurrentBackupId(backupId);

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

        // Step 6: Check encryption status
        const encryptionEnabled = isBackupEncryptionEnabled();

        // Step 6: Add manifest (70%)
        broadcastProgress(backupId, 'Adding manifest...', 70);
        const manifest = {
            version: '2.0',
            type,
            createdAt: new Date().toISOString(),
            encryption: encryptionEnabled ? 'envelope-v1' : 'plaintext',
            purgedOnRestore: [
                'media_library', 'library_sync_status', 'media_cache',
                'media_search_history', 'sessions', 'push_subscriptions',
                'sso_setup_tokens', 'notifications',
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

        // Step 7.5: Encrypt if enabled
        let finalBuffer: Buffer;
        let encrypted = false;

        if (encryptionEnabled) {
            broadcastProgress(backupId, 'Encrypting backup...', 85);
            const mbk = getServerMBK();
            const dek = generateKey();
            const wrappedDek = wrapKey(dek, mbk);
            const { iv: payloadIv, ciphertext, authTag: payloadAuthTag } = encryptBuffer(zipBuffer, dek);

            // Get the password-wrapped MBK from DB for the file header
            const config = getBackupEncryption()!;

            // Build header JSON
            const header = JSON.stringify({
                version: 1,
                kdf: 'pbkdf2-sha256',
                iterations: config.kdfIterations,
                salt: config.kekSalt,
                wrappedMbk: config.mbkPassword,
                wrappedDek: wrappedDek.toString('base64'),
                payloadIv: payloadIv.toString('base64'),
                payloadAuthTag: payloadAuthTag.toString('base64'),
            });

            const headerBuffer = Buffer.from(header, 'utf-8');
            if (headerBuffer.length > 8192) {
                throw new Error(`Encrypted backup header too large: ${headerBuffer.length} bytes (max 8192)`);
            }

            // Build binary file: magic (8) + version (1) + headerLen (2) + header (N) + payload
            const magic = Buffer.from('FRMRBKUP', 'ascii');
            const version = Buffer.from([0x01]);
            const headerLen = Buffer.alloc(2);
            headerLen.writeUInt16LE(headerBuffer.length, 0);

            finalBuffer = Buffer.concat([magic, version, headerLen, headerBuffer, ciphertext]);
            encrypted = true;

            logger.info(`[Backup] Encrypted: plainSize=${zipBuffer.length} encryptedSize=${finalBuffer.length}`);
        } else {
            finalBuffer = zipBuffer;
        }

        // Generate filename with local timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const extension = encrypted ? 'framerr-backup' : 'zip';
        const filename = `framerr-${type}-${timestamp}.${extension}`;

        // Step 8: Save to server (90%)
        let savedToServer = false;
        if (saveToServer) {
            broadcastProgress(backupId, 'Saving to server...', 90);
            ensureBackupsDir();
            const filePath = path.join(BACKUPS_DIR, filename);
            fs.writeFileSync(filePath, finalBuffer);
            savedToServer = true;
            logger.debug(`[Backup] Saved to server: path=${filePath}`);
        }

        // Complete (100%)
        broadcastProgress(backupId, 'Complete!', 100);
        broadcastComplete(backupId, filename, finalBuffer.length);

        const elapsed = Date.now() - startTime;
        logger.info(`[Backup] Complete: file=${filename} size=${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB encrypted=${encrypted}`);
        logger.debug(`[Backup] Stats: elapsed=${elapsed}ms savedToServer=${savedToServer}`);

        setCurrentBackupId(null);

        return {
            stream: saveToServer ? undefined : Readable.from(finalBuffer),
            filename,
            size: finalBuffer.length,
            savedToServer,
            encrypted
        };

    } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`[Backup] Failed: error="${errorMessage}"`);
        broadcastError(backupId, errorMessage);
        setCurrentBackupId(null);
        throw error;
    }
}
