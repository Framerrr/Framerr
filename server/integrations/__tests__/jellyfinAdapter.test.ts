/**
 * Jellyfin Adapter Tests — DB Re-Read Retry Path
 * 
 * Tests the reauthentication interceptor's DB re-read behavior.
 * The Emby adapter uses an identical pattern — keeping parity is enforced
 * by matching the adapter structure 1:1 (see server/integrations/emby/adapter.ts).
 * 
 * Covers: TASK-20260305-007 (Jellyfin/Emby Reauth Loop Fix)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { AxiosResponse } from 'axios';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../../utils/reauth', () => ({
    reauthenticate: vi.fn(),
}));

vi.mock('../../db/integrationInstances', () => ({
    getInstanceById: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../utils/urlHelper', () => ({
    translateHostUrl: vi.fn((url: string) => url),
}));

vi.mock('../../utils/httpsAgent', () => ({
    httpsAgent: undefined,
}));

// Mock the dynamic import of RealtimeOrchestrator
vi.mock('../../services/sse/RealtimeOrchestrator', () => ({
    realtimeOrchestrator: {
        refreshConnection: vi.fn(),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { JellyfinAdapter } from '../../integrations/jellyfin/adapter';
import { reauthenticate } from '../../utils/reauth';
import { getInstanceById } from '../../db/integrationInstances';
import { AdapterError } from '../../integrations/errors';
import { BaseAdapter } from '../../integrations/BaseAdapter';
import type { PluginInstance } from '../../integrations/types';

const mockReauthenticate = reauthenticate as Mock;
const mockGetInstanceById = getInstanceById as Mock;

// ============================================================================
// HELPERS
// ============================================================================

function makePluginInstance(overrides: Partial<PluginInstance> = {}): PluginInstance {
    return {
        id: 'jf-instance-1',
        type: 'jellyfin',
        name: 'Test Jellyfin',
        config: {
            url: 'http://jellyfin:8096',
            apiKey: 'original-stale-token',
            userId: 'user-1',
        },
        ...overrides,
    };
}

function makeAxiosResponse(data: unknown = {}): AxiosResponse {
    return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
    };
}

// ============================================================================
// TESTS
// ============================================================================

describe('JellyfinAdapter request() reauth interceptor', () => {
    let adapter: JellyfinAdapter;
    let superRequestSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new JellyfinAdapter();

        // Spy on BaseAdapter.prototype.request to control its behavior
        superRequestSpy = vi.spyOn(BaseAdapter.prototype, 'request');
    });

    // -----------------------------------------------------------------------
    // 1. AUTH_FAILED → reauth → DB re-read → retry with DB config
    // -----------------------------------------------------------------------
    it('should re-read instance from DB after successful reauth and retry', async () => {
        const instance = makePluginInstance();
        const authError = new AdapterError('AUTH_FAILED', 'Token expired');

        // First call: AUTH_FAILED
        // Second call (retry): success
        superRequestSpy
            .mockRejectedValueOnce(authError)
            .mockResolvedValueOnce(makeAxiosResponse({ ok: true }));

        // Reauth succeeds
        mockReauthenticate.mockResolvedValue({
            success: true,
            newApiKey: 'reauth-token-abc',
        });

        // DB returns refreshed config (with a DIFFERENT token than reauth returned,
        // simulating a concurrent reauth that wrote a newer token)
        mockGetInstanceById.mockReturnValue({
            id: 'jf-instance-1',
            type: 'jellyfin',
            name: 'Test Jellyfin',
            config: {
                url: 'http://jellyfin:8096',
                apiKey: 'latest-db-token',
                userId: 'user-1',
            },
        });

        const result = await adapter.request(instance, 'GET', '/System/Info');

        expect(result.data).toEqual({ ok: true });

        // Verify the retry used the DB config, not the in-memory stale config
        const retryCall = superRequestSpy.mock.calls[1];
        const retryInstance = retryCall[0] as PluginInstance;
        expect(retryInstance.config.apiKey).toBe('latest-db-token');
        expect(retryInstance.config.apiKey).not.toBe('original-stale-token');

        // Verify getInstanceById was called
        expect(mockGetInstanceById).toHaveBeenCalledWith('jf-instance-1');
    });

    // -----------------------------------------------------------------------
    // 2. DB re-read returns null → throws original error
    // -----------------------------------------------------------------------
    it('should throw original error if instance not found in DB after reauth', async () => {
        const instance = makePluginInstance();
        const authError = new AdapterError('AUTH_FAILED', 'Token expired');

        superRequestSpy.mockRejectedValueOnce(authError);

        mockReauthenticate.mockResolvedValue({
            success: true,
            newApiKey: 'reauth-token-abc',
        });

        // Instance deleted from DB during reauth
        mockGetInstanceById.mockReturnValue(null);

        await expect(adapter.request(instance, 'GET', '/System/Info'))
            .rejects.toThrow(authError);
    });

    // -----------------------------------------------------------------------
    // 3. Non-AUTH_FAILED errors pass through without reauth
    // -----------------------------------------------------------------------
    it('should not attempt reauth for non-AUTH_FAILED errors', async () => {
        const instance = makePluginInstance();
        const networkError = new AdapterError('SERVICE_UNREACHABLE', 'Connection refused');

        superRequestSpy.mockRejectedValueOnce(networkError);

        await expect(adapter.request(instance, 'GET', '/System/Info'))
            .rejects.toThrow(networkError);

        // Reauth should NOT have been called
        expect(mockReauthenticate).not.toHaveBeenCalled();
        expect(mockGetInstanceById).not.toHaveBeenCalled();
    });
});
