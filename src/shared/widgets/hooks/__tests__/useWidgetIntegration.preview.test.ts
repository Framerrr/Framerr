/**
 * useWidgetIntegration — Preview Mode Safety (BL-1a)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: passing widgetId = undefined must prevent
 * persistence (widgetsApi.updateWidgetConfig never called).
 * Passing integrationId = undefined to useIntegrationSSE must not
 * open an SSE subscription.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock AuthContext
vi.mock('../../../../context/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));

// Mock permissions
vi.mock('../../../../utils/permissions', () => ({
    isAdmin: () => true,
}));

// Mock widget registry
vi.mock('../../../../widgets/registry', () => ({
    getWidgetMetadata: () => ({
        compatibleIntegrations: ['plex'],
    }),
}));

// Mock widget access query
vi.mock('../../../../api/hooks/useWidgetQueries', () => ({
    useMyWidgetAccess: () => ({
        data: { widgets: 'all' },
        isLoading: false,
    }),
}));

// Track widgetsApi calls
const mockUpdateWidgetConfig = vi.fn();
vi.mock('../../../../api/endpoints', () => ({
    widgetsApi: {
        updateWidgetConfig: (...args: unknown[]) => mockUpdateWidgetConfig(...args),
    },
}));

// Mock useIntegrationFallback — return a stable, no-fallback result
vi.mock('../useIntegrationFallback', () => ({
    useIntegrationFallback: () => ({
        integrationId: 'plex-123',
        isFallback: false,
        reason: 'configured',
        fallbackInstance: undefined,
        compatibleInstances: [{ id: 'plex-123', displayName: 'My Plex', type: 'plex' }],
        loading: false,
    }),
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { useWidgetIntegration } from '../useWidgetIntegration';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-1a: Preview mode safety — useWidgetIntegration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    it('does NOT call updateWidgetConfig when widgetId is undefined', async () => {
        // Simulate preview: widgetId = undefined
        renderHook(() => useWidgetIntegration('plex', 'plex-123', undefined));

        // Advance timers past the 500ms persistence delay
        await vi.advanceTimersByTimeAsync(1000);

        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });

    it('returns a valid result even with widgetId = undefined', () => {
        const { result } = renderHook(() =>
            useWidgetIntegration('plex', 'plex-123', undefined)
        );

        // Should still resolve the integration
        expect(result.current.status).toBe('active');
        expect(result.current.effectiveIntegrationId).toBe('plex-123');
        expect(result.current.loading).toBe(false);
    });
});
