/**
 * Framerr Field-Level Encryption Utility
 * 
 * Provides AES-256-GCM encryption for sensitive fields (API keys, tokens, passwords).
 * 
 * Behavior:
 * - Development: Bypasses encryption (plaintext storage for debugging)
 * - Production: Requires SECRET_ENCRYPTION_KEY environment variable
 *   - If missing: Generates key, logs instructions, exits
 *   - If present: Encrypts/decrypts normally
 * 
 * Key format: 64-character hex string (32 bytes)
 * Generate with: openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import logger from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Cached encryption key (validated once at startup)
let encryptionKey: Buffer | null = null;
let keyValidated = false;

/**
 * Get or validate the encryption key.
 * In development mode, returns null (encryption bypassed).
 * In production mode, validates and caches the key.
 */
function getEncryptionKey(): Buffer | null {
    // Development bypass - no encryption needed
    if (isDevelopment) {
        return null;
    }

    // Already validated
    if (keyValidated) {
        return encryptionKey;
    }

    const keyHex = process.env.SECRET_ENCRYPTION_KEY;

    if (!keyHex) {
        // Generate a new key and provide instructions
        const generatedKey = randomBytes(32).toString('hex');

        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.error('');
        logger.error('  ⚠️  SECRET_ENCRYPTION_KEY not found');
        logger.error('');
        logger.error('  Framerr requires an encryption key to protect your integration secrets.');
        logger.error('');
        logger.error('  Generated key (copy this):');
        logger.error(`    ${generatedKey}`);
        logger.error('');
        logger.error('  Add this to your Docker configuration:');
        logger.error('');
        logger.error('  Docker Compose:');
        logger.error('    environment:');
        logger.error(`      - SECRET_ENCRYPTION_KEY=${generatedKey}`);
        logger.error('');
        logger.error('  Docker Run:');
        logger.error(`    -e SECRET_ENCRYPTION_KEY=${generatedKey}`);
        logger.error('');
        logger.error('  Unraid / Portainer:');
        logger.error('    Add environment variable SECRET_ENCRYPTION_KEY with the value above');
        logger.error('');
        logger.error('  ⚠️  SAVE THIS KEY! If you lose it, your integration secrets cannot be recovered.');
        logger.error('');
        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Exit the process - user needs to provide key
        process.exit(1);
    }

    // Validate key format (must be 64 hex characters = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.error('');
        logger.error('  ❌  Invalid SECRET_ENCRYPTION_KEY');
        logger.error('');
        logger.error('  The key must be exactly 64 hexadecimal characters (32 bytes).');
        logger.error(`  Current length: ${keyHex.length} characters`);
        logger.error('');
        logger.error('  Generate a valid key with:');
        logger.error('    openssl rand -hex 32');
        logger.error('');
        logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(1);
    }

    encryptionKey = Buffer.from(keyHex, 'hex');
    keyValidated = true;

    logger.debug('[Encryption] Key validated successfully');
    return encryptionKey;
}

/**
 * Encrypt a plaintext string.
 * 
 * In development mode, returns the plaintext unchanged (for debugging).
 * In production mode, encrypts using AES-256-GCM.
 * 
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded ciphertext (IV + AuthTag + EncryptedData) or plaintext in dev
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();

    // Development bypass - return plaintext
    if (key === null) {
        return plaintext;
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (16 bytes) + AuthTag (16 bytes) + Encrypted Data
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
}

/**
 * Decrypt a ciphertext string.
 * 
 * In development mode, returns the ciphertext unchanged (assumes plaintext storage).
 * In production mode, decrypts using AES-256-GCM.
 * 
 * @param ciphertext - Base64-encoded ciphertext or plaintext in dev
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();

    // Development bypass - return as-is (stored as plaintext)
    if (key === null) {
        return ciphertext;
    }

    try {
        const data = Buffer.from(ciphertext, 'base64');

        // Extract components
        const iv = data.subarray(0, IV_LENGTH);
        const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        logger.error(`[Encryption] Decryption failed: error=\"${(error as Error).message}\"`);

        throw new Error('Failed to decrypt data. The encryption key may have changed.');
    }
}

/**
 * Check if encryption is enabled (production mode with valid key).
 * Useful for logging and debugging.
 */
export function isEncryptionEnabled(): boolean {
    return !isDevelopment && encryptionKey !== null;
}

/**
 * Validate the encryption key without triggering exit.
 * Useful for health checks and startup validation.
 * 
 * @returns true if encryption is properly configured or in dev mode
 */
export function validateEncryptionSetup(): boolean {
    if (isDevelopment) {
        logger.debug('[Encryption] Development mode - encryption bypassed');
        return true;
    }

    const keyHex = process.env.SECRET_ENCRYPTION_KEY;
    if (!keyHex) {
        return false;
    }

    return /^[0-9a-fA-F]{64}$/.test(keyHex);
}

// ============================================================================
// Backup Helpers
// ============================================================================

/**
 * Check if a string looks like AES-256-GCM ciphertext (base64-encoded).
 * Used during backup/restore to detect encrypted vs plaintext configs.
 * 
 * AES-256-GCM ciphertext is base64-encoded and at minimum contains:
 * IV (16 bytes) + AuthTag (16 bytes) + at least 1 byte of data = 33+ bytes
 * In base64, that's at least 44 characters.
 * 
 * Plaintext configs are JSON strings starting with '{'.
 */
export function isLikelyEncrypted(value: string): boolean {
    if (!value || value.length < 44) return false;
    // Plaintext JSON starts with '{' or '[' 
    if (value.startsWith('{') || value.startsWith('[')) return false;
    // Check if it's valid base64 (AES-256-GCM output)
    return /^[A-Za-z0-9+/]+=*$/.test(value);
}

/**
 * Decrypt all integration configs in a standalone database handle.
 * Used during backup to make the backup portable (plaintext configs).
 * 
 * @param db - A better-sqlite3 database instance (NOT the app's live DB)
 */
export function decryptConfigsInDb(db: import('better-sqlite3').Database): number {
    const key = getEncryptionKey();

    // In dev mode, configs are already plaintext — nothing to do
    if (key === null) {
        logger.debug('[Encryption] Dev mode - configs already plaintext, skipping decrypt');
        return 0;
    }

    const rows = db.prepare('SELECT id, config_encrypted FROM integration_instances').all() as Array<{ id: string; config_encrypted: string }>;

    let decrypted = 0;
    const updateStmt = db.prepare('UPDATE integration_instances SET config_encrypted = ? WHERE id = ?');

    const transaction = db.transaction(() => {
        for (const row of rows) {
            if (!row.config_encrypted || !isLikelyEncrypted(row.config_encrypted)) {
                continue; // Already plaintext
            }

            try {
                const plaintext = decrypt(row.config_encrypted);
                updateStmt.run(plaintext, row.id);
                decrypted++;
            } catch (error) {
                logger.warn(`[Encryption] Could not decrypt config for backup: id=${row.id} error="${(error as Error).message}"`);
                // Leave as-is if we can't decrypt (better than losing data)
            }
        }
    });

    transaction();
    logger.info(`[Encryption] Decrypted ${decrypted}/${rows.length} integration configs for backup`);
    return decrypted;
}

/**
 * Encrypt all plaintext integration configs in a standalone database handle.
 * Used during restore to re-encrypt with the new instance's key.
 * 
 * @param db - A better-sqlite3 database instance (NOT the app's live DB)
 */
export function encryptConfigsInDb(db: import('better-sqlite3').Database): number {
    const key = getEncryptionKey();

    // In dev mode, leave as plaintext
    if (key === null) {
        logger.debug('[Encryption] Dev mode - leaving configs as plaintext');
        return 0;
    }

    const rows = db.prepare('SELECT id, config_encrypted FROM integration_instances').all() as Array<{ id: string; config_encrypted: string }>;

    let encrypted = 0;
    const updateStmt = db.prepare('UPDATE integration_instances SET config_encrypted = ? WHERE id = ?');

    const transaction = db.transaction(() => {
        for (const row of rows) {
            if (!row.config_encrypted) continue;

            // If already encrypted (e.g., old backup with same key), skip
            if (isLikelyEncrypted(row.config_encrypted)) {
                logger.debug(`[Encryption] Config already encrypted, skipping: id=${row.id}`);
                continue;
            }

            try {
                // Validate it's valid JSON before encrypting
                JSON.parse(row.config_encrypted);
                const ciphertext = encrypt(row.config_encrypted);
                updateStmt.run(ciphertext, row.id);
                encrypted++;
            } catch (error) {
                logger.warn(`[Encryption] Could not encrypt config during restore: id=${row.id} error="${(error as Error).message}"`);
            }
        }
    });

    transaction();
    logger.info(`[Encryption] Encrypted ${encrypted}/${rows.length} integration configs during restore`);
    return encrypted;
}

