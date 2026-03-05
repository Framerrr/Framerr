/**
 * Backup Encryption Database Module
 *
 * Manages the singleton backup_encryption table for Master Backup Key (MBK) storage.
 * Follows the single-row (id = 1) pattern from oidcConfig.ts.
 *
 * The MBK is wrapped (encrypted) two ways:
 * 1. By password-derived KEK — for user-initiated decryption (restore)
 * 2. By server key — for automatic encryption (scheduled backups)
 */

import { getDb } from '../database/db';
import {
    deriveKEK,
    generateKey,
    generateSalt,
    wrapKey,
    unwrapKey,
    getServerWrappingKey,
    CRYPTO_CONSTANTS,
} from '../utils/backupCrypto';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface BackupEncryptionRow {
    id: number;
    enabled: number;
    mbk_password: string;   // Base64: MBK wrapped by password-derived KEK
    mbk_server: string;     // Base64: MBK wrapped by server key
    kek_salt: string;       // Base64: PBKDF2 salt
    kdf_iterations: number;
    created_at: string;
    updated_at: string;
}

export interface BackupEncryptionConfig {
    enabled: boolean;
    mbkPassword: string;    // Base64-encoded wrapped MBK (by KEK)
    mbkServer: string;      // Base64-encoded wrapped MBK (by server key)
    kekSalt: string;        // Base64-encoded salt
    kdfIterations: number;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Read the backup encryption config row.
 * Returns null if encryption has never been enabled.
 */
export function getBackupEncryption(): BackupEncryptionConfig | null {
    const row = getDb().prepare(
        'SELECT * FROM backup_encryption WHERE id = 1'
    ).get() as BackupEncryptionRow | undefined;

    if (!row) return null;

    return {
        enabled: row.enabled === 1,
        mbkPassword: row.mbk_password,
        mbkServer: row.mbk_server,
        kekSalt: row.kek_salt,
        kdfIterations: row.kdf_iterations,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Quick boolean check: is backup encryption currently enabled?
 */
export function isBackupEncryptionEnabled(): boolean {
    try {
        const row = getDb().prepare(
            'SELECT enabled FROM backup_encryption WHERE id = 1'
        ).get() as { enabled: number } | undefined;

        return row?.enabled === 1;
    } catch {
        return false;
    }
}

/**
 * Enable backup encryption with a new password.
 *
 * Generates a fresh MBK, wraps it with:
 * 1. Password-derived KEK (for user decryption)
 * 2. Server key (for automatic encryption)
 *
 * @param password - User-chosen backup password (min 8 chars enforced by route)
 * @throws Error if SECRET_ENCRYPTION_KEY is not set
 * @throws Error if encryption is already enabled
 */
export function enableBackupEncryption(password: string): void {
    // Verify server key is available BEFORE doing anything
    const serverKey = getServerWrappingKey();

    // Check if already enabled
    const existing = getDb().prepare(
        'SELECT id FROM backup_encryption WHERE id = 1'
    ).get();

    if (existing) {
        throw new Error('Backup encryption is already enabled');
    }

    // Generate crypto materials
    const mbk = generateKey();
    const salt = generateSalt();
    const kek = deriveKEK(password, salt, CRYPTO_CONSTANTS.PBKDF2_ITERATIONS);

    // Wrap MBK two ways
    const wrappedByPassword = wrapKey(mbk, kek);
    const wrappedByServer = wrapKey(mbk, serverKey);

    // Store as base64
    getDb().prepare(`
        INSERT INTO backup_encryption (id, enabled, mbk_password, mbk_server, kek_salt, kdf_iterations)
        VALUES (1, 1, ?, ?, ?, ?)
    `).run(
        wrappedByPassword.toString('base64'),
        wrappedByServer.toString('base64'),
        salt.toString('base64'),
        CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    logger.info('[BackupEncryption] Encryption enabled — MBK generated and stored');
}

/**
 * Disable backup encryption after verifying the password.
 *
 * Deletes the encryption config row. Existing encrypted backups remain
 * encrypted — they can still be restored with the original password.
 *
 * @param password - Current backup password for verification
 * @throws Error if encryption is not enabled
 * @throws Error if password is incorrect
 */
export function disableBackupEncryption(password: string): void {
    const config = getBackupEncryption();
    if (!config) {
        throw new Error('Backup encryption is not enabled');
    }

    // Verify password by trying to unwrap MBK
    const salt = Buffer.from(config.kekSalt, 'base64');
    const kek = deriveKEK(password, salt, config.kdfIterations);
    const wrappedMbk = Buffer.from(config.mbkPassword, 'base64');

    try {
        unwrapKey(wrappedMbk, kek);
    } catch {
        throw new Error('Incorrect password');
    }

    // Password verified — delete the config row
    getDb().prepare('DELETE FROM backup_encryption WHERE id = 1').run();

    logger.info('[BackupEncryption] Encryption disabled — MBK deleted');
}

/**
 * Change the backup encryption password.
 *
 * Unwraps MBK with old password, re-wraps with new password.
 * The MBK itself doesn't change — only the password wrapping.
 * Server-wrapped MBK is unchanged.
 *
 * @param oldPassword - Current backup password
 * @param newPassword - New backup password (min 8 chars enforced by route)
 * @throws Error if encryption is not enabled
 * @throws Error if old password is incorrect
 */
export function changeBackupPassword(oldPassword: string, newPassword: string): void {
    const config = getBackupEncryption();
    if (!config) {
        throw new Error('Backup encryption is not enabled');
    }

    // Unwrap MBK with old password
    const oldSalt = Buffer.from(config.kekSalt, 'base64');
    const oldKek = deriveKEK(oldPassword, oldSalt, config.kdfIterations);
    const wrappedMbk = Buffer.from(config.mbkPassword, 'base64');

    let mbk: Buffer;
    try {
        mbk = unwrapKey(wrappedMbk, oldKek);
    } catch {
        throw new Error('Incorrect current password');
    }

    // Re-wrap MBK with new password
    const newSalt = generateSalt();
    const newKek = deriveKEK(newPassword, newSalt, CRYPTO_CONSTANTS.PBKDF2_ITERATIONS);
    const newWrappedMbk = wrapKey(mbk, newKek);

    // Update DB
    getDb().prepare(`
        UPDATE backup_encryption SET
            mbk_password = ?,
            kek_salt = ?,
            kdf_iterations = ?,
            updated_at = datetime('now')
        WHERE id = 1
    `).run(
        newWrappedMbk.toString('base64'),
        newSalt.toString('base64'),
        CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    logger.info('[BackupEncryption] Password changed — MBK re-wrapped with new KEK');
}

/**
 * Get the MBK by unwrapping it with the server key.
 * Used for automatic encryption (scheduled backups, manual backups).
 *
 * @returns The unwrapped MBK buffer (32 bytes)
 * @throws Error if encryption is not enabled
 * @throws Error if server key decryption fails
 */
export function getServerMBK(): Buffer {
    const config = getBackupEncryption();
    if (!config || !config.enabled) {
        throw new Error('Backup encryption is not enabled');
    }

    const serverKey = getServerWrappingKey();
    const wrappedMbk = Buffer.from(config.mbkServer, 'base64');

    return unwrapKey(wrappedMbk, serverKey);
}
