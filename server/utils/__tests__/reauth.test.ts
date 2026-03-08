/**
 * Reauth Utility Tests
 * 
 * Tests for the reauthentication mutex, unique DeviceId, and error handling.
 * Covers: TASK-20260305-007 (Jellyfin/Emby Reauth Loop Fix)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { AxiosResponse } from 'axios';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../../db/integrationInstances', () => ({
    getInstanceById: vi.fn(),
    updateInstance: vi.fn(),
}));

vi.mock('../../utils/urlHelper', () => ({
    translateHostUrl: vi.fn((url: string) => url),
}));

vi.mock('../../utils/httpsAgent', () => ({
    httpsAgent: undefined,
}));

vi.mock('../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { reauthenticate } from '../reauth';
import { getInstanceById, updateInstance } from '../../db/integrationInstances';
import axios from 'axios';

// ============================================================================
// HELPERS
// ============================================================================

const mockGetInstanceById = getInstanceById as Mock;
const mockUpdateInstance = updateInstance as Mock;
const mockAxiosPost = axios.post as Mock;

function makeInstance(overrides: Record<string, unknown> = {}) {
    return {
        id: 'test-instance-1',
        type: 'jellyfin',
        name: 'Test Jellyfin',
        config: {
            url: 'http://jellyfin:8096',
            apiKey: 'old-token',
            userId: 'user-1',
            jellyfinUsername: 'admin',
            jellyfinPassword: 'pass123',
            ...overrides,
        },
    };
}

function makeAuthResponse(token = 'new-access-token') {
    return {
        data: {
            AccessToken: token,
            User: { Id: 'user-1', Name: 'admin' },
        },
        status: 200,
    } as AxiosResponse;
}

// ============================================================================
// TESTS
// ============================================================================

describe('reauthenticate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // 1. Successful reauth (happy path)
    // -----------------------------------------------------------------------
    it('should authenticate and update DB with fresh token', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());
        mockAxiosPost.mockResolvedValue(makeAuthResponse('fresh-token-123'));

        const result = await reauthenticate('test-instance-1');

        expect(result.success).toBe(true);
        expect(result.newApiKey).toBe('fresh-token-123');

        // Verify DB was updated with new token
        expect(mockUpdateInstance).toHaveBeenCalledWith('test-instance-1', {
            config: expect.objectContaining({
                apiKey: 'fresh-token-123',
                userId: 'user-1',
                needsReauth: false,
            }),
        });
    });

    // -----------------------------------------------------------------------
    // 2. Mutex deduplication — concurrent calls share one request
    // -----------------------------------------------------------------------
    it('should deduplicate concurrent reauth calls for the same instance', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());

        // Make axios.post take some time to resolve
        let resolvePost: (value: AxiosResponse) => void;
        const postPromise = new Promise<AxiosResponse>((resolve) => {
            resolvePost = resolve;
        });
        mockAxiosPost.mockReturnValue(postPromise);

        // Fire two concurrent calls
        const promise1 = reauthenticate('test-instance-1');
        const promise2 = reauthenticate('test-instance-1');

        // Resolve the single auth request
        resolvePost!(makeAuthResponse('shared-token'));

        const [result1, result2] = await Promise.all([promise1, promise2]);

        // Both should succeed with the same token
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        expect(result1.newApiKey).toBe('shared-token');
        expect(result2.newApiKey).toBe('shared-token');

        // axios.post should have been called only ONCE
        expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // 3. Mutex cleanup on failure — lock released after rejection
    // -----------------------------------------------------------------------
    it('should release mutex lock on failed reauth', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());

        // First call: network error
        mockAxiosPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const result1 = await reauthenticate('test-instance-1');
        expect(result1.success).toBe(false);

        // Second call should create a NEW request (lock was cleaned up)
        mockAxiosPost.mockResolvedValueOnce(makeAuthResponse('recovery-token'));
        const result2 = await reauthenticate('test-instance-1');
        expect(result2.success).toBe(true);
        expect(result2.newApiKey).toBe('recovery-token');

        // Two separate calls, not deduped
        expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    // -----------------------------------------------------------------------
    // 4. Unique DeviceId — not static, different per call
    // -----------------------------------------------------------------------
    it('should use unique DeviceId per reauth attempt', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());
        mockAxiosPost.mockResolvedValue(makeAuthResponse());

        // Make two sequential reauth calls
        await reauthenticate('test-instance-1');
        await reauthenticate('test-instance-1');

        const call1Headers = mockAxiosPost.mock.calls[0][2].headers.Authorization as string;
        const call2Headers = mockAxiosPost.mock.calls[1][2].headers.Authorization as string;

        // Extract DeviceId from auth headers
        const deviceId1 = call1Headers.match(/DeviceId="([^"]+)"/)?.[1];
        const deviceId2 = call2Headers.match(/DeviceId="([^"]+)"/)?.[1];

        // Should NOT be the old static value
        expect(deviceId1).not.toBe('framerr-reauth');
        expect(deviceId2).not.toBe('framerr-reauth');

        // Should be unique per call
        expect(deviceId1).not.toBe(deviceId2);

        // Should match the framerr-XXXXXXXX format
        expect(deviceId1).toMatch(/^framerr-[a-f0-9]{8}$/);
        expect(deviceId2).toMatch(/^framerr-[a-f0-9]{8}$/);
    });

    // -----------------------------------------------------------------------
    // 5. No credentials → marks needsReauth
    // -----------------------------------------------------------------------
    it('should mark needsReauth when no credentials stored', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance({ jellyfinUsername: undefined }));

        const result = await reauthenticate('test-instance-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('No stored credentials');
        expect(mockUpdateInstance).toHaveBeenCalledWith('test-instance-1', {
            config: expect.objectContaining({ needsReauth: true }),
        });
        // Should NOT have attempted auth
        expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 6. 401 on auth → marks needsReauth
    // -----------------------------------------------------------------------
    it('should mark needsReauth on 401 auth rejection', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());
        mockAxiosPost.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });

        const result = await reauthenticate('test-instance-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('credentials are no longer valid');
        expect(mockUpdateInstance).toHaveBeenCalledWith('test-instance-1', {
            config: expect.objectContaining({ needsReauth: true }),
        });
    });

    // -----------------------------------------------------------------------
    // 7. Network error → does NOT mark needsReauth (transient)
    // -----------------------------------------------------------------------
    it('should NOT mark needsReauth on transient network error', async () => {
        mockGetInstanceById.mockReturnValue(makeInstance());
        mockAxiosPost.mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await reauthenticate('test-instance-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Re-authentication failed');
        // updateInstance should NOT have been called (no needsReauth for transient)
        expect(mockUpdateInstance).not.toHaveBeenCalled();
    });
});
