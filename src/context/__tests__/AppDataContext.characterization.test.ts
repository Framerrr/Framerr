/**
 * AppDataContext — Behavior Lock Characterization Tests
 *
 * TASK-20260304-006 / REMEDIATION-2026-P2 / S-X2-02
 *
 * These tests lock the surviving behavior of AppDataContext BEFORE removing
 * vestigial dashboard fields (widgets, services, groups, updateWidgetLayout,
 * loading, refreshData).
 *
 * Behavior Locks:
 *   BL-1  — Type contract: kept fields present, removed fields absent (post-removal)
 *   BL-2  — Provider mount: userSettings + integrations populated from fetch
 *   BL-3  — Event refresh: systemConfigUpdated + integrationsUpdated trigger refetch
 *   BL-4  — SSE invalidation: app-config entity triggers refetch
 *   BL-5  — Visibility refresh: tab restored after 30s+ triggers refetch
 *   BL-6  — flattenUI side effect: solid-ui class applied based on user pref
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

const mockGetUser = vi.fn().mockResolvedValue({
    preferences: {
        ui: { flattenUI: false },
    },
});

vi.mock('@/api/endpoints/config', () => ({
    configApi: {
        getUser: (...args: unknown[]) => mockGetUser(...args),
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

// Global fetch mock for branding endpoint
const mockFetchBranding = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ name: 'TestServer', icon: 'TestIcon' }),
});

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { AppDataProvider, useAppData } from '../AppDataContext';
import type { AppDataContextValue } from '../../types/context/appData';

// ============================================================================
// HELPERS
// ============================================================================

function createWrapper() {
    return function TestWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(AppDataProvider, null, children);
    };
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsInvalidateCallback = null;
    document.documentElement.classList.remove('solid-ui');

    // Mock global fetch for branding
    vi.stubGlobal('fetch', mockFetchBranding);

    // Reset mock implementations to defaults
    mockGetUser.mockResolvedValue({
        preferences: {
            ui: { flattenUI: false },
        },
    });
    mockIntegrationsGetAll.mockResolvedValue([
        { type: 'sonarr', enabled: true, url: 'http://sonarr:8989', apiKey: 'abc' },
        { type: 'radarr', enabled: true, url: 'http://radarr:7878', apiKey: 'def' },
    ]);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ============================================================================
// BL-1: Type contract — kept fields present
// ============================================================================

describe('BL-1: Type contract', () => {
    it('AppDataContextValue includes kept fields', () => {
        // Compile-time type assertions — if any of these fields are removed,
        // TypeScript will fail to compile this test file.
        const assertHasField = <K extends keyof AppDataContextValue>(_key: K): void => {
            // Type-level assertion only — no runtime logic needed
        };

        assertHasField('userSettings');
        assertHasField('integrations');
        assertHasField('integrationsLoaded');
        assertHasField('integrationsError');

        // Runtime assertion for runtime test
        expect(true).toBe(true);
    });

    it('AppDataContextValue does NOT include removed fields', () => {
        // Compile-time negative type assertions.
        // If someone re-adds any of these fields, the type assertion will fail
        // because the Exclude<> trick resolves to `never` when the key exists.
        type AssertNotKey<T, K extends string> =
            K extends keyof T ? ['ERROR: Field should not exist in type', K] : true;

        // Each of these lines produces a type error if the field is re-added
        const _a: AssertNotKey<AppDataContextValue, 'widgets'> = true;
        const _b: AssertNotKey<AppDataContextValue, 'services'> = true;
        const _c: AssertNotKey<AppDataContextValue, 'groups'> = true;
        const _d: AssertNotKey<AppDataContextValue, 'loading'> = true;
        const _e: AssertNotKey<AppDataContextValue, 'updateWidgetLayout'> = true;
        const _f: AssertNotKey<AppDataContextValue, 'refreshData'> = true;

        // Suppress unused warnings
        void _a; void _b; void _c; void _d; void _e; void _f;

        // Runtime assertion confirming no runtime access
        expect(true).toBe(true);
    });
});

// ============================================================================
// BL-2: Provider mount — userSettings + integrations populated
// ============================================================================

describe('BL-2: Provider mount and data population', () => {
    it('populates userSettings with serverName and serverIcon from branding', async () => {
        const { result } = renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.userSettings.serverName).toBe('TestServer');
        });

        expect(result.current.userSettings.serverIcon).toBe('TestIcon');
    });

    it('populates integrations from admin fetch', async () => {
        const { result } = renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });

        expect(result.current.integrations).toHaveProperty('sonarr');
        expect(result.current.integrations).toHaveProperty('radarr');
    });

    it('sets integrationsLoaded to true after fetch', async () => {
        const { result } = renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });
    });

    it('sets integrationsError to null on success', async () => {
        const { result } = renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.integrationsLoaded).toBe(true);
        });

        expect(result.current.integrationsError).toBeNull();
    });
});

// ============================================================================
// BL-3: Event refresh triggers
// ============================================================================

describe('BL-3: Event refresh triggers', () => {
    it('systemConfigUpdated event triggers refetch', async () => {
        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        // Wait for initial load
        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockGetUser.mock.calls.length;

        // Dispatch systemConfigUpdated event
        act(() => {
            window.dispatchEvent(new Event('systemConfigUpdated'));
        });

        await waitFor(() => {
            expect(mockGetUser.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it('integrationsUpdated event triggers refetch', async () => {
        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        // Wait for initial load
        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockGetUser.mock.calls.length;

        // Dispatch integrationsUpdated event
        act(() => {
            window.dispatchEvent(new Event('integrationsUpdated'));
        });

        await waitFor(() => {
            expect(mockGetUser.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});

// ============================================================================
// BL-4: SSE app-config invalidation
// ============================================================================

describe('BL-4: SSE app-config invalidation', () => {
    it('app-config entity triggers refetch via onSettingsInvalidate', async () => {
        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        // Wait for initial load
        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        // onSettingsInvalidate should have been called with a callback
        expect(mockOnSettingsInvalidate).toHaveBeenCalled();

        const initialCallCount = mockGetUser.mock.calls.length;

        // Trigger SSE invalidation
        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'app-config' });
            }
        });

        await waitFor(() => {
            expect(mockGetUser.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it('non-app-config entity does NOT trigger refetch', async () => {
        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        const callCountBefore = mockGetUser.mock.calls.length;

        act(() => {
            if (mockSettingsInvalidateCallback) {
                mockSettingsInvalidateCallback({ entity: 'other-entity' });
            }
        });

        // Small delay to let any potential async work fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockGetUser.mock.calls.length).toBe(callCountBefore);
    });
});

// ============================================================================
// BL-5: Visibility refresh after 30s+
// ============================================================================

describe('BL-5: Visibility refresh', () => {
    it('tab restored after 30s+ hidden triggers refetch', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = mockGetUser.mock.calls.length;

        // Simulate hiding the tab
        Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // Advance time by 35 seconds
        vi.advanceTimersByTime(35000);

        // Simulate showing the tab
        Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => {
            expect(mockGetUser.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        vi.useRealTimers();
    });
});

// ============================================================================
// BL-6: flattenUI side effect
// ============================================================================

describe('BL-6: flattenUI side effect', () => {
    it('applies solid-ui class when flattenUI preference is true', async () => {
        mockGetUser.mockResolvedValue({
            preferences: {
                ui: { flattenUI: true },
            },
        });

        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(document.documentElement.classList.contains('solid-ui')).toBe(true);
        });
    });

    it('removes solid-ui class when flattenUI preference is false', async () => {
        document.documentElement.classList.add('solid-ui');

        mockGetUser.mockResolvedValue({
            preferences: {
                ui: { flattenUI: false },
            },
        });

        renderHook(() => useAppData(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(document.documentElement.classList.contains('solid-ui')).toBe(false);
        });
    });
});
