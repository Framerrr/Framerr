/**
 * Characterization Tests for Backup Route (BL-BACKUP-1 through BL-BACKUP-3)
 *
 * These tests lock current behavior BEFORE the backup.ts split per the Behavior Lock mandate.
 * After the structural split into sub-modules, these same tests must pass identically.
 *
 * Task: TASK-20260306-006 (S-B2-01: Split Oversized Backend Route Controllers)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// ============================================================================
// Mocks — all dependencies must be mocked before importing the route
// ============================================================================

// --- DB mocks ---
const mockGetUserConfig = vi.fn();
const mockUpdateUserConfig = vi.fn();
vi.mock('../../db/userConfig', () => ({
    getUserConfig: (...args: unknown[]) => mockGetUserConfig(...args),
    updateUserConfig: (...args: unknown[]) => mockUpdateUserConfig(...args),
}));

const mockGetSystemConfig = vi.fn();
vi.mock('../../db/systemConfig', () => ({
    getSystemConfig: (...args: unknown[]) => mockGetSystemConfig(...args),
    BackupScheduleConfig: {},
}));

const mockGetAllUsers = vi.fn();
vi.mock('../../db/users', () => ({
    getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
}));

const mockIsBackupEncryptionEnabled = vi.fn();
const mockEnableBackupEncryption = vi.fn();
const mockDisableBackupEncryption = vi.fn();
const mockChangeBackupPassword = vi.fn();
const mockGetBackupEncryption = vi.fn();
vi.mock('../../db/backupEncryption', () => ({
    isBackupEncryptionEnabled: (...args: unknown[]) => mockIsBackupEncryptionEnabled(...args),
    enableBackupEncryption: (...args: unknown[]) => mockEnableBackupEncryption(...args),
    disableBackupEncryption: (...args: unknown[]) => mockDisableBackupEncryption(...args),
    changeBackupPassword: (...args: unknown[]) => mockChangeBackupPassword(...args),
    getBackupEncryption: (...args: unknown[]) => mockGetBackupEncryption(...args),
}));

// --- Utility mocks ---
const mockCreateBackup = vi.fn();
const mockListBackups = vi.fn();
const mockDeleteBackup = vi.fn();
const mockGetBackupFilePath = vi.fn();
const mockGetBackupsTotalSize = vi.fn();
const mockIsBackupInProgress = vi.fn();
vi.mock('../../utils/backup', () => ({
    createBackup: (...args: unknown[]) => mockCreateBackup(...args),
    listBackups: (...args: unknown[]) => mockListBackups(...args),
    deleteBackup: (...args: unknown[]) => mockDeleteBackup(...args),
    getBackupFilePath: (...args: unknown[]) => mockGetBackupFilePath(...args),
    getBackupsTotalSize: (...args: unknown[]) => mockGetBackupsTotalSize(...args),
    isBackupInProgress: (...args: unknown[]) => mockIsBackupInProgress(...args),
    BACKUPS_DIR: '/tmp/test-backups',
}));

vi.mock('../../utils/backupCrypto', () => ({
    deriveKEK: vi.fn(),
    wrapKey: vi.fn(),
    unwrapKey: vi.fn(),
    generateSalt: vi.fn(),
    CRYPTO_CONSTANTS: { PBKDF2_ITERATIONS: 100000 },
}));

vi.mock('../../utils/backupInspector', () => ({
    parseEncryptedHeader: vi.fn(),
}));

// --- Service mocks ---
const mockUpdateBackupSchedule = vi.fn();
const mockGetSchedulerStatus = vi.fn();
vi.mock('../../services/backupScheduler', () => ({
    updateBackupSchedule: (...args: unknown[]) => mockUpdateBackupSchedule(...args),
    getSchedulerStatus: (...args: unknown[]) => mockGetSchedulerStatus(...args),
    executeScheduledBackup: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// --- Auth mocks ---
// For BL-BACKUP-1 (admin app): both requireAuth and requireAdmin pass through
// For BL-BACKUP-2 (non-admin app): requireAuth passes, requireAdmin rejects with 403
const mockRequireAuth = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
const mockRequireAdmin = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());

vi.mock('../../middleware/auth', () => ({
    requireAuth: (...args: unknown[]) => mockRequireAuth(...(args as [Request, Response, NextFunction])),
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...(args as [Request, Response, NextFunction])),
}));

// --- FS mock (partial) ---
import { Readable } from 'stream';

const TEST_FILE_CONTENT = Buffer.from('test-data');
const mockStatSync = vi.fn().mockReturnValue({ size: TEST_FILE_CONTENT.length });
const mockCreateReadStream = vi.fn().mockImplementation(() => {
    return new Readable({ read() { this.push(TEST_FILE_CONTENT); this.push(null); } });
});

vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...actual,
        default: {
            ...actual,
            statSync: (...args: unknown[]) => mockStatSync(...args),
            createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
            readdirSync: vi.fn().mockReturnValue([]),
            readFileSync: vi.fn(),
            writeFileSync: vi.fn(),
            renameSync: vi.fn(),
        },
        statSync: (...args: unknown[]) => mockStatSync(...args),
        createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
        readdirSync: vi.fn().mockReturnValue([]),
    };
});

// ============================================================================
// App Setup — import AFTER mocks
// ============================================================================

import backupRouter from '../backup';

function createAdminApp() {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = {
            id: 'admin-1',
            username: 'testadmin',
            displayName: 'Test Admin',
            group: 'admin',
        };
        next();
    });
    app.use('/api/backup', backupRouter);
    return app;
}

function createRegularUserApp() {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = {
            id: 'user-1',
            username: 'testuser',
            displayName: 'Test User',
            group: 'user',
        };
        next();
    });
    app.use('/api/backup', backupRouter);
    return app;
}

// ============================================================================
// BL-BACKUP-1: Route Registration Matrix
// Verify all 14 endpoints respond (not 404) with correct HTTP methods
// ============================================================================

describe('BL-BACKUP-1: Route Registration Matrix', () => {
    let app: ReturnType<typeof createAdminApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createAdminApp();
        // Reset auth mocks to pass-through
        mockRequireAuth.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
        mockRequireAdmin.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
        // Default mock returns
        mockIsBackupInProgress.mockReturnValue(false);
        mockCreateBackup.mockResolvedValue({ filename: 'test.framerr-backup', size: 1024 });
        mockListBackups.mockReturnValue([]);
        mockGetBackupsTotalSize.mockReturnValue(0);
        mockGetBackupFilePath.mockReturnValue('/tmp/test-backups/test.framerr-backup');
        mockDeleteBackup.mockReturnValue(true);
        mockGetSystemConfig.mockResolvedValue({ backupSchedule: { enabled: true, frequency: 'daily', hour: 3, maxBackups: 5 } });
        mockGetSchedulerStatus.mockReturnValue({ nextBackup: new Date(), isRunning: false });
        mockUpdateBackupSchedule.mockResolvedValue(undefined);
        mockGetUserConfig.mockResolvedValue({ dashboard: {}, tabs: {}, theme: {}, sidebar: {} });
        mockGetAllUsers.mockResolvedValue([]);
        mockIsBackupEncryptionEnabled.mockReturnValue(false);
        // Provide encryption config to prevent change-password from returning 404 (business logic 404, not route 404)
        mockGetBackupEncryption.mockReturnValue({
            kekSalt: Buffer.from('test').toString('base64'),
            kdfIterations: 100000,
            mbkPassword: Buffer.from('test').toString('base64'),
        });
    });

    // --- Archive routes ---
    it('POST /api/backup/create → registered (not 404)', async () => {
        const res = await request(app).post('/api/backup/create');
        expect(res.status).not.toBe(404);
    });

    it('GET /api/backup/list → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/list');
        expect(res.status).not.toBe(404);
    });

    it('GET /api/backup/download/test.framerr-backup → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/download/test.framerr-backup');
        expect(res.status).not.toBe(404);
    });

    it('DELETE /api/backup/test.framerr-backup → registered (not 404)', async () => {
        const res = await request(app).delete('/api/backup/test.framerr-backup');
        expect(res.status).not.toBe(404);
    });

    it('GET /api/backup/status → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/status');
        expect(res.status).not.toBe(404);
    });

    // --- Schedule routes ---
    it('GET /api/backup/schedule → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/schedule');
        expect(res.status).not.toBe(404);
    });

    it('PUT /api/backup/schedule → registered (not 404)', async () => {
        const res = await request(app)
            .put('/api/backup/schedule')
            .send({ enabled: true, frequency: 'daily', hour: 3, maxBackups: 5 });
        expect(res.status).not.toBe(404);
    });

    // --- User export/import routes ---
    it('GET /api/backup/export → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/export');
        expect(res.status).not.toBe(404);
    });

    it('POST /api/backup/import → registered (not 404)', async () => {
        const res = await request(app)
            .post('/api/backup/import')
            .send({ data: { dashboard: {} } });
        expect(res.status).not.toBe(404);
    });

    it('GET /api/backup/system → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/system');
        expect(res.status).not.toBe(404);
    });

    // --- Encryption routes ---
    it('GET /api/backup/encryption/status → registered (not 404)', async () => {
        const res = await request(app).get('/api/backup/encryption/status');
        expect(res.status).not.toBe(404);
    });

    it('POST /api/backup/encryption/enable → registered (not 404)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/enable')
            .send({ password: 'testpassword123' });
        expect(res.status).not.toBe(404);
    });

    it('POST /api/backup/encryption/disable → registered (not 404)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/disable')
            .send({ password: 'testpassword123' });
        expect(res.status).not.toBe(404);
    });

    it('POST /api/backup/encryption/change-password → registered (not 404)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/change-password')
            .send({ oldPassword: 'oldpass123', newPassword: 'newpass1234' });
        expect(res.status).not.toBe(404);
    });
});

// ============================================================================
// BL-BACKUP-2: Auth Guard Enforcement
// Verify /export and /import use requireAuth (non-admin can access)
// Verify all other routes use requireAdmin (non-admin gets 403)
// ============================================================================

describe('BL-BACKUP-2: Auth Guard Enforcement', () => {
    let app: ReturnType<typeof createRegularUserApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createRegularUserApp();
        // requireAuth always passes (any authenticated user)
        mockRequireAuth.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
        // requireAdmin blocks non-admin users with 403
        mockRequireAdmin.mockImplementation((_req: Request, res: Response) => {
            res.status(403).json({ error: 'Admin access required' });
        });
        // Default mock returns for routes that pass auth
        mockGetUserConfig.mockResolvedValue({ dashboard: {}, tabs: {}, theme: {}, sidebar: {} });
        mockUpdateUserConfig.mockResolvedValue({});
    });

    // Routes that should be accessible by any authenticated user (requireAuth)
    it('GET /export → accessible to non-admin (uses requireAuth)', async () => {
        const res = await request(app).get('/api/backup/export');
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(404);
    });

    it('POST /import → accessible to non-admin (uses requireAuth)', async () => {
        const res = await request(app)
            .post('/api/backup/import')
            .send({ data: { dashboard: {} } });
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(404);
    });

    // Routes that should BLOCK non-admin users (requireAdmin)
    it('POST /create → blocked for non-admin (403)', async () => {
        const res = await request(app).post('/api/backup/create');
        expect(res.status).toBe(403);
    });

    it('GET /list → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/list');
        expect(res.status).toBe(403);
    });

    it('GET /download/:filename → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/download/test.framerr-backup');
        expect(res.status).toBe(403);
    });

    it('DELETE /:filename → blocked for non-admin (403)', async () => {
        const res = await request(app).delete('/api/backup/test.framerr-backup');
        expect(res.status).toBe(403);
    });

    it('GET /status → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/status');
        expect(res.status).toBe(403);
    });

    it('GET /schedule → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/schedule');
        expect(res.status).toBe(403);
    });

    it('PUT /schedule → blocked for non-admin (403)', async () => {
        const res = await request(app)
            .put('/api/backup/schedule')
            .send({ enabled: true });
        expect(res.status).toBe(403);
    });

    it('GET /system → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/system');
        expect(res.status).toBe(403);
    });

    it('GET /encryption/status → blocked for non-admin (403)', async () => {
        const res = await request(app).get('/api/backup/encryption/status');
        expect(res.status).toBe(403);
    });

    it('POST /encryption/enable → blocked for non-admin (403)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/enable')
            .send({ password: 'testpassword123' });
        expect(res.status).toBe(403);
    });

    it('POST /encryption/disable → blocked for non-admin (403)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/disable')
            .send({ password: 'testpassword123' });
        expect(res.status).toBe(403);
    });

    it('POST /encryption/change-password → blocked for non-admin (403)', async () => {
        const res = await request(app)
            .post('/api/backup/encryption/change-password')
            .send({ oldPassword: 'oldpass123', newPassword: 'newpass1234' });
        expect(res.status).toBe(403);
    });
});

// ============================================================================
// BL-BACKUP-3: Error Response Shape Parity
// On DB/service error, representative endpoints return { error: string } shape
// ============================================================================

describe('BL-BACKUP-3: Error Response Shape Parity', () => {
    let app: ReturnType<typeof createAdminApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createAdminApp();
        // Auth passes for all
        mockRequireAuth.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
        mockRequireAdmin.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
    });

    it('POST /create → 500 + { error: string } on backup failure', async () => {
        mockIsBackupInProgress.mockReturnValue(false);
        mockCreateBackup.mockRejectedValue(new Error('Disk full'));
        const res = await request(app).post('/api/backup/create');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
    });

    it('GET /list → 500 + { error: string } on list failure', async () => {
        mockListBackups.mockImplementation(() => { throw new Error('IO error'); });
        const res = await request(app).get('/api/backup/list');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
    });

    it('GET /schedule → 500 + { error: string } on config failure', async () => {
        mockGetSystemConfig.mockRejectedValue(new Error('DB error'));
        const res = await request(app).get('/api/backup/schedule');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
    });

    it('GET /export → 500 + { error: string } on user config failure', async () => {
        mockGetUserConfig.mockRejectedValue(new Error('DB error'));
        const res = await request(app).get('/api/backup/export');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
    });

    it('GET /encryption/status → 500 + { error: string } on check failure', async () => {
        mockIsBackupEncryptionEnabled.mockImplementation(() => { throw new Error('DB error'); });
        const res = await request(app).get('/api/backup/encryption/status');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
    });

    it('POST /create → 409 when backup already in progress', async () => {
        mockIsBackupInProgress.mockReturnValue(true);
        const res = await request(app).post('/api/backup/create');
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('error');
    });

    it('DELETE /:filename → 403 for safety backups', async () => {
        const res = await request(app).delete('/api/backup/2026-01-01-safety-auto.framerr-backup');
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });
});
