/**
 * Backup Encryption DB Layer — Unit Tests
 *
 * Tests the backup encryption database functions (enable, disable, change password, getServerMBK).
 * Mocks the database and crypto modules to test logic in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mocks — set up BEFORE importing module under test
// ============================================================================

// Mock logger
vi.mock('../utils/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock DB
const mockPrepare = vi.fn();
const mockDb = { prepare: mockPrepare };
vi.mock('../database/db', () => ({
    getDb: () => mockDb,
}));

// Use real crypto functions (they're pure and fast enough for tests)
// But mock getServerWrappingKey since it reads env vars
const MOCK_SERVER_KEY = Buffer.alloc(32, 0xAA);

vi.mock('../utils/backupCrypto', async () => {
    const actual = await vi.importActual<typeof import('../utils/backupCrypto')>('../utils/backupCrypto');
    return {
        ...actual,
        getServerWrappingKey: vi.fn(() => MOCK_SERVER_KEY),
    };
});

// Import AFTER mocks
import {
    getBackupEncryption,
    isBackupEncryptionEnabled,
    enableBackupEncryption,
    disableBackupEncryption,
    changeBackupPassword,
    getServerMBK,
} from '../db/backupEncryption';
import { wrapKey, deriveKEK, generateKey, generateSalt, CRYPTO_CONSTANTS } from '../utils/backupCrypto';

// ============================================================================
// Helpers
// ============================================================================

/** Create a realistic DB row from an enable operation */
function createMockRow(password: string): {
    row: {
        id: number;
        enabled: number;
        mbk_password: string;
        mbk_server: string;
        kek_salt: string;
        kdf_iterations: number;
        created_at: string;
        updated_at: string;
    };
    mbk: Buffer;
    salt: Buffer;
} {
    const mbk = generateKey();
    const salt = generateSalt();
    const kek = deriveKEK(password, salt, CRYPTO_CONSTANTS.PBKDF2_ITERATIONS);
    const wrappedByPassword = wrapKey(mbk, kek);
    const wrappedByServer = wrapKey(mbk, MOCK_SERVER_KEY);

    return {
        row: {
            id: 1,
            enabled: 1,
            mbk_password: wrappedByPassword.toString('base64'),
            mbk_server: wrappedByServer.toString('base64'),
            kek_salt: salt.toString('base64'),
            kdf_iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
            created_at: '2026-02-27 00:00:00',
            updated_at: '2026-02-27 00:00:00',
        },
        mbk,
        salt,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('getBackupEncryption', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns null when no row exists', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) });

        const result = getBackupEncryption();
        expect(result).toBeNull();
    });

    it('returns mapped config when row exists', () => {
        const { row } = createMockRow('test-password');
        mockPrepare.mockReturnValue({ get: vi.fn(() => row) });

        const result = getBackupEncryption();
        expect(result).not.toBeNull();
        expect(result!.enabled).toBe(true);
        expect(result!.mbkPassword).toBe(row.mbk_password);
        expect(result!.mbkServer).toBe(row.mbk_server);
        expect(result!.kekSalt).toBe(row.kek_salt);
        expect(result!.kdfIterations).toBe(600000);
    });
});

describe('isBackupEncryptionEnabled', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns false when no row exists', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) });
        expect(isBackupEncryptionEnabled()).toBe(false);
    });

    it('returns true when enabled = 1', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => ({ enabled: 1 })) });
        expect(isBackupEncryptionEnabled()).toBe(true);
    });

    it('returns false when enabled = 0', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => ({ enabled: 0 })) });
        expect(isBackupEncryptionEnabled()).toBe(false);
    });

    it('returns false on DB error', () => {
        mockPrepare.mockImplementation(() => { throw new Error('DB error'); });
        expect(isBackupEncryptionEnabled()).toBe(false);
    });
});

describe('enableBackupEncryption', () => {
    beforeEach(() => vi.clearAllMocks());

    it('generates MBK and stores wrapped version', () => {
        // No existing row
        const mockGet = vi.fn(() => undefined);
        const mockRun = vi.fn();
        mockPrepare.mockReturnValueOnce({ get: mockGet }); // Check existing
        mockPrepare.mockReturnValueOnce({ run: mockRun });  // INSERT

        enableBackupEncryption('my-password-123');

        expect(mockRun).toHaveBeenCalledTimes(1);
        const args = mockRun.mock.calls[0];

        // Verify the stored values are valid base64
        expect(() => Buffer.from(args[0] as string, 'base64')).not.toThrow(); // mbk_password
        expect(() => Buffer.from(args[1] as string, 'base64')).not.toThrow(); // mbk_server
        expect(() => Buffer.from(args[2] as string, 'base64')).not.toThrow(); // kek_salt
        expect(args[3]).toBe(CRYPTO_CONSTANTS.PBKDF2_ITERATIONS);             // iterations
    });

    it('throws if already enabled', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => ({ id: 1 })) });

        expect(() => enableBackupEncryption('password')).toThrow('already enabled');
    });
});

describe('disableBackupEncryption', () => {
    beforeEach(() => vi.clearAllMocks());

    it('deletes config after password verification', () => {
        const password = 'my-password';
        const { row } = createMockRow(password);

        const mockGet = vi.fn(() => row);
        const mockRun = vi.fn();
        mockPrepare.mockReturnValueOnce({ get: mockGet }); // SELECT for getBackupEncryption
        mockPrepare.mockReturnValueOnce({ run: mockRun }); // DELETE

        disableBackupEncryption(password);

        expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('throws on incorrect password', () => {
        const { row } = createMockRow('correct-password');
        mockPrepare.mockReturnValue({ get: vi.fn(() => row) });

        expect(() => disableBackupEncryption('wrong-password')).toThrow('Incorrect password');
    });

    it('throws when not enabled', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) });

        expect(() => disableBackupEncryption('password')).toThrow('not enabled');
    });
});

describe('changeBackupPassword', () => {
    beforeEach(() => vi.clearAllMocks());

    it('re-wraps MBK with new password', () => {
        const oldPassword = 'old-password-123';
        const newPassword = 'new-password-456';
        const { row } = createMockRow(oldPassword);

        const mockGet = vi.fn(() => row);
        const mockRun = vi.fn();
        mockPrepare.mockReturnValueOnce({ get: mockGet }); // SELECT for getBackupEncryption
        mockPrepare.mockReturnValueOnce({ run: mockRun }); // UPDATE

        changeBackupPassword(oldPassword, newPassword);

        expect(mockRun).toHaveBeenCalledTimes(1);
        const args = mockRun.mock.calls[0];

        // New wrapped MBK should be different from old
        expect(args[0]).not.toBe(row.mbk_password);
        // New salt should be different from old
        expect(args[1]).not.toBe(row.kek_salt);
    });

    it('throws on incorrect old password', () => {
        const { row } = createMockRow('real-password');
        mockPrepare.mockReturnValue({ get: vi.fn(() => row) });

        expect(() => changeBackupPassword('wrong-password', 'new-pass')).toThrow('Incorrect current password');
    });
});

describe('getServerMBK', () => {
    beforeEach(() => vi.clearAllMocks());

    it('unwraps MBK using server key', () => {
        const password = 'any-password';
        const { row, mbk } = createMockRow(password);

        mockPrepare.mockReturnValue({ get: vi.fn(() => row) });

        const result = getServerMBK();

        // Should return the original MBK
        expect(result).toEqual(mbk);
    });

    it('throws when not enabled', () => {
        mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) });

        expect(() => getServerMBK()).toThrow('not enabled');
    });
});
