/**
 * useIntegrationFallback — effective bind + explicit clear (TASK-20260725-002)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockInstances = [
    { id: 'tautulli-1', type: 'tautulli', displayName: 'Home Tautulli', enabled: true },
    { id: 'qbittorrent-main', type: 'qbittorrent', displayName: 'qBit', enabled: true },
];

vi.mock('../../../../api/hooks/useIntegrations', () => ({
    useRoleAwareIntegrations: () => ({
        data: mockInstances,
        isLoading: false,
        isError: false,
    }),
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { useIntegrationFallback } from '../useIntegrationFallback';

describe('useIntegrationFallback effective bind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('explicitlyCleared suppresses auto-bind when compatible instances exist', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: undefined,
                compatibleTypes: ['tautulli'],
                widgetType: 'tautulli',
                explicitlyCleared: true,
            }),
        );

        expect(result.current.integrationId).toBeNull();
        expect(result.current.reason).toBe('not_configured');
        expect(result.current.isFallback).toBe(false);
    });

    it('configured accessible compatible id resolves as original', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'tautulli-1',
                compatibleTypes: ['tautulli'],
                widgetType: 'tautulli',
            }),
        );

        expect(result.current.integrationId).toBe('tautulli-1');
        expect(result.current.isOriginal).toBe(true);
        expect(result.current.isFallback).toBe(false);
        expect(result.current.reason).toBe('accessible');
    });

    it('auto-binds first compatible when no configured id', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: undefined,
                compatibleTypes: ['tautulli'],
                widgetType: 'tautulli',
            }),
        );

        expect(result.current.integrationId).toBe('tautulli-1');
        expect(result.current.isFallback).toBe(true);
        expect(result.current.reason).toBe('accessible');
    });

    it('falls back when configured id is wrong type but compatible exists', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'qbittorrent-main',
                compatibleTypes: ['tautulli'],
                widgetType: 'tautulli',
            }),
        );

        expect(result.current.integrationId).toBe('tautulli-1');
        expect(result.current.isFallback).toBe(true);
    });

    it('returns not_configured when no configured id and no compatible', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: undefined,
                compatibleTypes: ['sonarr'],
                widgetType: 'sonarr',
            }),
        );

        expect(result.current.reason).toBe('not_configured');
        expect(result.current.integrationId).toBeNull();
    });

    it('returns no_access when configured id unusable and no compatible fallback', () => {
        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'missing-tautulli',
                compatibleTypes: ['sonarr'],
                widgetType: 'sonarr',
            }),
        );

        expect(result.current.reason).toBe('no_access');
        expect(result.current.integrationId).toBeNull();
    });
});
