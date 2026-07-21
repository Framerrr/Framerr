/**
 * Tests for Prowlarr Proxy Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

const mockGetInstanceById = vi.fn();
vi.mock('../db/integrationInstances', () => ({
    getInstanceById: (...args: unknown[]) => mockGetInstanceById(...args),
}));

const mockUserHasIntegrationAccess = vi.fn();
vi.mock('../db/integrationShares', () => ({
    userHasIntegrationAccess: (...args: unknown[]) => mockUserHasIntegrationAccess(...args),
}));

const mockAdapterGet = vi.fn();
const mockAdapterRequest = vi.fn();
vi.mock('../integrations/registry', () => ({
    getPlugin: () => ({
        adapter: {
            get: (...args: unknown[]) => mockAdapterGet(...args),
            request: (...args: unknown[]) => mockAdapterRequest(...args),
        },
    }),
}));

vi.mock('../integrations/utils', () => ({
    toPluginInstance: <T>(instance: T) => instance,
}));

vi.mock('../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../utils/httpsAgent', () => ({ httpsAgent: undefined }));
vi.mock('../utils/urlHelper', () => ({ translateHostUrl: (url: string) => url }));

vi.mock('../middleware/auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockTriggerTopicPoll = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/sse/PollerOrchestrator', () => ({
    triggerTopicPoll: (...args: unknown[]) => mockTriggerTopicPoll(...args),
}));

const MOCK_INSTANCE = {
    id: 'prowlarr-abc',
    type: 'prowlarr',
    config: { url: 'http://prowlarr:9696', apiKey: 'test-key' },
    enabled: true,
};

const FULL_INDEXER = {
    id: 5,
    name: 'TestIndexer',
    enable: true,
    protocol: 'torrent',
    privacy: 'private',
    priority: 25,
    implementation: 'Cardigann',
    configContract: 'CardigannSettings',
    fields: [{ name: 'baseUrl', value: 'https://example.com' }],
    tags: [1],
};

import proxyRouter from '../routes/integrations/prowlarr/proxy';

function createTestApp(userGroup: 'admin' | 'user' = 'admin') {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: () => void) => {
        (req as Request & { user?: { id: string; username: string; group: string; isAdmin: boolean } }).user = {
            id: 'user-1',
            username: 'testuser',
            group: userGroup,
            isAdmin: userGroup === 'admin',
        };
        next();
    });
    app.use('/', proxyRouter);
    return app;
}

describe('Prowlarr Proxy Routes', () => {
    let adminApp: ReturnType<typeof createTestApp>;
    let userApp: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        adminApp = createTestApp('admin');
        userApp = createTestApp('user');
        mockGetInstanceById.mockReturnValue(MOCK_INSTANCE);
        mockUserHasIntegrationAccess.mockResolvedValue(true);
    });

    describe('POST /:id/proxy/indexer/:indexerId/enable', () => {
        it('returns 403 for non-admin', async () => {
            const res = await request(userApp)
                .post('/prowlarr-abc/proxy/indexer/5/enable')
                .send({ enabled: false });

            expect(res.status).toBe(403);
            expect(mockAdapterGet).not.toHaveBeenCalled();
        });

        it('GET-then-PUT preserves all fields except enable', async () => {
            mockAdapterGet.mockResolvedValue({ data: { ...FULL_INDEXER } });
            mockAdapterRequest.mockResolvedValue({ data: { ...FULL_INDEXER, enable: false } });

            const res = await request(adminApp)
                .post('/prowlarr-abc/proxy/indexer/5/enable')
                .send({ enabled: false });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true });

            expect(mockAdapterGet).toHaveBeenCalledWith(
                expect.objectContaining({ config: MOCK_INSTANCE.config }),
                '/api/v1/indexer/5',
                expect.objectContaining({ timeout: 10000 })
            );

            const putCall = mockAdapterRequest.mock.calls[0];
            expect(putCall[1]).toBe('PUT');
            expect(putCall[2]).toBe('/api/v1/indexer/5');
            expect(putCall[4]).toEqual(
                expect.objectContaining({
                    params: { forceSave: true },
                    timeout: 15000,
                })
            );

            const putBody = putCall[3] as typeof FULL_INDEXER;
            expect(putBody.enable).toBe(false);
            expect(putBody.name).toBe(FULL_INDEXER.name);
            expect(putBody.fields).toEqual(FULL_INDEXER.fields);
            expect(putBody.tags).toEqual(FULL_INDEXER.tags);
            expect(putBody.implementation).toBe(FULL_INDEXER.implementation);

            expect(mockTriggerTopicPoll).toHaveBeenCalledWith('prowlarr:prowlarr-abc');
        });
    });

    describe('POST /:id/proxy/indexer/testall', () => {
        it('returns 403 for non-admin', async () => {
            const res = await request(userApp).post('/prowlarr-abc/proxy/indexer/testall');

            expect(res.status).toBe(403);
            expect(mockAdapterRequest).not.toHaveBeenCalled();
        });

        it('POSTs Prowlarr testall and refreshes poll', async () => {
            mockAdapterRequest.mockResolvedValue({ data: [] });

            const res = await request(adminApp).post('/prowlarr-abc/proxy/indexer/testall');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasFailures).toBe(false);
            expect(mockAdapterRequest).toHaveBeenCalledWith(
                expect.objectContaining({ config: MOCK_INSTANCE.config }),
                'POST',
                '/api/v1/indexer/testall',
                undefined,
                expect.objectContaining({ timeout: 120000 })
            );
            expect(mockTriggerTopicPoll).toHaveBeenCalledWith('prowlarr:prowlarr-abc');
        });

        it('treats Prowlarr HTTP 400 as completed with failures', async () => {
            const { AdapterError } = await import('../integrations/errors');
            mockAdapterRequest.mockRejectedValue(
                new AdapterError('REQUEST_ERROR', 'prowlarr request failed (HTTP 400)', {
                    status: 400,
                    data: [{ id: 1, isValid: false, validationFailures: [{ errorMessage: 'Unable to connect' }] }],
                })
            );

            const res = await request(adminApp).post('/prowlarr-abc/proxy/indexer/testall');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasFailures).toBe(true);
            expect(res.body.failedCount).toBe(1);
            expect(res.body.message).toBe('1 indexer failed: Unable to connect');
            expect(mockTriggerTopicPoll).toHaveBeenCalledWith('prowlarr:prowlarr-abc');
        });

        it('summarizes multiple failures without listing each detail', async () => {
            const { AdapterError } = await import('../integrations/errors');
            mockAdapterRequest.mockRejectedValue(
                new AdapterError('REQUEST_ERROR', 'prowlarr request failed (HTTP 400)', {
                    status: 400,
                    data: [
                        { id: 1, isValid: false, validationFailures: [{ errorMessage: 'Unable to connect' }] },
                        { id: 2, isValid: false, validationFailures: [{ errorMessage: 'Timeout' }] },
                        { id: 3, isValid: true, validationFailures: [] },
                    ],
                })
            );

            const res = await request(adminApp).post('/prowlarr-abc/proxy/indexer/testall');

            expect(res.status).toBe(200);
            expect(res.body.hasFailures).toBe(true);
            expect(res.body.failedCount).toBe(2);
            expect(res.body.message).toBe('2 indexers failed');
        });
    });

    describe('POST /:id/proxy/indexer/:indexerId/test', () => {
        it('returns 403 for non-admin', async () => {
            const res = await request(userApp).post('/prowlarr-abc/proxy/indexer/5/test');

            expect(res.status).toBe(403);
            expect(mockAdapterGet).not.toHaveBeenCalled();
        });

        it('GET-then-POST /indexer/test with full resource', async () => {
            mockAdapterGet.mockResolvedValue({ data: { ...FULL_INDEXER } });
            mockAdapterRequest.mockResolvedValue({ data: {} });

            const res = await request(adminApp).post('/prowlarr-abc/proxy/indexer/5/test');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasFailures).toBe(false);

            expect(mockAdapterGet).toHaveBeenCalledWith(
                expect.objectContaining({ config: MOCK_INSTANCE.config }),
                '/api/v1/indexer/5',
                expect.objectContaining({ timeout: 10000 })
            );

            const testCall = mockAdapterRequest.mock.calls[0];
            expect(testCall[1]).toBe('POST');
            expect(testCall[2]).toBe('/api/v1/indexer/test');
            expect(testCall[3]).toEqual(FULL_INDEXER);
            expect(mockTriggerTopicPoll).toHaveBeenCalledWith('prowlarr:prowlarr-abc');
        });

        it('treats Prowlarr HTTP 400 as completed with failures', async () => {
            const { AdapterError } = await import('../integrations/errors');
            mockAdapterGet.mockResolvedValue({ data: { ...FULL_INDEXER } });
            mockAdapterRequest.mockRejectedValue(
                new AdapterError('REQUEST_ERROR', 'prowlarr request failed (HTTP 400)', {
                    status: 400,
                    data: [{ errorMessage: 'Query successful, but no results in configured categories' }],
                })
            );

            const res = await request(adminApp).post('/prowlarr-abc/proxy/indexer/5/test');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasFailures).toBe(true);
            expect(res.body.message).toBe('Query successful, but no results in configured categories');
            expect(mockTriggerTopicPoll).toHaveBeenCalledWith('prowlarr:prowlarr-abc');
        });
    });
});
