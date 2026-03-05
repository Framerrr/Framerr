/**
 * Backup Encryption Crypto Module
 *
 * Standalone crypto primitives for Framerr backup encryption.
 * Uses envelope encryption: Password → KEK → wraps MBK → wraps DEK → encrypts payload.
 *
 * IMPORTANT: This module is intentionally separate from encryption.ts.
 * - No dev-mode bypass (always real crypto, even in development)
 * - Own key resolution (reads SECRET_ENCRYPTION_KEY directly)
 * - Never imports encrypt/decrypt from encryption.ts
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;          // GCM standard: 12 bytes
const AUTH_TAG_LENGTH = 16;    // GCM: 16 bytes
const KEY_LENGTH = 32;         // AES-256: 32 bytes
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_DIGEST = 'sha256';
const SALT_LENGTH = 32;

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive a Key Encryption Key (KEK) from a user password using PBKDF2-SHA256.
 *
 * @param password - User-provided backup password
 * @param salt - Random salt (32 bytes). Generate with `crypto.randomBytes(32)`.
 * @param iterations - PBKDF2 iteration count (default: 600,000)
 * @returns 32-byte KEK buffer
 */
export function deriveKEK(password: string, salt: Buffer, iterations: number = PBKDF2_ITERATIONS): Buffer {
    return pbkdf2Sync(password, salt, iterations, KEY_LENGTH, PBKDF2_DIGEST);
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a cryptographically random 32-byte key.
 * Used for MBK (Master Backup Key) and DEK (Data Encryption Key).
 */
export function generateKey(): Buffer {
    return randomBytes(KEY_LENGTH);
}

/**
 * Generate a random salt for PBKDF2 key derivation.
 */
export function generateSalt(): Buffer {
    return randomBytes(SALT_LENGTH);
}

// ============================================================================
// Key Wrapping (AES-256-GCM)
// ============================================================================

/**
 * Wrap (encrypt) a key with another key using AES-256-GCM.
 * Returns a self-contained blob: IV (12B) + ciphertext + authTag (16B).
 *
 * @param key - The key to wrap (e.g., MBK or DEK)
 * @param wrappingKey - The key to wrap with (e.g., KEK or server key)
 * @returns Buffer containing IV + ciphertext + authTag
 */
export function wrapKey(key: Buffer, wrappingKey: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, wrappingKey, iv);

    const encrypted = Buffer.concat([
        cipher.update(key),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Self-contained: IV + ciphertext + authTag
    return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Unwrap (decrypt) a key using AES-256-GCM.
 * Expects the blob format from wrapKey: IV (12B) + ciphertext + authTag (16B).
 *
 * @param wrapped - The wrapped key blob
 * @param wrappingKey - The key used for wrapping
 * @returns The unwrapped key buffer
 * @throws Error if decryption fails (wrong key, tampered data)
 */
export function unwrapKey(wrapped: Buffer, wrappingKey: Buffer): Buffer {
    if (wrapped.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        throw new Error('Invalid wrapped key: too short');
    }

    const iv = wrapped.subarray(0, IV_LENGTH);
    const authTag = wrapped.subarray(wrapped.length - AUTH_TAG_LENGTH);
    const encrypted = wrapped.subarray(IV_LENGTH, wrapped.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, wrappingKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted;
}

// ============================================================================
// Payload Encryption (AES-256-GCM)
// ============================================================================

/**
 * Encrypt a buffer (backup payload) with a DEK using AES-256-GCM.
 * Returns { iv, ciphertext, authTag } as separate fields because the payload
 * auth tag is stored in the file header, not concatenated with the ciphertext.
 *
 * @param data - The plaintext buffer to encrypt
 * @param key - The DEK (32 bytes)
 * @returns Object with iv, ciphertext, and authTag buffers
 */
export function encryptBuffer(data: Buffer, key: Buffer): {
    iv: Buffer;
    ciphertext: Buffer;
    authTag: Buffer;
} {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(data),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return { iv, ciphertext, authTag };
}

/**
 * Decrypt a buffer (backup payload) using AES-256-GCM.
 *
 * @param ciphertext - The encrypted data
 * @param key - The DEK (32 bytes)
 * @param iv - The initialization vector (12 bytes)
 * @param authTag - The GCM authentication tag (16 bytes)
 * @returns The decrypted plaintext buffer
 * @throws Error if decryption fails (wrong key, tampered data)
 */
export function decryptBuffer(
    ciphertext: Buffer,
    key: Buffer,
    iv: Buffer,
    authTag: Buffer,
): Buffer {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted;
}

// ============================================================================
// Server Key Resolution
// ============================================================================

/**
 * Get the 32-byte server wrapping key from the SECRET_ENCRYPTION_KEY env var.
 *
 * IMPORTANT: This does NOT follow encryption.ts's dev-mode bypass.
 * Backup encryption always uses real crypto. If SECRET_ENCRYPTION_KEY is not set,
 * this function throws — callers must check before enabling encryption.
 *
 * @returns 32-byte Buffer from the hex-encoded env var
 * @throws Error if SECRET_ENCRYPTION_KEY is not set or invalid format
 */
export function getServerWrappingKey(): Buffer {
    const keyHex = process.env.SECRET_ENCRYPTION_KEY;

    if (!keyHex) {
        throw new Error(
            'SECRET_ENCRYPTION_KEY environment variable is required for backup encryption. '
            + 'Generate one with: openssl rand -hex 32'
        );
    }

    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
        throw new Error(
            'SECRET_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).'
        );
    }

    return Buffer.from(keyHex, 'hex');
}

// ============================================================================
// Exported Constants (for tests and DB layer)
// ============================================================================

export const CRYPTO_CONSTANTS = {
    IV_LENGTH,
    AUTH_TAG_LENGTH,
    KEY_LENGTH,
    SALT_LENGTH,
    PBKDF2_ITERATIONS,
    PBKDF2_DIGEST,
} as const;
