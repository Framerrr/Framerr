/**
 * useWidgetIntegration — Access State Branches (BL-2)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test for the 5 status branches: loading, noAccess,
 * disabled, notConfigured, active. Verifies status values remain correct
 * after early-return relocation.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — reconfigurable per test
// ---------------------------------------------------------------------------

let mockIsAdmin = true;
let mockAccessData: { widgets: string | string[] } | undefined = { widgets: 'all' };
let mockAccessLoading = false;
let mockFallbackResult = {
    integrationId: 'plex-123',
    isFallback: false,
    reason: 'configured' as string,
    fallbackInstance: undefined as { id: string; name: string } | undefined,
    compatibleInstances: [{ id: 'plex-123', displayName: 'My Plex', type: 'plex' }],
    loading: false,
};

vi.mock('../../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../../../../utils/permissions', () => ({
    isAdmin: () => mockIsAdmin,
}));

vi.mock('../../../../widgets/registry', () => ({
    getWidgetMetadata: () => ({
        compatibleIntegrations: ['plex'],
    }),
}));

vi.mock('../../../../api/hooks/useWidgetQueries', () => ({
    useMyWidgetAccess: () => ({
        data: mockAccessData,
        isLoading: mockAccessLoading,
    }),
}));

vi.mock('../../../../api/endpoints', () => ({
    widgetsApi: { updateWidgetConfig: vi.fn() },
}));

vi.mock('../useIntegrationFallback', () => ({
    useIntegrationFallback: () => mockFallbackResult,
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { useWidgetIntegration } from '../useWidgetIntegration';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-2: Widget integration access-state rendering', () => {
    it('returns status=loading when access data is still loading', () => {
        mockAccessLoading = true;
        mockFallbackResult = { ...mockFallbackResult, loading: false };

        const { result } = renderHook(() => useWidgetIntegration('plex', 'plex-123'));
        expect(result.current.status).toBe('loading');
        expect(result.current.loading).toBe(true);

        // Reset
        mockAccessLoading = false;
    });

    it('returns status=noAccess when widget is not shared to non-admin user', () => {
        mockIsAdmin = false;
        mockAccessData = { widgets: ['calendar'] }; // plex not included

        const { result } = renderHook(() => useWidgetIntegration('plex', 'plex-123'));
        expect(result.current.status).toBe('noAccess');
        expect(result.current.effectiveIntegrationId).toBeNull();

        // Reset
        mockIsAdmin = true;
        mockAccessData = { widgets: 'all' };
    });

    it('returns status=disabled when widget shared but no integrations available', () => {
        mockFallbackResult = {
            integrationId: null as unknown as string,
            isFallback: false,
            reason: 'no_access',
            fallbackInstance: undefined,
            compatibleInstances: [],
            loading: false,
        };

        const { result } = renderHook(() => useWidgetIntegration('plex', 'plex-123'));
        expect(result.current.status).toBe('disabled');

        // Reset
        mockFallbackResult = {
            integrationId: 'plex-123',
            isFallback: false,
            reason: 'configured',
            fallbackInstance: undefined,
            compatibleInstances: [{ id: 'plex-123', displayName: 'My Plex', type: 'plex' }],
            loading: false,
        };
    });

    it('returns status=notConfigured when no integration selected', () => {
        mockFallbackResult = {
            integrationId: null as unknown as string,
            isFallback: false,
            reason: 'not_configured',
            fallbackInstance: undefined,
            compatibleInstances: [{ id: 'plex-123', displayName: 'My Plex', type: 'plex' }],
            loading: false,
        };

        const { result } = renderHook(() => useWidgetIntegration('plex'));
        expect(result.current.status).toBe('notConfigured');

        // Reset
        mockFallbackResult = {
            integrationId: 'plex-123',
            isFallback: false,
            reason: 'configured',
            fallbackInstance: undefined,
            compatibleInstances: [{ id: 'plex-123', displayName: 'My Plex', type: 'plex' }],
            loading: false,
        };
    });

    it('returns status=active when integration is accessible', () => {
        const { result } = renderHook(() => useWidgetIntegration('plex', 'plex-123'));
        expect(result.current.status).toBe('active');
        expect(result.current.effectiveIntegrationId).toBe('plex-123');
        expect(result.current.loading).toBe(false);
    });
});
