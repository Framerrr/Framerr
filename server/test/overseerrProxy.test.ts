/**
 * Tests for Overseerr Proxy Routes (Phase 2)
 *
 * Tests the new search, request, TV details, quota, permissions,
 * and servers proxy routes including caching and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

// ============================================================================
// Mocks
// ============================================================================

const mockGetInstanceById = vi.fn();
vi.mock('../db/integrationInstances', () => ({
    getInstanceById: (...args: unknown[]) => mockGetInstanceById(...args),
}));

const mockUserHasIntegrationAccess = vi.fn();
vi.mock('../db/integrationShares', () => ({
    userHasIntegrationAccess: (...args: unknown[]) => mockUserHasIntegrationAccess(...args),
}));

const mockGetLinkedAccount = vi.fn();
vi.mock('../db/linkedAccounts', () => ({
    getLinkedAccount: (...args: unknown[]) => mockGetLinkedAccount(...args),
}));

const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
    default: {
        get: (...args: unknown[]) => mockAxiosGet(...args),
        post: (...args: unknown[]) => mockAxiosPost(...args),
    },
}));

vi.mock('../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../utils/httpsAgent', () => ({ httpsAgent: undefined }));
vi.mock('../utils/urlHelper', () => ({ translateHostUrl: (url: string) => url }));

// Mock requireAuth to pass through (user is injected in createTestApp)
vi.mock('../middleware/auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ============================================================================
// Test Data
// ============================================================================

const MOCK_INSTANCE = {
    id: 'overseerr-abc',
    type: 'overseerr',
    config: { url: 'http://overseerr:5055', apiKey: 'test-key' },
    enabled: true,
};

// ============================================================================
// App Setup
// ============================================================================

import proxyRouter, { __resetForTesting } from '../routes/integrations/overseerr/proxy';

function createTestApp() {
    const app = express();
    app.use(express.json());
    // Inject fake admin user
    app.use((req: Request, _res: Response, next: () => void) => {
        (req as Request & { user?: { id: string; username: string; group: string; isAdmin: boolean } }).user = {
            id: 'user-1',
            username: 'testuser',
            group: 'admin',
            isAdmin: true,
        };
        next();
    });
    app.use('/', proxyRouter);
    return app;
}

// ============================================================================
// Tests
// ============================================================================

describe('Overseerr Proxy Routes - Phase 2', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        __resetForTesting();
        app = createTestApp();
        mockGetInstanceById.mockReturnValue(MOCK_INSTANCE);
    });

    // ========================================================================
    // GET /:id/proxy/search
    // ========================================================================

    describe('GET /:id/proxy/search', () => {
        it('should return search results from Overseerr', async () => {
            mockAxiosGet.mockResolvedValue({
                data: {
                    results: [{ id: 1, title: 'Test Movie', mediaType: 'movie' }],
                    pageInfo: { pages: 1, page: 1, results: 1 },
                },
            });

            const res = await request(app)
                .get('/overseerr-abc/proxy/search')
                .query({ query: 'test' });

            expect(res.status).toBe(200);
            expect(res.body.results).toHaveLength(1);
            expect(res.body.results[0].title).toBe('Test Movie');
        });

        it('should reject queries shorter than 2 characters', async () => {
            const res = await request(app)
                .get('/overseerr-abc/proxy/search')
                .query({ query: 'a' });

            expect(res.status).toBe(400);
            expect(mockAxiosGet).not.toHaveBeenCalled();
        });

        it('should limit results to 10', async () => {
            const results = Array.from({ length: 20 }, (_, i) => ({ id: i, title: `Movie ${i}` }));
            mockAxiosGet.mockResolvedValue({
                data: { results, pageInfo: { pages: 1, page: 1, results: 20 } },
            });

            const res = await request(app)
                .get('/overseerr-abc/proxy/search')
                .query({ query: 'limit-test' });

            expect(res.status).toBe(200);
            expect(res.body.results).toHaveLength(10);
        });

        it('should return 404 for non-overseerr instance', async () => {
            mockGetInstanceById.mockReturnValue({ ...MOCK_INSTANCE, type: 'radarr' });

            const res = await request(app)
                .get('/overseerr-abc/proxy/search')
                .query({ query: 'notfound-test' });

            expect(res.status).toBe(404);
        });
    });

    // ========================================================================
    // POST /:id/proxy/request
    // ========================================================================

    describe('POST /:id/proxy/request', () => {
        it('should create a request for admin without requiring linked account', async () => {
            mockAxiosPost.mockResolvedValue({ data: { id: 1, status: 'pending' } });

            const res = await request(app)
                .post('/overseerr-abc/proxy/request')
                .send({ mediaType: 'movie', mediaId: 123 });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('pending');
            // Admin does NOT need linked account
            expect(mockGetLinkedAccount).not.toHaveBeenCalled();
        });

        it('should forward Overseerr error status codes', async () => {
            mockAxiosPost.mockRejectedValue({
                response: { status: 409, data: { message: 'Already requested' } },
                message: 'Request failed',
            });

            const res = await request(app)
                .post('/overseerr-abc/proxy/request')
                .send({ mediaType: 'movie', mediaId: 123 });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Already requested');
        });
    });

    // ========================================================================
    // GET /:id/proxy/tv/:tmdbId
    // ========================================================================

    describe('GET /:id/proxy/tv/:tmdbId', () => {
        it('should return TV details', async () => {
            mockAxiosGet.mockResolvedValue({
                data: { id: 456, name: 'Test Show', numberOfSeasons: 3 },
            });

            const res = await request(app).get('/overseerr-abc/proxy/tv/456');

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Show');
            expect(res.body.numberOfSeasons).toBe(3);
        });
    });

    // ========================================================================
    // GET /:id/proxy/user/permissions
    // ========================================================================

    describe('GET /:id/proxy/user/permissions', () => {
        it('should return full permissions for Framerr admin', async () => {
            const res = await request(app).get('/overseerr-abc/proxy/user/permissions');

            expect(res.status).toBe(200);
            expect(res.body.isAdmin).toBe(true);
            expect(res.body.permissions).toBe(0xFFFFFFFF);
        });
    });

    // ========================================================================
    // GET /:id/proxy/servers
    // ========================================================================

    describe('GET /:id/proxy/servers', () => {
        it('should return Radarr and Sonarr server lists', async () => {
            mockAxiosGet.mockImplementation((url: string) => {
                if (url.includes('/settings/radarr')) {
                    return Promise.resolve({ data: [{ id: 1, name: 'Radarr', is4k: false }] });
                }
                if (url.includes('/settings/sonarr')) {
                    return Promise.resolve({ data: [{ id: 2, name: 'Sonarr 4K', is4k: true }] });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const res = await request(app).get('/overseerr-abc/proxy/servers');

            expect(res.status).toBe(200);
            expect(res.body.radarr).toHaveLength(1);
            expect(res.body.sonarr).toHaveLength(1);
            expect(res.body.sonarr[0].is4k).toBe(true);
        });
    });
});
