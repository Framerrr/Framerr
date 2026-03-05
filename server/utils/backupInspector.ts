/**
 * Backup Inspector
 *
 * Format detection and decryption for backup files.
 * Handles both plain ZIP and encrypted .framerr-backup formats.
 *
 * Binary format (encrypted):
 *   [8B magic "FRMRBKUP"] [1B version] [2B headerLen LE] [N header JSON] [rest: ciphertext]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { deriveKEK, unwrapKey, decryptBuffer } from './backupCrypto';
import logger from './logger';

// ============================================================================
// Constants
// ============================================================================

const MAGIC = Buffer.from('FRMRBKUP', 'ascii');  // 8 bytes
const MAGIC_LENGTH = 8;
const VERSION_OFFSET = 8;
const HEADER_LEN_OFFSET = 9;
const HEADER_OFFSET = 11;   // 8 + 1 + 2
const MAX_HEADER_LENGTH = 8192;

// ZIP magic bytes (PK\x03\x04)
const ZIP_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

// ============================================================================
// Types
// ============================================================================

export interface EncryptedBackupHeader {
    version: number;
    kdf: string;
    iterations: number;
    salt: string;           // Base64
    wrappedMbk: string;     // Base64
    wrappedDek: string;     // Base64
    payloadIv: string;      // Base64
    payloadAuthTag: string; // Base64
}

export type BackupInspection =
    | { format: 'zip' }
    | { format: 'encrypted'; header: EncryptedBackupHeader };

// ============================================================================
// Functions
// ============================================================================

/**
 * Inspect a backup file to determine its format.
 *
 * @param filePath - Absolute path to the backup file
 * @returns Format detection result with parsed header for encrypted files
 * @throws Error if the file is not a valid Framerr backup
 */
export function inspectBackupFile(filePath: string): BackupInspection {
    const fd = fs.openSync(filePath, 'r');
    try {
        const stats = fs.fstatSync(fd);

        // Read enough bytes to detect format (at least magic bytes)
        const probe = Buffer.alloc(Math.min(HEADER_OFFSET, stats.size));
        fs.readSync(fd, probe, 0, probe.length, 0);

        // Check for ZIP magic first
        if (probe.length >= 4 && probe.subarray(0, 4).equals(ZIP_MAGIC)) {
            return { format: 'zip' };
        }

        // Check for encrypted backup magic
        if (probe.length < MAGIC_LENGTH || !probe.subarray(0, MAGIC_LENGTH).equals(MAGIC)) {
            throw new Error('Not a valid Framerr backup file');
        }

        // Read full header
        const headerBuf = Buffer.alloc(Math.min(stats.size, HEADER_OFFSET + MAX_HEADER_LENGTH));
        fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);

        const header = parseEncryptedHeader(headerBuf, stats.size);
        return { format: 'encrypted', header };
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Parse and validate an encrypted backup header from a buffer.
 *
 * @param buffer - Buffer containing at least the first HEADER_OFFSET + headerLen bytes
 * @param fileSize - Total file size (for truncation detection)
 * @returns Parsed header object
 * @throws Error with specific messages for each validation failure
 */
export function parseEncryptedHeader(buffer: Buffer, fileSize: number): EncryptedBackupHeader {
    // Validate magic
    if (buffer.length < MAGIC_LENGTH || !buffer.subarray(0, MAGIC_LENGTH).equals(MAGIC)) {
        throw new Error('Not a valid Framerr backup file');
    }

    // Validate version
    if (buffer.length < VERSION_OFFSET + 1) {
        throw new Error('Truncated backup file');
    }
    const version = buffer[VERSION_OFFSET];
    if (version !== 0x01) {
        throw new Error('Unsupported backup format version');
    }

    // Read header length
    if (buffer.length < HEADER_LEN_OFFSET + 2) {
        throw new Error('Truncated backup file');
    }
    const headerLen = buffer.readUInt16LE(HEADER_LEN_OFFSET);

    if (headerLen > MAX_HEADER_LENGTH) {
        throw new Error('Malformed backup file (header too large)');
    }

    // Check file has enough bytes for header + at least some payload
    if (fileSize < HEADER_OFFSET + headerLen) {
        throw new Error('Truncated backup file');
    }

    // Parse header JSON
    if (buffer.length < HEADER_OFFSET + headerLen) {
        throw new Error('Truncated backup file');
    }

    const headerJson = buffer.subarray(HEADER_OFFSET, HEADER_OFFSET + headerLen).toString('utf-8');
    let header: EncryptedBackupHeader;
    try {
        header = JSON.parse(headerJson);
    } catch {
        throw new Error('Corrupted backup header');
    }

    return header;
}

/**
 * Decrypt an encrypted backup file to a temporary ZIP file.
 *
 * Full pipeline: read file → parse header → derive KEK → unwrap MBK → unwrap DEK → decrypt payload → write temp ZIP.
 *
 * @param filePath - Path to the encrypted .framerr-backup file
 * @param password - User-provided backup password
 * @returns Path to the temporary decrypted ZIP file (caller must clean up)
 * @throws Error if password is wrong or file is corrupted
 */
export function decryptBackupToZip(filePath: string, password: string): string {
    // Read the entire file
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // Parse header
    const header = parseEncryptedHeader(fileBuffer, fileSize);

    // Read header length to find payload start
    const headerLen = fileBuffer.readUInt16LE(HEADER_LEN_OFFSET);
    const payloadStart = HEADER_OFFSET + headerLen;
    const encryptedPayload = fileBuffer.subarray(payloadStart);

    // Derive KEK from password
    const salt = Buffer.from(header.salt, 'base64');
    const kek = deriveKEK(password, salt, header.iterations);

    // Unwrap MBK with KEK
    const wrappedMbk = Buffer.from(header.wrappedMbk, 'base64');
    const mbk = unwrapKey(wrappedMbk, kek); // Throws if wrong password

    // Unwrap DEK with MBK
    const wrappedDek = Buffer.from(header.wrappedDek, 'base64');
    const dek = unwrapKey(wrappedDek, mbk);

    // Decrypt payload
    const payloadIv = Buffer.from(header.payloadIv, 'base64');
    const payloadAuthTag = Buffer.from(header.payloadAuthTag, 'base64');
    const zipBuffer = decryptBuffer(encryptedPayload, dek, payloadIv, payloadAuthTag);

    // Write to temp file
    const tmpPath = path.join(os.tmpdir(), `restore-${Date.now()}.zip`);
    fs.writeFileSync(tmpPath, zipBuffer);

    logger.info(`[BackupInspector] Decrypted backup: encryptedSize=${fileSize} decryptedSize=${zipBuffer.length}`);

    return tmpPath;
}
