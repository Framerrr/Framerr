/**
 * useIntegrationSettings — Behavior Lock Characterization Tests
 *
 * TASK-20260302-017 / REMEDIATION-2026 / S-H4-04
 *
 * These tests lock the current behavior of useIntegrationSettings before splitting
 * into sub-hooks (useConnectionTesting, usePlexIntegration, useFormRefs):
 *   BL-1  — Public API surface completeness (all return keys present)
 *   BL-2  — handleToggle flips enabled state
 *   BL-3  — handleFieldChange updates specific field
 *   BL-4  — handleAddIntegration creates ephemeral instance with new- prefix
 *   BL-5  — handleTest updates testStates
 *   BL-6  — INTEGRATIONS_UPDATED event dispatched on save
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// MOCKS — Must be before imports that use them
// ============================================================================

// Mock NotificationContext — use @/ alias to target the INTERNAL module directly
// The re-export wrapper at context/NotificationContext.tsx causes vi.mock path resolution
// issues, so we target the real implementation via the Vite alias.
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('@/context/notification/NotificationContext', () => ({
    useNotifications: () => ({
        success: mockShowSuccess,
        error: mockShowError,
        warning: vi.fn(),
        info: vi.fn(),
        showToast: vi.fn(),
        dismissToast: vi.fn(),
        toasts: [],
        notifications: [],
        unreadCount: 0,
        loading: false,
        fetchNotifications: vi.fn(),
        addNotification: vi.fn(),
        markAsRead: vi.fn(),
        deleteNotification: vi.fn(),
        markAllAsRead: vi.fn(),
        clearAll: vi.fn(),
        handleRequestAction: vi.fn(),
        notificationCenterOpen: false,
        setNotificationCenterOpen: vi.fn(),
        openNotificationCenter: vi.fn(),
        connected: false,
        pushSupported: false,
        pushPermission: 'default',
        pushEnabled: false,
        pushSubscriptions: [],
        currentEndpoint: null,
        globalPushEnabled: false,
        requestPushPermission: vi.fn(),
        subscribeToPush: vi.fn(),
        unsubscribeFromPush: vi.fn(),
        removePushSubscription: vi.fn(),
        testPushNotification: vi.fn(),
        fetchPushSubscriptions: vi.fn(),
        fetchGlobalPushStatus: vi.fn(),
    }),
    NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
    useToasts: () => ({ showToast: vi.fn(), toasts: [], dismissToast: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
    useNotificationCenter: () => ({ notifications: [], unreadCount: 0, loading: false, fetchNotifications: vi.fn(), addNotification: vi.fn(), markAsRead: vi.fn(), deleteNotification: vi.fn(), markAllAsRead: vi.fn(), clearAll: vi.fn(), handleRequestAction: vi.fn(), notificationCenterOpen: false, setNotificationCenterOpen: vi.fn(), openNotificationCenter: vi.fn(), connected: false }),
    usePush: () => ({ pushSupported: false, pushPermission: 'default', pushEnabled: false, pushSubscriptions: [], currentEndpoint: null, globalPushEnabled: false, requestPushPermission: vi.fn(), subscribeToPush: vi.fn(), unsubscribeFromPush: vi.fn(), removePushSubscription: vi.fn(), testPushNotification: vi.fn(), fetchPushSubscriptions: vi.fn(), fetchGlobalPushStatus: vi.fn() }),
}));

// Mock usePlexOAuth
vi.mock('../../../hooks/usePlexOAuth', () => ({
    usePlexOAuth: () => ({
        startAuth: vi.fn(),
        isAuthenticating: false,
    }),
    // Re-export PlexUser type (not needed at runtime, but keeps imports happy)
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock events
const mockDispatchCustomEvent = vi.fn();
vi.mock('@/types/events', () => ({
    dispatchCustomEvent: (...args: unknown[]) => mockDispatchCustomEvent(...args),
    CustomEventNames: {
        INTEGRATIONS_UPDATED: 'integrationsUpdated',
        LINKED_ACCOUNTS_UPDATED: 'linkedAccountsUpdated',
        WIDGETS_REFRESH: 'widgetsRefresh',
    },
}));

// Mock API
const mockTestByConfig = vi.fn();
vi.mock('@/api', () => ({
    integrationsApi: {
        testByConfig: (...args: unknown[]) => mockTestByConfig(...args),
    },
    plexApi: {
        getResources: vi.fn().mockResolvedValue([]),
    },
}));

// Mock React Query hooks for integrations
const mockMutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@/api/hooks/useIntegrations', () => ({
    useIntegrations: () => ({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
    }),
    useCreateIntegration: () => ({
        mutateAsync: mockMutateAsync,
    }),
    useUpdateIntegration: () => ({
        mutateAsync: mockMutateAsync,
    }),
    useDeleteIntegration: () => ({
        mutateAsync: mockMutateAsync,
    }),
}));

// Mock ApiError
vi.mock('../../../api/errors', () => ({
    ApiError: class ApiError extends Error {
        message: string;
        constructor(message: string) {
            super(message);
            this.message = message;
        }
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { useIntegrationSettings } from '../useIntegrationSettings';

// ============================================================================
// HELPERS
// ============================================================================

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false },
        },
    });

    return function TestWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
    };
}

// ============================================================================
// BL-1: Public API surface completeness
// ============================================================================

describe('BL-1: Public API surface', () => {
    it('returns all expected keys from UseIntegrationSettingsReturn', () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        const returnValue = result.current;

        // State
        expect(returnValue).toHaveProperty('integrations');
        expect(returnValue).toHaveProperty('savedIntegrations');
        expect(returnValue).toHaveProperty('instances');
        expect(returnValue).toHaveProperty('savedInstances');
        expect(returnValue).toHaveProperty('loading');
        expect(returnValue).toHaveProperty('saving');
        expect(returnValue).toHaveProperty('testStates');

        // Modal state
        expect(returnValue).toHaveProperty('activeModal');
        expect(returnValue).toHaveProperty('setActiveModal');
        expect(returnValue).toHaveProperty('newInstanceId');

        // Form refs
        expect(returnValue).toHaveProperty('monitorFormRef');
        expect(returnValue).toHaveProperty('uptimeKumaFormRef');

        // Plex state
        expect(returnValue).toHaveProperty('plexAuthenticating');
        expect(returnValue).toHaveProperty('plexLoadingServers');

        // Handlers
        expect(returnValue).toHaveProperty('handleFieldChange');
        expect(returnValue).toHaveProperty('handleToggle');
        expect(returnValue).toHaveProperty('handleSave');
        expect(returnValue).toHaveProperty('handleTest');
        expect(returnValue).toHaveProperty('handleReset');
        expect(returnValue).toHaveProperty('fetchIntegrations');

        // Instance handlers
        expect(returnValue).toHaveProperty('handleAddIntegration');
        expect(returnValue).toHaveProperty('handleDeleteInstance');
        expect(returnValue).toHaveProperty('handleToggleInstance');

        // Plex handlers
        expect(returnValue).toHaveProperty('handlePlexLogin');
        expect(returnValue).toHaveProperty('handlePlexServerChange');
        expect(returnValue).toHaveProperty('fetchPlexServers');

        // Monitor handlers
        expect(returnValue).toHaveProperty('handleMonitorFormReady');
        expect(returnValue).toHaveProperty('handleMonitorSave');
        expect(returnValue).toHaveProperty('handleMonitorCancel');
        expect(returnValue).toHaveProperty('monitorDirty');
        expect(returnValue).toHaveProperty('handleMonitorDirtyChange');

        // UptimeKuma handlers
        expect(returnValue).toHaveProperty('handleUptimeKumaFormReady');
        expect(returnValue).toHaveProperty('handleUptimeKumaSave');
        expect(returnValue).toHaveProperty('handleUptimeKumaCancel');
    });

    it('loading is false when not loading and initialized', () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        // With mock returning isLoading: false, loading should be false
        expect(result.current.loading).toBe(false);
    });
});

// ============================================================================
// BL-2: handleToggle flips enabled state
// ============================================================================

describe('BL-2: handleToggle', () => {
    it('toggles enabled state for a given service key', () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        // First add an integration to have something to toggle
        act(() => {
            result.current.handleAddIntegration('sonarr', 'Sonarr');
        });

        const instanceId = result.current.newInstanceId!;
        expect(instanceId).toBeTruthy();

        // The new integration starts enabled
        expect(result.current.integrations[instanceId]?.enabled).toBe(true);

        // Toggle it
        act(() => {
            result.current.handleToggle(instanceId);
        });

        expect(result.current.integrations[instanceId]?.enabled).toBe(false);

        // Toggle back
        act(() => {
            result.current.handleToggle(instanceId);
        });

        expect(result.current.integrations[instanceId]?.enabled).toBe(true);
    });
});

// ============================================================================
// BL-3: handleFieldChange updates specific field
// ============================================================================

describe('BL-3: handleFieldChange', () => {
    it('updates a specific field value on a service config', () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        // Add an integration
        act(() => {
            result.current.handleAddIntegration('radarr', 'Radarr');
        });

        const instanceId = result.current.newInstanceId!;

        // Update url field
        act(() => {
            result.current.handleFieldChange(instanceId, 'url', 'http://localhost:7878');
        });

        expect(result.current.integrations[instanceId]?.url).toBe('http://localhost:7878');

        // Update apiKey field
        act(() => {
            result.current.handleFieldChange(instanceId, 'apiKey', 'test-api-key-123');
        });

        expect(result.current.integrations[instanceId]?.apiKey).toBe('test-api-key-123');
    });
});

// ============================================================================
// BL-4: handleAddIntegration creates ephemeral instance
// ============================================================================

describe('BL-4: handleAddIntegration', () => {
    it('creates an ephemeral instance with new- prefix ID', () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        act(() => {
            result.current.handleAddIntegration('plex', 'Plex');
        });

        // newInstanceId should be set
        const instanceId = result.current.newInstanceId;
        expect(instanceId).toBeTruthy();
        expect(instanceId).toMatch(/^new-plex-/);

        // Should be in instances list
        const instance = result.current.instances.find(i => i.id === instanceId);
        expect(instance).toBeDefined();
        expect(instance?.type).toBe('plex');
        expect(instance?.displayName).toBe('Plex');
        expect(instance?.enabled).toBe(true);

        // Should be in integrations state
        const config = result.current.integrations[instanceId!];
        expect(config).toBeDefined();
        expect(config?.enabled).toBe(true);
        expect(config?._type).toBe('plex');

        // activeModal should be set to the new instance
        expect(result.current.activeModal).toBe(instanceId);
    });
});

// ============================================================================
// BL-5: handleTest updates testStates
// ============================================================================

describe('BL-5: handleTest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates testStates on successful connection test', async () => {
        mockTestByConfig.mockResolvedValueOnce({
            success: true,
            message: 'Connection successful',
        });

        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        // Add an integration first
        act(() => {
            result.current.handleAddIntegration('sonarr', 'Sonarr');
        });

        const instanceId = result.current.newInstanceId!;

        // Set a URL so config has _type
        act(() => {
            result.current.handleFieldChange(instanceId, 'url', 'http://localhost:8989');
        });

        // Run connection test
        await act(async () => {
            await result.current.handleTest(instanceId);
        });

        // testStates should show success
        const testState = result.current.testStates[instanceId];
        expect(testState).toBeDefined();
        expect(testState?.loading).toBe(false);
        expect(testState?.success).toBe(true);
        expect(testState?.message).toContain('✓');
    });

    it('updates testStates on failed connection test', async () => {
        mockTestByConfig.mockResolvedValueOnce({
            success: false,
            error: 'Connection refused',
        });

        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        act(() => {
            result.current.handleAddIntegration('sonarr', 'Sonarr');
        });

        const instanceId = result.current.newInstanceId!;

        await act(async () => {
            await result.current.handleTest(instanceId);
        });

        const testState = result.current.testStates[instanceId];
        expect(testState).toBeDefined();
        expect(testState?.loading).toBe(false);
        expect(testState?.success).toBe(false);
        expect(testState?.message).toContain('✗');
    });
});

// ============================================================================
// BL-6: INTEGRATIONS_UPDATED event dispatched on save
// ============================================================================

describe('BL-6: Event dispatch on save', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dispatches INTEGRATIONS_UPDATED event after successful save', async () => {
        const { result } = renderHook(() => useIntegrationSettings(), {
            wrapper: createWrapper(),
        });

        // Add an integration
        act(() => {
            result.current.handleAddIntegration('sonarr', 'Sonarr');
        });

        const instanceId = result.current.newInstanceId!;

        // Save
        await act(async () => {
            await result.current.handleSave(instanceId);
        });

        // Should dispatch INTEGRATIONS_UPDATED
        expect(mockDispatchCustomEvent).toHaveBeenCalledWith('integrationsUpdated');
    });
});
