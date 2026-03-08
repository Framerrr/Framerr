/**
 * AppBrandingProvider — Behavior Lock Characterization Tests
 *
 * TASK-20260305-009 / REMEDIATION-2026-P3 / S-F4-03
 *
 * These tests lock the branding behavior provided by AppBrandingProvider.
 *
 * Behavior Locks:
 *   BL-BR-1 — Type contract: AppBrandingContextValue exposes serverName, serverIcon, brandingLoaded
 *   BL-BR-2 — Provider mount: branding populated from /api/config/app-name fetch
 *   BL-BR-3 — Event refresh: systemConfigUpdated triggers refetch
 *   BL-BR-4 — SSE invalidation: app-config entity triggers refetch
 *   BL-BR-5 — Visibility refresh: tab restored after 30s+ triggers refetch
 *   BL-BR-6 — Fallback defaults: endpoint failure returns defaults (Framerr/Server)
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

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: '1', username: 'admin', displayName: 'Admin', role: 'admin' },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
    }),
}));

vi.mock('@/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Global fetch mock for branding endpoint
const mockFetchBranding = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ name: 'TestServer', icon: 'TestIcon' }),
});

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { AppBrandingProvider, useAppBranding } from '../AppBrandingProvider';
import type { AppBrandingContextValue } from '../AppBrandingProvider';

// ============================================================================
// HELPERS
// ============================================================================

function createWrapper() {
    return function TestWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(AppBrandingProvider, null, children);
    };
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsInvalidateCallback = null;

    // Mock global fetch for branding
    vi.stubGlobal('fetch', mockFetchBranding);

    // Reset mock implementations to defaults
    mockFetchBranding.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'TestServer', icon: 'TestIcon' }),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ============================================================================
// BL-BR-1: Type contract
// ============================================================================

describe('BL-BR-1: Type contract', () => {
    it('AppBrandingContextValue includes serverName, serverIcon, brandingLoaded', () => {
        const assertHasField = <K extends keyof AppBrandingContextValue>(_key: K): void => {
            // Type-level assertion only
        };

        assertHasField('serverName');
        assertHasField('serverIcon');
        assertHasField('brandingLoaded');

        expect(true).toBe(true);
    });
});

// ============================================================================
// BL-BR-2: Provider mount and data population
// ============================================================================

describe('BL-BR-2: Provider mount and data population', () => {
    it('populates serverName and serverIcon from branding API', async () => {
        const { result } = renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.serverName).toBe('TestServer');
        });

        expect(result.current.serverIcon).toBe('TestIcon');
        expect(result.current.brandingLoaded).toBe(true);
    });
});

// ============================================================================
// BL-BR-3: Event refresh triggers
// ============================================================================

describe('BL-BR-3: Event refresh triggers', () => {
    it('systemConfigUpdated event triggers refetch', async () => {
        renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockFetchBranding).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockFetchBranding.mock.calls.length;

        act(() => {
            window.dispatchEvent(new Event('systemConfigUpdated'));
        });

        await waitFor(() => {
            expect(mockFetchBranding.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});

// ============================================================================
// BL-BR-4: SSE app-config invalidation
// ============================================================================

describe('BL-BR-4: SSE app-config invalidation', () => {
    it('app-config entity triggers refetch via onSettingsInvalidate', async () => {
        renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        // Wait for initial load
        await waitFor(() => {
            expect(mockFetchBranding).toHaveBeenCalledTimes(1);
        });

        // onSettingsInvalidate should have been called with a callback
        expect(mockOnSettingsInvalidate).toHaveBeenCalled();

        const initialCallCount = mockFetchBranding.mock.calls.length;

        // Trigger SSE invalidation
        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'app-config' });
            }
        });

        await waitFor(() => {
            expect(mockFetchBranding.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it('non-app-config entity does NOT trigger refetch', async () => {
        renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockFetchBranding).toHaveBeenCalledTimes(1);
        });

        const callCountBefore = mockFetchBranding.mock.calls.length;

        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'other-entity' });
            }
        });

        // Small delay to let any potential async work fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockFetchBranding.mock.calls.length).toBe(callCountBefore);
    });
});

// ============================================================================
// BL-BR-5: Visibility refresh after 30s+
// ============================================================================

describe('BL-BR-5: Visibility refresh', () => {
    it('tab restored after 30s+ hidden triggers refetch', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockFetchBranding).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockFetchBranding.mock.calls.length;

        // Simulate hiding the tab
        Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // Advance time by 35 seconds
        vi.advanceTimersByTime(35000);

        // Simulate showing the tab
        Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => {
            expect(mockFetchBranding.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        vi.useRealTimers();
    });
});

// ============================================================================
// BL-BR-6: Fallback defaults on endpoint failure
// ============================================================================

describe('BL-BR-6: Fallback defaults on endpoint failure', () => {
    it('returns Framerr/Server defaults when fetch throws', async () => {
        mockFetchBranding.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.brandingLoaded).toBe(true);
        });

        expect(result.current.serverName).toBe('Framerr');
        expect(result.current.serverIcon).toBe('Server');
    });

    it('returns Framerr/Server defaults when fetch returns non-OK', async () => {
        mockFetchBranding.mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({}),
        });

        const { result } = renderHook(() => useAppBranding(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.brandingLoaded).toBe(true);
        });

        expect(result.current.serverName).toBe('Framerr');
        expect(result.current.serverIcon).toBe('Server');
    });
});
