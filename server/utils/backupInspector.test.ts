/**
 * Backup Inspector — Unit Tests
 *
 * Tests format detection, header parsing, and decryption pipeline.
 * Creates synthetic backup files in temp directory for testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { inspectBackupFile, parseEncryptedHeader, decryptBackupToZip } from '../utils/backupInspector';
import { generateKey, generateSalt, wrapKey, encryptBuffer, deriveKEK } from '../utils/backupCrypto';

// ============================================================================
// Test Helpers
// ============================================================================

let testDir: string;

beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framerr-inspector-test-'));
});

afterAll(() => {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true });
});

/**
 * Build a valid encrypted backup file buffer.
 */
function buildEncryptedBackup(zipPayload: Buffer, password: string): Buffer {
    // Generate keys
    const mbk = generateKey();
    const dek = generateKey();
    const salt = generateSalt();

    // Derive KEK and wrap MBK
    const kek = deriveKEK(password, salt);
    const wrappedMbk = wrapKey(mbk, kek);
    const wrappedDek = wrapKey(dek, mbk);

    // Encrypt payload
    const { iv: payloadIv, ciphertext, authTag: payloadAuthTag } = encryptBuffer(zipPayload, dek);

    // Build header JSON
    const header = JSON.stringify({
        version: 1,
        kdf: 'pbkdf2-sha256',
        iterations: 600000,
        salt: salt.toString('base64'),
        wrappedMbk: wrappedMbk.toString('base64'),
        wrappedDek: wrappedDek.toString('base64'),
        payloadIv: payloadIv.toString('base64'),
        payloadAuthTag: payloadAuthTag.toString('base64'),
    });

    const headerBuf = Buffer.from(header, 'utf-8');

    // Binary format: magic (8) + version (1) + headerLen (2) + header (N) + payload
    const magic = Buffer.from('FRMRBKUP', 'ascii');
    const version = Buffer.from([0x01]);
    const headerLen = Buffer.alloc(2);
    headerLen.writeUInt16LE(headerBuf.length, 0);

    return Buffer.concat([magic, version, headerLen, headerBuf, ciphertext]);
}

function writeTestFile(name: string, content: Buffer): string {
    const filePath = path.join(testDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
}

// ============================================================================
// inspectBackupFile
// ============================================================================

describe('inspectBackupFile', () => {
    it('detects a valid encrypted file', () => {
        const zipPayload = Buffer.from('fake zip content for testing');
        const encrypted = buildEncryptedBackup(zipPayload, 'test-password');
        const filePath = writeTestFile('valid-encrypted.framerr-backup', encrypted);

        const result = inspectBackupFile(filePath);

        expect(result.format).toBe('encrypted');
        if (result.format === 'encrypted') {
            expect(result.header.version).toBe(1);
            expect(result.header.kdf).toBe('pbkdf2-sha256');
            expect(result.header.iterations).toBe(600000);
            expect(result.header.salt).toBeTruthy();
            expect(result.header.wrappedMbk).toBeTruthy();
            expect(result.header.wrappedDek).toBeTruthy();
            expect(result.header.payloadIv).toBeTruthy();
            expect(result.header.payloadAuthTag).toBeTruthy();
        }
    });

    it('detects a ZIP file', () => {
        // ZIP magic: PK\x03\x04 followed by some data
        const zipContent = Buffer.concat([
            Buffer.from([0x50, 0x4B, 0x03, 0x04]),
            Buffer.alloc(100, 0x00),
        ]);
        const filePath = writeTestFile('valid.zip', zipContent);

        const result = inspectBackupFile(filePath);

        expect(result.format).toBe('zip');
    });

    it('throws for random/invalid files', () => {
        const randomData = Buffer.from('this is not a backup file at all');
        const filePath = writeTestFile('random.bin', randomData);

        expect(() => inspectBackupFile(filePath)).toThrow('Not a valid Framerr backup file');
    });
});

// ============================================================================
// parseEncryptedHeader
// ============================================================================

describe('parseEncryptedHeader', () => {
    it('rejects unsupported version', () => {
        const buf = Buffer.alloc(20);
        Buffer.from('FRMRBKUP', 'ascii').copy(buf, 0);
        buf[8] = 0x02; // Version 2
        buf.writeUInt16LE(5, 9); // Header length

        expect(() => parseEncryptedHeader(buf, 100)).toThrow('Unsupported backup format version');
    });

    it('rejects header length > 8192', () => {
        const buf = Buffer.alloc(20);
        Buffer.from('FRMRBKUP', 'ascii').copy(buf, 0);
        buf[8] = 0x01;
        buf.writeUInt16LE(9000, 9); // Too large

        expect(() => parseEncryptedHeader(buf, 100000)).toThrow('Malformed backup file (header too large)');
    });

    it('rejects truncated file', () => {
        const buf = Buffer.alloc(15);
        Buffer.from('FRMRBKUP', 'ascii').copy(buf, 0);
        buf[8] = 0x01;
        buf.writeUInt16LE(500, 9); // Header claims 500 bytes but file is only 15

        // Pass fileSize that's too small for the claimed header
        expect(() => parseEncryptedHeader(buf, 15)).toThrow('Truncated backup file');
    });

    it('rejects invalid JSON header', () => {
        const invalidJson = 'this is not valid JSON!!!';
        const headerBuf = Buffer.from(invalidJson, 'utf-8');

        const magic = Buffer.from('FRMRBKUP', 'ascii');
        const version = Buffer.from([0x01]);
        const headerLen = Buffer.alloc(2);
        headerLen.writeUInt16LE(headerBuf.length, 0);

        const buf = Buffer.concat([magic, version, headerLen, headerBuf]);

        expect(() => parseEncryptedHeader(buf, buf.length + 100)).toThrow('Corrupted backup header');
    });
});

// ============================================================================
// decryptBackupToZip
// ============================================================================

describe('decryptBackupToZip', () => {
    it('decrypts an encrypted backup to a temp ZIP file', () => {
        const originalContent = Buffer.from('This represents a ZIP file payload for round-trip testing');
        const password = 'round-trip-test-password';
        const encrypted = buildEncryptedBackup(originalContent, password);
        const filePath = writeTestFile('roundtrip.framerr-backup', encrypted);

        const tmpZipPath = decryptBackupToZip(filePath, password);

        try {
            expect(fs.existsSync(tmpZipPath)).toBe(true);
            const decrypted = fs.readFileSync(tmpZipPath);
            expect(decrypted).toEqual(originalContent);
        } finally {
            // Clean up temp file
            if (fs.existsSync(tmpZipPath)) {
                fs.unlinkSync(tmpZipPath);
            }
        }
    });

    it('throws with wrong password', () => {
        const originalContent = Buffer.from('Secret backup data');
        const encrypted = buildEncryptedBackup(originalContent, 'correct-password');
        const filePath = writeTestFile('wrong-pw.framerr-backup', encrypted);

        expect(() => decryptBackupToZip(filePath, 'wrong-password')).toThrow();
    });
});
