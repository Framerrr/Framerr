/**
 * Backup Crypto Module — Unit Tests
 *
 * Tests all crypto primitives: key derivation, key wrapping, payload encryption,
 * and server key resolution. Pure crypto tests — no DB, no mocking needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    deriveKEK,
    generateKey,
    generateSalt,
    wrapKey,
    unwrapKey,
    encryptBuffer,
    decryptBuffer,
    getServerWrappingKey,
    CRYPTO_CONSTANTS,
} from '../utils/backupCrypto';

// ============================================================================
// deriveKEK
// ============================================================================

describe('deriveKEK', () => {
    it('produces deterministic output for same password + salt', () => {
        const password = 'test-password-123';
        const salt = Buffer.alloc(32, 0xAB); // Fixed salt for determinism

        const kek1 = deriveKEK(password, salt);
        const kek2 = deriveKEK(password, salt);

        expect(kek1).toEqual(kek2);
        expect(kek1.length).toBe(32);
    });

    it('produces different output for different passwords', () => {
        const salt = generateSalt();

        const kek1 = deriveKEK('password-one', salt);
        const kek2 = deriveKEK('password-two', salt);

        expect(kek1).not.toEqual(kek2);
    });

    it('produces different output for different salts', () => {
        const password = 'same-password';

        const kek1 = deriveKEK(password, generateSalt());
        const kek2 = deriveKEK(password, generateSalt());

        expect(kek1).not.toEqual(kek2);
    });
});

// ============================================================================
// generateKey / generateSalt
// ============================================================================

describe('generateKey', () => {
    it('produces 32-byte random buffers', () => {
        const key = generateKey();
        expect(key.length).toBe(CRYPTO_CONSTANTS.KEY_LENGTH);
        expect(Buffer.isBuffer(key)).toBe(true);
    });

    it('produces unique keys on each call', () => {
        const key1 = generateKey();
        const key2 = generateKey();
        expect(key1).not.toEqual(key2);
    });
});

// ============================================================================
// wrapKey / unwrapKey
// ============================================================================

describe('wrapKey / unwrapKey', () => {
    it('round-trip succeeds with correct key', () => {
        const key = generateKey();          // Key to wrap (e.g., MBK)
        const wrappingKey = generateKey();  // Wrapping key (e.g., KEK)

        const wrapped = wrapKey(key, wrappingKey);
        const unwrapped = unwrapKey(wrapped, wrappingKey);

        expect(unwrapped).toEqual(key);
    });

    it('wrapped blob contains IV + ciphertext + authTag', () => {
        const key = generateKey();
        const wrappingKey = generateKey();

        const wrapped = wrapKey(key, wrappingKey);

        // IV (12) + encrypted 32-byte key + authTag (16) = 60 bytes minimum
        expect(wrapped.length).toBeGreaterThanOrEqual(
            CRYPTO_CONSTANTS.IV_LENGTH + CRYPTO_CONSTANTS.KEY_LENGTH + CRYPTO_CONSTANTS.AUTH_TAG_LENGTH
        );
    });

    it('fails to unwrap with wrong key', () => {
        const key = generateKey();
        const wrappingKey = generateKey();
        const wrongKey = generateKey();

        const wrapped = wrapKey(key, wrappingKey);

        expect(() => unwrapKey(wrapped, wrongKey)).toThrow();
    });

    it('rejects too-short wrapped blobs', () => {
        const wrappingKey = generateKey();
        const tooShort = Buffer.alloc(10);

        expect(() => unwrapKey(tooShort, wrappingKey)).toThrow('Invalid wrapped key: too short');
    });
});

// ============================================================================
// encryptBuffer / decryptBuffer
// ============================================================================

describe('encryptBuffer / decryptBuffer', () => {
    it('round-trip succeeds', () => {
        const data = Buffer.from('Hello, Framerr backup! 🔐 This is test data.');
        const dek = generateKey();

        const { iv, ciphertext, authTag } = encryptBuffer(data, dek);
        const decrypted = decryptBuffer(ciphertext, dek, iv, authTag);

        expect(decrypted).toEqual(data);
    });

    it('returns separate iv, ciphertext, and authTag', () => {
        const data = Buffer.from('test payload');
        const dek = generateKey();

        const result = encryptBuffer(data, dek);

        expect(result.iv.length).toBe(CRYPTO_CONSTANTS.IV_LENGTH);
        expect(result.authTag.length).toBe(CRYPTO_CONSTANTS.AUTH_TAG_LENGTH);
        expect(result.ciphertext.length).toBeGreaterThanOrEqual(data.length);
    });

    it('fails to decrypt with wrong key', () => {
        const data = Buffer.from('secret data');
        const dek = generateKey();
        const wrongKey = generateKey();

        const { iv, ciphertext, authTag } = encryptBuffer(data, dek);

        expect(() => decryptBuffer(ciphertext, wrongKey, iv, authTag)).toThrow();
    });

    it('fails to decrypt with tampered ciphertext (GCM auth failure)', () => {
        const data = Buffer.from('integrity test');
        const dek = generateKey();

        const { iv, ciphertext, authTag } = encryptBuffer(data, dek);

        // Tamper with ciphertext
        const tampered = Buffer.from(ciphertext);
        tampered[0] ^= 0xFF;

        expect(() => decryptBuffer(tampered, dek, iv, authTag)).toThrow();
    });

    it('handles large payloads (1MB)', () => {
        const data = Buffer.alloc(1024 * 1024, 0x42); // 1MB of 'B'
        const dek = generateKey();

        const { iv, ciphertext, authTag } = encryptBuffer(data, dek);
        const decrypted = decryptBuffer(ciphertext, dek, iv, authTag);

        expect(decrypted).toEqual(data);
    });
});

// ============================================================================
// getServerWrappingKey
// ============================================================================

describe('getServerWrappingKey', () => {
    const originalEnv = process.env.SECRET_ENCRYPTION_KEY;

    afterEach(() => {
        // Restore original env var
        if (originalEnv !== undefined) {
            process.env.SECRET_ENCRYPTION_KEY = originalEnv;
        } else {
            delete process.env.SECRET_ENCRYPTION_KEY;
        }
    });

    it('returns 32-byte buffer from valid env var', () => {
        const hexKey = 'a'.repeat(64); // Valid 64-char hex
        process.env.SECRET_ENCRYPTION_KEY = hexKey;

        const key = getServerWrappingKey();

        expect(key.length).toBe(32);
        expect(Buffer.isBuffer(key)).toBe(true);
    });

    it('throws if SECRET_ENCRYPTION_KEY is not set', () => {
        delete process.env.SECRET_ENCRYPTION_KEY;

        expect(() => getServerWrappingKey()).toThrow('SECRET_ENCRYPTION_KEY environment variable is required');
    });

    it('throws if SECRET_ENCRYPTION_KEY is invalid format', () => {
        process.env.SECRET_ENCRYPTION_KEY = 'not-a-valid-hex-key';

        expect(() => getServerWrappingKey()).toThrow('must be exactly 64 hexadecimal characters');
    });
});
