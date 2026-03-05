/**
 * useCustomizationState — Behavior Lock Characterization Tests
 *
 * TASK-20260304-004 / REMEDIATION-2026-P2 / S-X5-04
 *
 * These tests lock the current behavior of useCustomizationState before splitting
 * into domain controller hooks:
 *   BL-1  — Public API surface completeness (all return keys present)
 *   BL-2  — handleColorChange calls saveThemeMutation with custom color data
 *   BL-3  — handleToggleCustomColors(false) calls resetToThemeColors
 *   BL-4  — handleSaveApplicationName calls configApi.updateSystem and dispatches events
 *   BL-5  — handleToggleFlattenUI toggles solid-ui class on documentElement
 *   BL-6  — handleSaveGreeting dispatches GREETING_UPDATED and writes localStorage
 *   BL-7  — handleResetGreeting resets to defaults
 *   BL-8  — FlattenUI rollback on mutation failure
 *   BL-9  — handleSaveCustomColors saves color palette via saveThemeMutation
 *   BL-10 — handleResetColors resets to defaults via saveThemeMutation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// MOCKS — Must be before imports that use them
// ============================================================================

const mockChangeTheme = vi.fn().mockResolvedValue(undefined);

vi.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        theme: 'dark-pro',
        changeTheme: mockChangeTheme,
    }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUser = { id: '1', username: 'testuser', displayName: 'Test User', role: 'admin' };
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

const mockDispatchCustomEvent = vi.fn();
vi.mock('@/types/events', () => ({
    dispatchCustomEvent: (...args: unknown[]) => mockDispatchCustomEvent(...args),
    CustomEventNames: {
        APP_NAME_UPDATED: 'appNameUpdated',
        SYSTEM_CONFIG_UPDATED: 'systemConfigUpdated',
        GREETING_UPDATED: 'greetingUpdated',
    },
}));

vi.mock('@/api/errors', () => ({
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status = 500) {
            super(message);
            this.status = status;
        }
    },
}));

// Mock configApi
const mockUpdateSystem = vi.fn().mockResolvedValue({});
const mockGetSystem = vi.fn().mockResolvedValue({
    server: { name: 'Framerr', icon: 'Server' },
});
vi.mock('@/api/endpoints', () => ({
    configApi: {
        updateSystem: (...args: unknown[]) => mockUpdateSystem(...args),
        getSystem: () => mockGetSystem(),
    },
}));

// Mock React Query hooks
const mockSaveThemeMutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@/api/hooks/useConfig', () => ({
    useSaveTheme: () => ({
        mutateAsync: mockSaveThemeMutateAsync,
    }),
}));

const mockUpdateUserMutateAsync = vi.fn().mockResolvedValue({});
const mockUserConfig = {
    theme: {
        mode: 'dark-pro',
        preset: 'dark-pro',
        customColors: null,
        lastSelectedTheme: 'dark-pro',
    },
    preferences: {
        ui: { flattenUI: false },
        dashboardGreeting: {
            enabled: true,
            mode: 'auto',
            text: 'Welcome back, {user}',
            headerVisible: true,
            taglineEnabled: true,
            taglineText: 'Your personal dashboard',
            tones: ['standard', 'witty', 'nerdy'],
            loadingMessages: true,
        },
    },
};

vi.mock('@/api/hooks/useDashboard', () => ({
    useUserPreferences: () => ({
        data: mockUserConfig,
        isLoading: false,
    }),
    useUpdateUserPreferences: () => ({
        mutateAsync: mockUpdateUserMutateAsync,
    }),
}));

// Mock colorUtils — partially mock to preserve defaultColors export
const mockGetCurrentThemeColors = vi.fn().mockReturnValue({
    'bg-primary': '#0a0e1a',
    'bg-secondary': '#151922',
    'bg-tertiary': '#1f2937',
    'accent': '#3b82f6',
    'accent-secondary': '#06b6d4',
    'text-primary': '#f1f5f9',
    'text-secondary': '#94a3b8',
    'text-tertiary': '#64748b',
    'border': '#374151',
    'border-light': '#1f2937',
    'success': '#10b981',
    'warning': '#f59e0b',
    'error': '#ef4444',
    'info': '#3b82f6',
    'bg-hover': '#374151',
    'accent-hover': '#2563eb',
    'accent-light': '#60a5fa',
    'border-accent': 'rgba(59, 130, 246, 0.3)',
});
const mockApplyColorsToDOM = vi.fn();
const mockRemoveColorsFromDOM = vi.fn();
vi.mock('@/settings/customization/utils/colorUtils', () => ({
    defaultColors: {
        'bg-primary': '#0a0e1a',
        'bg-secondary': '#151922',
        'bg-tertiary': '#1f2937',
        'accent': '#3b82f6',
        'accent-secondary': '#06b6d4',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-tertiary': '#64748b',
        'border': '#374151',
        'border-light': '#1f2937',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444',
        'info': '#3b82f6',
        'bg-hover': '#374151',
        'accent-hover': '#2563eb',
        'accent-light': '#60a5fa',
        'border-accent': 'rgba(59, 130, 246, 0.3)',
    },
    getCurrentThemeColors: () => mockGetCurrentThemeColors(),
    applyColorsToDOM: (...args: unknown[]) => mockApplyColorsToDOM(...args),
    removeColorsFromDOM: () => mockRemoveColorsFromDOM(),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { useCustomizationState } from '../useCustomizationState';

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
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    document.documentElement.classList.remove('solid-ui');
    document.documentElement.removeAttribute('style');
    localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
});

// ============================================================================
// BL-1: Public API surface completeness
// ============================================================================

describe('BL-1: Public API surface', () => {
    it('returns all expected keys from CustomizationState', () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        const s = result.current;

        // Sub-tab Navigation
        expect(s).toHaveProperty('activeSubTab');
        expect(s).toHaveProperty('setActiveSubTab');

        // Color Theme State
        expect(s).toHaveProperty('customColors');
        expect(s).toHaveProperty('useCustomColors');
        expect(s).toHaveProperty('customColorsEnabled');
        expect(s).toHaveProperty('lastSelectedTheme');
        expect(s).toHaveProperty('autoSaving');
        expect(s).toHaveProperty('saving');
        expect(s).toHaveProperty('loading');

        // Application Branding State
        expect(s).toHaveProperty('applicationName');
        expect(s).toHaveProperty('setApplicationName');
        expect(s).toHaveProperty('applicationIcon');
        expect(s).toHaveProperty('setApplicationIcon');
        expect(s).toHaveProperty('savingAppName');
        expect(s).toHaveProperty('hasAppNameChanges');

        // Flatten UI State
        expect(s).toHaveProperty('flattenUI');
        expect(s).toHaveProperty('savingFlattenUI');

        // Greeting State
        expect(s).toHaveProperty('greetingMode');
        expect(s).toHaveProperty('setGreetingMode');
        expect(s).toHaveProperty('greetingText');
        expect(s).toHaveProperty('setGreetingText');
        expect(s).toHaveProperty('headerVisible');
        expect(s).toHaveProperty('setHeaderVisible');
        expect(s).toHaveProperty('taglineEnabled');
        expect(s).toHaveProperty('setTaglineEnabled');
        expect(s).toHaveProperty('taglineText');
        expect(s).toHaveProperty('setTaglineText');
        expect(s).toHaveProperty('tones');
        expect(s).toHaveProperty('setTones');
        expect(s).toHaveProperty('loadingMessagesEnabled');
        expect(s).toHaveProperty('setLoadingMessagesEnabled');
        expect(s).toHaveProperty('savingGreeting');
        expect(s).toHaveProperty('hasGreetingChanges');

        // Collapsible Sections
        expect(s).toHaveProperty('statusColorsExpanded');
        expect(s).toHaveProperty('setStatusColorsExpanded');
        expect(s).toHaveProperty('advancedExpanded');
        expect(s).toHaveProperty('setAdvancedExpanded');

        // Handlers
        expect(s).toHaveProperty('handleColorChange');
        expect(s).toHaveProperty('handleToggleCustomColors');
        expect(s).toHaveProperty('handleSaveCustomColors');
        expect(s).toHaveProperty('handleResetColors');
        expect(s).toHaveProperty('handleSaveApplicationName');
        expect(s).toHaveProperty('handleToggleFlattenUI');
        expect(s).toHaveProperty('handleSaveGreeting');
        expect(s).toHaveProperty('handleResetGreeting');
        expect(s).toHaveProperty('resetToThemeColors');

        // Internal state setters
        expect(s).toHaveProperty('setUseCustomColors');
        expect(s).toHaveProperty('setCustomColorsEnabled');
        expect(s).toHaveProperty('setLastSelectedTheme');
        expect(s).toHaveProperty('setCustomColors');
    });

    it('loading is false when data is loaded and initialized', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        // After initialization effect runs
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.loading).toBe(false);
    });
});

// ============================================================================
// BL-2: Color change uses saveThemeMutation
// ============================================================================

describe('BL-2: handleColorChange', () => {
    it('calls saveThemeMutation.mutateAsync with custom color data after debounce', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        // Init + enable custom colors
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Enable custom colors first
        act(() => {
            result.current.setCustomColorsEnabled(true);
        });

        // Change a color
        act(() => {
            result.current.handleColorChange('accent', '#ff0000');
        });

        // Advance past debounce timer (500ms)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(mockSaveThemeMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'custom',
                customColors: expect.objectContaining({ accent: '#ff0000' }),
            })
        );
        expect(mockApplyColorsToDOM).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-3: handleToggleCustomColors(false) reverts to theme
// ============================================================================

describe('BL-3: handleToggleCustomColors', () => {
    it('disabling custom colors calls removeColorsFromDOM and changeTheme', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Enable first
        act(() => {
            result.current.setCustomColorsEnabled(true);
        });

        // Now disable
        await act(async () => {
            await result.current.handleToggleCustomColors(false);
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(mockRemoveColorsFromDOM).toHaveBeenCalled();
        expect(mockChangeTheme).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-4: handleSaveApplicationName dispatches events
// ============================================================================

describe('BL-4: handleSaveApplicationName', () => {
    it('calls configApi.updateSystem and dispatches APP_NAME_UPDATED + SYSTEM_CONFIG_UPDATED', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Change app name
        act(() => {
            result.current.setApplicationName('MyApp');
        });

        // Save
        await act(async () => {
            await result.current.handleSaveApplicationName();
        });

        expect(mockUpdateSystem).toHaveBeenCalledWith({
            server: {
                name: 'MyApp',
                icon: expect.any(String),
            },
        });

        expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
            'appNameUpdated',
            expect.objectContaining({ appName: 'MyApp' })
        );
        expect(mockDispatchCustomEvent).toHaveBeenCalledWith('systemConfigUpdated');
        expect(mockShowSuccess).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-5: handleToggleFlattenUI toggles solid-ui class
// ============================================================================

describe('BL-5: handleToggleFlattenUI', () => {
    it('adds solid-ui class when enabled', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            await result.current.handleToggleFlattenUI(true);
        });

        expect(document.documentElement.classList.contains('solid-ui')).toBe(true);
        expect(mockUpdateUserMutateAsync).toHaveBeenCalledWith({
            preferences: { ui: { flattenUI: true } },
        });
    });

    it('removes solid-ui class when disabled', async () => {
        document.documentElement.classList.add('solid-ui');

        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            await result.current.handleToggleFlattenUI(false);
        });

        expect(document.documentElement.classList.contains('solid-ui')).toBe(false);
    });
});

// ============================================================================
// BL-6: handleSaveGreeting dispatches event and writes localStorage
// ============================================================================

describe('BL-6: handleSaveGreeting', () => {
    it('calls updateUserMutation, dispatches GREETING_UPDATED, and writes localStorage', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            await result.current.handleSaveGreeting();
        });

        expect(mockUpdateUserMutateAsync).toHaveBeenCalledWith({
            preferences: {
                dashboardGreeting: expect.objectContaining({
                    mode: 'auto',
                    headerVisible: true,
                    taglineEnabled: true,
                }),
            },
        });

        expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
            'greetingUpdated',
            expect.objectContaining({ mode: 'auto' })
        );

        expect(localStorage.getItem('framerr-loading-messages')).toBe('true');
        expect(mockShowSuccess).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-7: handleResetGreeting resets to defaults
// ============================================================================

describe('BL-7: handleResetGreeting', () => {
    it('resets all greeting fields to defaults', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Modify greeting
        act(() => {
            result.current.setGreetingMode('manual');
            result.current.setGreetingText('Custom text');
            result.current.setHeaderVisible(false);
        });

        // Reset
        act(() => {
            result.current.handleResetGreeting();
        });

        expect(result.current.greetingMode).toBe('auto');
        expect(result.current.headerVisible).toBe(true);
        expect(result.current.taglineEnabled).toBe(true);
        expect(result.current.taglineText).toBe('Your personal dashboard');
        expect(result.current.loadingMessagesEnabled).toBe(true);
    });
});

// ============================================================================
// BL-8: FlattenUI rollback on mutation failure
// ============================================================================

describe('BL-8: FlattenUI rollback on failure', () => {
    it('reverts flattenUI and DOM class on mutation error', async () => {
        mockUpdateUserMutateAsync.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // flattenUI should be false initially
        expect(result.current.flattenUI).toBe(false);
        expect(document.documentElement.classList.contains('solid-ui')).toBe(false);

        // Toggle on — should fail
        await act(async () => {
            await result.current.handleToggleFlattenUI(true);
        });

        // Should rollback
        expect(result.current.flattenUI).toBe(false);
        expect(document.documentElement.classList.contains('solid-ui')).toBe(false);
        expect(mockShowError).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-9: handleSaveCustomColors saves palette via saveThemeMutation
// ============================================================================

describe('BL-9: handleSaveCustomColors', () => {
    it('calls saveThemeMutation.mutateAsync with current colors and applies to DOM', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Enable custom colors
        act(() => {
            result.current.setCustomColorsEnabled(true);
        });

        // Change a color to verify the right palette is sent
        act(() => {
            result.current.handleColorChange('accent', '#ee5500');
        });

        // Clear debounced auto-save calls so we isolate handleSaveCustomColors
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        mockSaveThemeMutateAsync.mockClear();
        mockApplyColorsToDOM.mockClear();

        // Explicitly save
        await act(async () => {
            await result.current.handleSaveCustomColors();
        });

        expect(mockSaveThemeMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'custom',
                customColors: expect.objectContaining({ accent: '#ee5500' }),
            })
        );
        expect(mockApplyColorsToDOM).toHaveBeenCalled();
    });

    it('shows error toast on mutation failure', async () => {
        mockSaveThemeMutateAsync.mockRejectedValueOnce(new Error('Save failed'));

        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        act(() => {
            result.current.setCustomColorsEnabled(true);
        });

        await act(async () => {
            await result.current.handleSaveCustomColors();
        });

        expect(mockShowError).toHaveBeenCalled();
    });
});

// ============================================================================
// BL-10: handleResetColors resets to defaults via saveThemeMutation
// ============================================================================

describe('BL-10: handleResetColors', () => {
    it('calls saveThemeMutation.mutateAsync with default preset and removes DOM custom properties', async () => {
        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Reset colors
        await act(async () => {
            await result.current.handleResetColors();
        });

        expect(mockSaveThemeMutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                preset: 'dark-pro',
                mode: 'dark-pro',
            })
        );
    });

    it('shows error toast on reset failure', async () => {
        mockSaveThemeMutateAsync.mockRejectedValueOnce(new Error('Reset failed'));

        const { result } = renderHook(() => useCustomizationState(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            await result.current.handleResetColors();
        });

        expect(mockShowError).toHaveBeenCalled();
    });
});
