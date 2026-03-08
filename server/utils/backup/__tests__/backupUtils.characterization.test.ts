/**
 * Characterization Tests for server/utils/backup.ts
 *
 * These tests lock the current behavior of the backup utility BEFORE
 * any structural changes. They mock all external dependencies (fs, database,
 * archiver, SSE) to test pure utility logic in isolation.
 *
 * TASK-20260306-007 / S-X4-01 Behavior Lock
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// --- Mock Setup (before imports) ---

// Mock fs
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        createReadStream: vi.fn(),
        rmSync: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    createReadStream: vi.fn(),
    rmSync: vi.fn(),
}));

// Mock archiver — simulate streaming zip data through PassThrough
vi.mock('archiver', () => ({
    default: vi.fn(() => {
        const mockArchive = {
            on: vi.fn(),
            pipe: vi.fn((dest: NodeJS.WritableStream) => {
                // Simulate archiver writing data and ending
                process.nextTick(() => {
                    dest.write(Buffer.from('fake-zip-data'));
                    dest.end();
                });
                return dest;
            }),
            append: vi.fn(),
            directory: vi.fn(),
            finalize: vi.fn().mockResolvedValue(undefined),
        };
        return mockArchive;
    }),
}));

// Mock better-sqlite3 — must be a class constructor (used with `new Database()`)
vi.mock('better-sqlite3', () => {
    class MockDatabase {
        pragma = vi.fn();
        close = vi.fn();
        prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })) }));
        exec = vi.fn();
        transaction = vi.fn((fn: () => void) => fn);
    }
    return { default: MockDatabase };
});

// Mock database
vi.mock('../../../database/db', () => ({
    getDb: vi.fn(() => ({
        pragma: vi.fn(),
    })),
}));

// Mock logger
vi.mock('../../logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock SSE
vi.mock('../../../services/sseStreamService', () => ({
    broadcast: vi.fn(),
}));

// Mock encryption utilities
vi.mock('../../encryption', () => ({
    decryptConfigsInDb: vi.fn(),
    encryptConfigsInDb: vi.fn(),
}));

// Mock path sanitize
vi.mock('../../pathSanitize', () => ({
    safePath: vi.fn((base: string, filename: string) => path.join(base, filename)),
}));

// Mock backup encryption DB functions
vi.mock('../../../db/backupEncryption', () => ({
    isBackupEncryptionEnabled: vi.fn(() => false),
    getServerMBK: vi.fn(),
    getBackupEncryption: vi.fn(),
}));

// Mock backup crypto
vi.mock('../../backupCrypto', () => ({
    generateKey: vi.fn(),
    wrapKey: vi.fn(),
    encryptBuffer: vi.fn(),
}));

// --- Imports (after mocks) ---
import fs from 'fs';
import {
    listBackups,
    getBackupFilePath,
    deleteBackup,
    getBackupsTotalSize,
    cleanupOldBackups,
    isBackupInProgress,
    getCurrentBackupId,
    createBackup,
    BACKUPS_DIR,
} from '../../backup';
import type { BackupOptions, BackupResult, BackupProgress, RestoreValidationResult, BackupInfo } from '../../backup';
import { isBackupEncryptionEnabled, getServerMBK } from '../../../db/backupEncryption';

// ============================================================================
// parseBackupFilename (tested via listBackups which calls it internally)
// ============================================================================

describe('Characterization: parseBackupFilename (via listBackups)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('correctly parses .zip manual backup filenames', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(
            ['framerr-manual-2026-03-06T12-00-00.zip'] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync).mockReturnValue({
            size: 1024,
            mtime: new Date('2026-03-06T12:00:00Z'),
        } as unknown as ReturnType<typeof fs.statSync>);

        const backups = listBackups();
        expect(backups).toHaveLength(1);
        expect(backups[0]).toEqual({
            filename: 'framerr-manual-2026-03-06T12-00-00.zip',
            type: 'manual',
            size: 1024,
            createdAt: expect.any(String),
            encrypted: false,
        });
    });

    it('correctly parses .framerr-backup encrypted filenames', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(
            ['framerr-scheduled-2026-03-06T03-00-00.framerr-backup'] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync).mockReturnValue({
            size: 2048,
            mtime: new Date('2026-03-06T03:00:00Z'),
        } as unknown as ReturnType<typeof fs.statSync>);

        const backups = listBackups();
        expect(backups).toHaveLength(1);
        expect(backups[0].type).toBe('scheduled');
        expect(backups[0].encrypted).toBe(true);
    });

    it('returns null (filters out) for invalid filenames', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(
            ['not-a-backup.txt', 'random.zip', 'framerr-manual-2026-03-06T12-00-00.zip'] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync).mockReturnValue({
            size: 512,
            mtime: new Date('2026-03-06T12:00:00Z'),
        } as unknown as ReturnType<typeof fs.statSync>);

        const backups = listBackups();
        // Only the valid filename should be included
        expect(backups).toHaveLength(1);
        expect(backups[0].filename).toBe('framerr-manual-2026-03-06T12-00-00.zip');
    });
});

// ============================================================================
// listBackups
// ============================================================================

describe('Characterization: listBackups', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('returns correctly shaped BackupInfo[] sorted newest-first', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(
            [
                'framerr-manual-2026-03-05T10-00-00.zip',
                'framerr-scheduled-2026-03-06T03-00-00.zip',
            ] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync)
            .mockReturnValueOnce({
                size: 1000,
                mtime: new Date('2026-03-05T10:00:00Z'),
            } as unknown as ReturnType<typeof fs.statSync>)
            .mockReturnValueOnce({
                size: 2000,
                mtime: new Date('2026-03-06T03:00:00Z'),
            } as unknown as ReturnType<typeof fs.statSync>);

        const backups = listBackups();
        expect(backups).toHaveLength(2);
        // Newest first
        expect(backups[0].filename).toContain('2026-03-06');
        expect(backups[1].filename).toContain('2026-03-05');
        // Shape
        for (const b of backups) {
            expect(b).toHaveProperty('filename');
            expect(b).toHaveProperty('type');
            expect(b).toHaveProperty('size');
            expect(b).toHaveProperty('createdAt');
            expect(b).toHaveProperty('encrypted');
        }
    });
});

// ============================================================================
// getBackupFilePath
// ============================================================================

describe('Characterization: getBackupFilePath', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns full path for valid filename that exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const result = getBackupFilePath('framerr-manual-2026-03-06T12-00-00.zip');
        expect(result).toBeTruthy();
        expect(result).toContain('framerr-manual-2026-03-06T12-00-00.zip');
    });

    it('returns null for invalid extension', () => {
        const result = getBackupFilePath('malicious.exe');
        expect(result).toBeNull();
    });

    it('returns null when file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = getBackupFilePath('framerr-manual-2026-03-06T12-00-00.zip');
        expect(result).toBeNull();
    });
});

// ============================================================================
// deleteBackup
// ============================================================================

describe('Characterization: deleteBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when file is successfully deleted', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

        const result = deleteBackup('framerr-manual-2026-03-06T12-00-00.zip');
        expect(result).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('returns false when file not found', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = deleteBackup('framerr-manual-nonexistent.zip');
        expect(result).toBe(false);
    });
});

// ============================================================================
// cleanupOldBackups
// ============================================================================

describe('Characterization: cleanupOldBackups', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('deletes oldest backups when count exceeds maxBackups, excludes safety', () => {
        // Setup: 3 backups + 1 safety, max = 2
        vi.mocked(fs.readdirSync).mockReturnValue(
            [
                'framerr-manual-2026-03-01.zip',
                'framerr-manual-2026-03-02.zip',
                'framerr-scheduled-2026-03-03.zip',
                'framerr-safety-2026-03-04.zip',
            ] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync)
            .mockReturnValueOnce({ size: 100, mtime: new Date('2026-03-01') } as unknown as ReturnType<typeof fs.statSync>)
            .mockReturnValueOnce({ size: 200, mtime: new Date('2026-03-02') } as unknown as ReturnType<typeof fs.statSync>)
            .mockReturnValueOnce({ size: 300, mtime: new Date('2026-03-03') } as unknown as ReturnType<typeof fs.statSync>)
            .mockReturnValueOnce({ size: 400, mtime: new Date('2026-03-04') } as unknown as ReturnType<typeof fs.statSync>);
        vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

        const deleted = cleanupOldBackups(2);
        // 3 non-safety backups, max=2 → should delete 1 oldest
        expect(deleted).toBe(1);
    });
});

// ============================================================================
// getBackupsTotalSize
// ============================================================================

describe('Characterization: getBackupsTotalSize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('returns sum of all backup sizes', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(
            [
                'framerr-manual-2026-03-01.zip',
                'framerr-manual-2026-03-02.zip',
            ] as unknown as ReturnType<typeof fs.readdirSync>
        );
        vi.mocked(fs.statSync)
            .mockReturnValueOnce({ size: 1000, mtime: new Date() } as unknown as ReturnType<typeof fs.statSync>)
            .mockReturnValueOnce({ size: 2500, mtime: new Date() } as unknown as ReturnType<typeof fs.statSync>);

        const total = getBackupsTotalSize();
        expect(total).toBe(3500);
    });
});

// ============================================================================
// isBackupInProgress / getCurrentBackupId
// ============================================================================

describe('Characterization: isBackupInProgress / getCurrentBackupId', () => {
    it('returns correct initial state', () => {
        // These rely on module-level state. After module load, no backup is in progress.
        expect(typeof isBackupInProgress).toBe('function');
        expect(typeof getCurrentBackupId).toBe('function');
        // Initial state (module freshly loaded) — no backup running
        // Note: if createBackup was called in other tests, this may change.
        // This test locks the existence and return type of these functions.
        expect(typeof isBackupInProgress()).toBe('boolean');
        expect(getCurrentBackupId()).toBeNull();
    });
});

// ============================================================================
// Encryption failure propagation (POLICY FIX verification)
// ============================================================================

describe('Characterization: Encryption failure propagation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({
            size: 1024,
            mtime: new Date(),
        } as unknown as ReturnType<typeof fs.statSync>);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-db'));
        vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    });

    it('after policy fix: createBackup throws when encryption is enabled but getServerMBK throws', async () => {
        // Enable encryption
        vi.mocked(isBackupEncryptionEnabled).mockReturnValue(true);
        // Make getServerMBK throw
        vi.mocked(getServerMBK).mockImplementation(() => {
            throw new Error('MBK not available');
        });

        // After the policy fix, the inner try/catch is removed, so the error should propagate
        // to the outer catch and be re-thrown
        await expect(createBackup({ saveToServer: false })).rejects.toThrow('MBK not available');
    });
});

// ============================================================================
// createBackup success behavior lock
// ============================================================================

describe('Characterization: createBackup success path', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({
            size: 1024,
            mtime: new Date(),
        } as unknown as ReturnType<typeof fs.statSync>);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-db'));
        vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    });

    it('returns correctly shaped BackupResult on success (saveToServer=false)', async () => {
        // Encryption disabled (default mock)
        vi.mocked(isBackupEncryptionEnabled).mockReturnValue(false);

        const result = await createBackup({ saveToServer: false });

        expect(result).toHaveProperty('filename');
        expect(result.filename).toMatch(/^framerr-manual-.*\.zip$/);
        expect(result).toHaveProperty('size');
        expect(typeof result.size).toBe('number');
        expect(result.size).toBeGreaterThan(0);
        expect(result.savedToServer).toBe(false);
        expect(result.encrypted).toBe(false);
        expect(result.stream).toBeDefined();
    });
});

// ============================================================================
// Module public API shape
// ============================================================================

describe('Characterization: Module public API shape', () => {
    it('exports all expected runtime symbols', () => {
        expect(typeof listBackups).toBe('function');
        expect(typeof getBackupFilePath).toBe('function');
        expect(typeof deleteBackup).toBe('function');
        expect(typeof getBackupsTotalSize).toBe('function');
        expect(typeof cleanupOldBackups).toBe('function');
        expect(typeof isBackupInProgress).toBe('function');
        expect(typeof getCurrentBackupId).toBe('function');
        expect(typeof createBackup).toBe('function');
        expect(typeof BACKUPS_DIR).toBe('string');
    });

    it('type exports compile correctly (verified at build time)', () => {
        // These assertions verify the type-only exports are importable.
        // If they didn't exist, TypeScript would fail at tsc --build.
        const _opts: BackupOptions = {};
        const _progress: BackupProgress = { id: 'test', step: 'test', percent: 0 };
        const _result: Partial<BackupResult> = { filename: 'test', size: 0, savedToServer: false, encrypted: false };
        const _validation: RestoreValidationResult = { valid: true };
        const _info: BackupInfo = { filename: 'test', type: 'manual', size: 0, createdAt: '', encrypted: false };

        expect(_opts).toBeDefined();
        expect(_progress).toBeDefined();
        expect(_result).toBeDefined();
        expect(_validation).toBeDefined();
        expect(_info).toBeDefined();
    });
});
