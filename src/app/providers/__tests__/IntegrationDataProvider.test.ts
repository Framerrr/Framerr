/**
 * IntegrationDataProvider — Behavior Lock Tests
 *
 * TASK-20260305-008 / REMEDIATION-2026-P3 / S-F4-02
 *
 * These tests lock the behavior of the new IntegrationDataProvider after
 * These tests lock the integration data management behavior.
 *
 * Behavior Locks:
 *   BL-INT-1  — Type contract: useIntegrationData() provides integrations, integrationsLoaded, integrationsError
 *   BL-INT-2  — Provider mount: integrations populated from admin fetch
 *   BL-INT-3  — Event refresh: integrationsUpdated AND systemConfigUpdated trigger refetch
 *   BL-INT-4  — SSE invalidation: app-config entity triggers refetch
 *   BL-INT-5  — Tab visibility: 30s+ hidden tab restore triggers refetch
 *   BL-INT-6  — Consumer characterization: useIntegration returns correct config through provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ============================================================================
// MOCKS — Must be before imports that use them
// ============================================================================

let mockSettingsInvalidateCallback: ((event: { entity: string }) => void) | null = null;
const mockOnSettingsInvalidate = vi.fn((cb: (event: { entity: string }) => void) => {
    mockSettingsInvalidateCallback = cb;
    return vi.fn(); // unsubscribe
});

vi.mock('@/hooks/useRealtimeSSE', () => ({
    default: () => ({
        onSettingsInvalidate: mockOnSettingsInvalidate,
    }),
}));

const mockUser = { id: '1', username: 'admin', displayName: 'Admin', role: 'admin' };
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
    }),
}));

vi.mock('@/utils/permissions', () => ({
    isAdmin: () => true,
}));

vi.mock('@/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

const mockIntegrationsGetAll = vi.fn().mockResolvedValue([
    { type: 'sonarr', enabled: true, url: 'http://sonarr:8989', apiKey: 'abc' },
    { type: 'radarr', enabled: true, url: 'http://radarr:7878', apiKey: 'def' },
]);

const mockIntegrationsGetShared = vi.fn().mockResolvedValue({
    integrations: [],
});

vi.mock('@/api/endpoints/integrations', () => ({
    integrationsApi: {
        getAll: (...args: unknown[]) => mockIntegrationsGetAll(...args),
        getShared: (...args: unknown[]) => mockIntegrationsGetShared(...args),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { IntegrationDataProvider, useIntegrationData } from '../IntegrationDataProvider';
import type { IntegrationDataContextValue } from '../IntegrationDataProvider';
import { useIntegration } from '../../../hooks/useIntegration';

// ============================================================================
// HELPERS
// ============================================================================

function createWrapper() {
    return function TestWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(IntegrationDataProvider, null, children);
    };
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsInvalidateCallback = null;

    mockIntegrationsGetAll.mockResolvedValue([
        { type: 'sonarr', enabled: true, url: 'http://sonarr:8989', apiKey: 'abc' },
        { type: 'radarr', enabled: true, url: 'http://radarr:7878', apiKey: 'def' },
    ]);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ============================================================================
// BL-INT-1: Type contract
// ============================================================================

describe('BL-INT-1: Type contract', () => {
    it('useIntegrationData() provides integrations, integrationsLoaded, integrationsError', () => {
        const assertHasField = <K extends keyof IntegrationDataContextValue>(_key: K): void => {
            // Type-level assertion only
        };

        assertHasField('integrations');
        assertHasField('integrationsLoaded');
        assertHasField('integrationsError');

        expect(true).toBe(true);
    });
});

// ============================================================================
// BL-INT-2: Provider mount — integrations populated from admin fetch
// ============================================================================

describe('BL-INT-2: Provider mount and data population', () => {
    it('populates integrations from admin fetch', async () => {
        const { result } = renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });

        expect(result.current.integrations).toHaveProperty('sonarr');
        expect(result.current.integrations).toHaveProperty('radarr');
    });

    it('sets integrationsLoaded to true after fetch', async () => {
        const { result } = renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });
    });

    it('sets integrationsError to null on success', async () => {
        const { result } = renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });

        expect(result.current.integrationsError).toBeNull();
    });
});

// ============================================================================
// BL-INT-3: Event refresh triggers
// ============================================================================

describe('BL-INT-3: Event refresh triggers', () => {
    it('integrationsUpdated event triggers refetch', async () => {
        renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockIntegrationsGetAll.mock.calls.length;

        act(() => {
            window.dispatchEvent(new Event('integrationsUpdated'));
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it('systemConfigUpdated event triggers refetch', async () => {
        renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockIntegrationsGetAll.mock.calls.length;

        act(() => {
            window.dispatchEvent(new Event('systemConfigUpdated'));
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});

// ============================================================================
// BL-INT-4: SSE app-config invalidation
// ============================================================================

describe('BL-INT-4: SSE app-config invalidation', () => {
    it('app-config entity triggers refetch via onSettingsInvalidate', async () => {
        renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll).toHaveBeenCalledTimes(1);
        });

        expect(mockOnSettingsInvalidate).toHaveBeenCalled();

        const initialCallCount = mockIntegrationsGetAll.mock.calls.length;

        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'app-config' });
            }
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it('non-app-config entity does NOT trigger refetch', async () => {
        renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll).toHaveBeenCalledTimes(1);
        });

        const callCountBefore = mockIntegrationsGetAll.mock.calls.length;

        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'other-entity' });
            }
        });

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockIntegrationsGetAll.mock.calls.length).toBe(callCountBefore);
    });
});

// ============================================================================
// BL-INT-5: Visibility refresh after 30s+
// ============================================================================

describe('BL-INT-5: Visibility refresh', () => {
    it('tab restored after 30s+ hidden triggers refetch', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        renderHook(() => useIntegrationData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockIntegrationsGetAll).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockIntegrationsGetAll.mock.calls.length;

        // Simulate hiding the tab
        Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // Advance time by 35 seconds
        vi.advanceTimersByTime(35000);

        // Simulate showing the tab
        Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => {
            expect(mockIntegrationsGetAll.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        vi.useRealTimers();
    });
});

// ============================================================================
// BL-INT-6: Consumer characterization
// ============================================================================

describe('BL-INT-6: Consumer characterization', () => {
    it('useIntegration returns correct config for existing integration', async () => {
        const { result } = renderHook(() => useIntegration('sonarr'), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.enabled).toBe(true);
        });

        expect(result.current.url).toBe('http://sonarr:8989');
        expect(result.current.apiKey).toBe('abc');
    });

    it('useIntegration returns default disabled config for missing integration', async () => {
        const { result } = renderHook(() => useIntegration('nonexistent'), {
            wrapper: createWrapper(),
        });

        // Wait for provider to load
        await waitFor(() => {
            // Default config should have enabled: false
            expect(result.current.enabled).toBe(false);
        });
    });
});
