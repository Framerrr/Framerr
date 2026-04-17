/**
 * useMultiWidgetIntegration — Preview Mode Safety (BL-1b)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: passing widgetId = undefined must prevent
 * persistence (widgetsApi.updateWidgetConfig never called).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../context/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../../../../context/DashboardEditContext', () => ({
    useDashboardEdit: () => ({ editMode: false }),
}));

vi.mock('../../../../utils/permissions', () => ({
    isAdmin: () => true,
}));

vi.mock('../../../../widgets/registry', () => ({
    getWidgetMetadata: () => ({
        compatibleIntegrations: ['sonarr', 'radarr'],
    }),
}));

vi.mock('../../../../api/hooks/useWidgetQueries', () => ({
    useMyWidgetAccess: () => ({
        data: { widgets: 'all' },
        isLoading: false,
    }),
}));

vi.mock('../../../../api/hooks/useIntegrations', () => ({
    useRoleAwareIntegrations: () => ({
        data: [
            { id: 'sonarr-1', type: 'sonarr', displayName: 'Sonarr', enabled: true },
            { id: 'radarr-1', type: 'radarr', displayName: 'Radarr', enabled: true },
        ],
        isLoading: false,
    }),
}));

const mockUpdateWidgetConfig = vi.fn();
vi.mock('../../../../api/endpoints', () => ({
    widgetsApi: {
        updateWidgetConfig: (...args: unknown[]) => mockUpdateWidgetConfig(...args),
    },
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { useMultiWidgetIntegration } from '../useMultiWidgetIntegration';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-1b: Preview mode safety — useMultiWidgetIntegration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does NOT call updateWidgetConfig when widgetId is undefined', () => {
        const configuredIntegrations = {
            sonarr: 'sonarr-1',
            radarr: 'radarr-1',
        };

        // Simulate preview: widgetId = undefined
        renderHook(() =>
            useMultiWidgetIntegration('calendar', configuredIntegrations, undefined)
        );

        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });

    it('returns a valid result with widgetId = undefined', () => {
        const configuredIntegrations = {
            sonarr: 'sonarr-1',
            radarr: 'radarr-1',
        };

        const { result } = renderHook(() =>
            useMultiWidgetIntegration('calendar', configuredIntegrations, undefined)
        );

        expect(result.current.status).toBe('active');
        expect(result.current.loading).toBe(false);
        expect(result.current.integrations.sonarr.effectiveId).toBe('sonarr-1');
        expect(result.current.integrations.radarr.effectiveId).toBe('radarr-1');
    });
});
