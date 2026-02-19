/**
 * Linked Accounts - Plex Linking Tests
 *
 * Tests the library access check in POST /linked-accounts/plex.
 * Verifies the security fix: manual linking now requires library access,
 * matching the SSO login flow behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --------------------------------------------------------------------------
// Mocks — must be set up BEFORE importing module under test
// --------------------------------------------------------------------------

// Mock logger
vi.mock('../utils/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock DB modules
const mockLinkAccount = vi.fn();
const mockFindUserByExternalId = vi.fn();
vi.mock('../db/linkedAccounts', () => ({
    linkAccount: (...args: unknown[]) => mockLinkAccount(...args),
    findUserByExternalId: (...args: unknown[]) => mockFindUserByExternalId(...args),
    getLinkedAccountsForUser: vi.fn(() => []),
    unlinkAccount: vi.fn(),
}));

vi.mock('../db/users', () => ({
    setHasLocalPassword: vi.fn(),
}));

vi.mock('../auth/password', () => ({
    hashPassword: vi.fn(),
}));

// Mock systemConfig
const mockGetSystemConfig = vi.fn();
vi.mock('../db/systemConfig', () => ({
    getSystemConfig: () => mockGetSystemConfig(),
}));

// Mock checkPlexLibraryAccess
const mockCheckPlexLibraryAccess = vi.fn();
vi.mock('../utils/plexLibraryAccess', () => ({
    checkPlexLibraryAccess: (...args: unknown[]) => mockCheckPlexLibraryAccess(...args),
}));

// Mock axios
const mockAxiosGet = vi.fn();
vi.mock('axios', () => ({
    default: {
        get: (...args: unknown[]) => mockAxiosGet(...args),
        post: vi.fn(),
    },
    get: (...args: unknown[]) => mockAxiosGet(...args),
}));

// Mock middleware
vi.mock('../middleware/auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// --------------------------------------------------------------------------
// Import the module AFTER mocks
// --------------------------------------------------------------------------
import { default as express, Request, Response } from 'express';
import linkedAccountsRouter from '../routes/linkedAccounts';

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------

function createApp() {
    const app = express();
    app.use(express.json());
    // Inject a fake user into the request
    app.use((req: Request, _res: Response, next: () => void) => {
        (req as Request & { user?: { id: string; username: string; group: string; isAdmin: boolean } }).user = {
            id: 'user-1',
            username: 'testuser',
            group: 'user',
            isAdmin: false,
        };
        next();
    });
    app.use('/api/linked-accounts', linkedAccountsRouter);
    return app;
}

const MOCK_PLEX_USER = {
    id: 12345,
    username: 'alex_plex',
    email: 'alex@example.com',
    thumb: 'https://plex.tv/users/thumb.png',
};

const MOCK_SSO_CONFIG = {
    enabled: true,
    adminToken: 'admin-plex-token',
    machineId: 'machine-123',
    clientIdentifier: 'framerr-dashboard',
    adminPlexId: '99999', // Different from our test user
};

// --------------------------------------------------------------------------
// Import supertest for HTTP testing
// --------------------------------------------------------------------------
import request from 'supertest';

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('POST /api/linked-accounts/plex', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: Plex API returns a valid user
        mockAxiosGet.mockResolvedValue({ data: MOCK_PLEX_USER });

        // Default: systemConfig returns SSO configured
        mockGetSystemConfig.mockResolvedValue({ plexSSO: MOCK_SSO_CONFIG });

        // Default: no existing link
        mockFindUserByExternalId.mockReturnValue(null);

        // Default: library access check passes
        mockCheckPlexLibraryAccess.mockResolvedValue({ hasAccess: true, isAdmin: false });
    });

    it('should link Plex account when user has library access', async () => {
        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'valid-plex-token' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.link.service).toBe('plex');
        expect(res.body.link.externalUsername).toBe('alex_plex');

        // Verify linkAccount was called
        expect(mockLinkAccount).toHaveBeenCalledWith(
            'user-1',
            'plex',
            expect.objectContaining({
                externalId: '12345',
                externalUsername: 'alex_plex',
            })
        );

        // Verify library access was checked
        expect(mockCheckPlexLibraryAccess).toHaveBeenCalledWith(
            '12345',
            expect.objectContaining({
                adminToken: 'admin-plex-token',
                machineId: 'machine-123',
            })
        );
    });

    it('should reject when user does NOT have library access (403)', async () => {
        mockCheckPlexLibraryAccess.mockResolvedValue({ hasAccess: false, isAdmin: false });

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'valid-plex-token' });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('does not have access to the server library');

        // Verify linkAccount was NOT called
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should allow Plex admin to link (skips library check)', async () => {
        mockCheckPlexLibraryAccess.mockResolvedValue({ hasAccess: true, isAdmin: true });

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'admin-plex-token' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockLinkAccount).toHaveBeenCalled();
    });

    it('should reject managed/Home Plex users (400)', async () => {
        // Managed users have no id
        mockAxiosGet.mockResolvedValue({
            data: { ...MOCK_PLEX_USER, id: 0 },
        });

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'managed-user-token' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Managed Plex accounts');
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should reject when Plex account is already linked to another user (409)', async () => {
        mockFindUserByExternalId.mockReturnValue('other-user-id'); // Different user

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'valid-plex-token' });

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already connected to another user');
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should skip library check gracefully when SSO not configured (no machineId)', async () => {
        mockGetSystemConfig.mockResolvedValue({
            plexSSO: { enabled: false }, // No machineId, no adminToken
        });

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'valid-plex-token' });

        // Should succeed — gracefully skips the check
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Library access check should NOT have been called
        expect(mockCheckPlexLibraryAccess).not.toHaveBeenCalled();
    });

    it('should return 500 when library access check throws', async () => {
        mockCheckPlexLibraryAccess.mockRejectedValue(new Error('Plex API unreachable'));

        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({ plexToken: 'valid-plex-token' });

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('Failed to verify library access');
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should return 400 when no plexToken provided', async () => {
        const app = createApp();

        const res = await request(app)
            .post('/api/linked-accounts/plex')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Plex token is required');
    });
});
