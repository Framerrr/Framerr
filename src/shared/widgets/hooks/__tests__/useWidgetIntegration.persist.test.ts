/**
 * useWidgetIntegration — persist guards (TASK-20260725-002)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockEditMode = false;
let mockFallbackResult: {
    integrationId: string | null;
    isOriginal: boolean;
    isFallback: boolean;
    reason: string;
    fallbackInstance?: { id: string; name: string };
    compatibleInstances: { id: string; displayName: string; type: string }[];
    loading: boolean;
} = {
    integrationId: 'plex-fallback',
    isOriginal: false,
    isFallback: true,
    reason: 'accessible' as string,
    fallbackInstance: { id: 'plex-fallback', name: 'Fallback Plex' },
    compatibleInstances: [{ id: 'plex-fallback', displayName: 'Fallback Plex', type: 'plex' }],
    loading: false,
};

vi.mock('../../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../../../../context/useDashboardEdit', () => ({
    useDashboardEdit: () => ({ editMode: mockEditMode }),
}));

vi.mock('../../../../utils/permissions', () => ({
    isAdmin: () => true,
}));

vi.mock('../../../../widgets/registry', () => ({
    getWidgetMetadata: () => ({
        compatibleIntegrations: ['plex'],
    }),
}));

vi.mock('../../../../api/hooks/useWidgetQueries', () => ({
    useMyWidgetAccess: () => ({
        data: { widgets: 'all' },
        isLoading: false,
    }),
}));

vi.mock('../../../../context/ActiveDashboardContext', () => ({
    useOptionalActiveDashboard: () => ({ activeDashboardId: 'dash-1' }),
}));

const mockUpdateWidgetConfig = vi.fn().mockResolvedValue({});
vi.mock('../../../../api/endpoints', () => ({
    widgetsApi: {
        updateWidgetConfig: (...args: unknown[]) => mockUpdateWidgetConfig(...args),
    },
}));

vi.mock('../useIntegrationFallback', () => ({
    useIntegrationFallback: () => mockFallbackResult,
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { useWidgetIntegration } from '../useWidgetIntegration';

describe('useWidgetIntegration persist guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockEditMode = false;
        mockFallbackResult = {
            integrationId: 'plex-fallback',
            isOriginal: false,
            isFallback: true,
            reason: 'accessible',
            fallbackInstance: { id: 'plex-fallback', name: 'Fallback Plex' },
            compatibleInstances: [{ id: 'plex-fallback', displayName: 'Fallback Plex', type: 'plex' }],
            loading: false,
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not PATCH when editMode is true', async () => {
        mockEditMode = true;
        renderHook(() => useWidgetIntegration('plex', 'plex-123', 'widget-real'));
        await vi.advanceTimersByTimeAsync(600);
        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });

    it('does not PATCH for tentative widget ids', async () => {
        renderHook(() => useWidgetIntegration('plex', 'plex-123', '__tentative__'));
        await vi.advanceTimersByTimeAsync(600);
        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });

    it('does not PATCH for drag-preview widget ids', async () => {
        renderHook(() => useWidgetIntegration('plex', 'plex-123', 'drag-preview-abc'));
        await vi.advanceTimersByTimeAsync(600);
        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });

    it('PATCHes fallback after delay when not in edit mode', async () => {
        renderHook(() => useWidgetIntegration('plex', 'plex-123', 'widget-real'));
        await vi.advanceTimersByTimeAsync(600);
        expect(mockUpdateWidgetConfig).toHaveBeenCalledWith('dash-1', 'widget-real', {
            integrationId: 'plex-fallback',
        });
    });

    it('explicit clear (null configured id) yields notConfigured and no PATCH', async () => {
        mockFallbackResult = {
            integrationId: null,
            isOriginal: false,
            isFallback: false,
            reason: 'not_configured',
            compatibleInstances: [{ id: 'plex-fallback', displayName: 'Fallback Plex', type: 'plex' }],
            loading: false,
        };

        const { result } = renderHook(() => useWidgetIntegration('plex', null, 'widget-real'));
        expect(result.current.status).toBe('notConfigured');
        await vi.advanceTimersByTimeAsync(600);
        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();
    });
});
