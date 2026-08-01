/**
 * useIntegrationFallback — effective bind + explicit clear + settle guards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockInstances = [
    { id: 'jellyfin-1', type: 'jellyfin', displayName: 'Offline Jellyfin', enabled: true },
    { id: 'plex-1', type: 'plex', displayName: 'Home Plex', enabled: true },
    { id: 'tautulli-1', type: 'tautulli', displayName: 'Home Tautulli', enabled: true },
    { id: 'qbittorrent-main', type: 'qbittorrent', displayName: 'qBit', enabled: true },
];

let mockIntegrationsState = {
    data: mockInstances as typeof mockInstances | [],
    isLoading: false,
    isPending: false,
    isFetching: false,
    isFetched: true,
    isError: false,
};

let mockAuthState = {
    user: { group: 'admin' } as { group: string } | null,
    loading: false,
};

vi.mock('../../../../context/useAuth', () => ({
    useAuth: () => mockAuthState,
}));

vi.mock('../../../../api/hooks/useIntegrations', () => ({
    useRoleAwareIntegrations: () => mockIntegrationsState,
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { useIntegrationFallback } from '../useIntegrationFallback';

describe('useIntegrationFallback effective bind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState = { user: { group: 'admin' }, loading: false };
        mockIntegrationsState = {
            data: mockInstances,
            isLoading: false,
            isPending: false,
            isFetching: false,
            isFetched: true,
            isError: false,
        };
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

    it('stays loading while auth is still resolving — does not fall back', () => {
        mockAuthState = { user: null, loading: true };
        // Stale/wrong list must not win while auth unsettled
        mockIntegrationsState = {
            data: [mockInstances[0]],
            isLoading: false,
            isPending: false,
            isFetching: false,
            isFetched: true,
            isError: false,
        };

        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'plex-1',
                compatibleTypes: ['plex', 'jellyfin', 'emby'],
                widgetType: 'media-stream',
            }),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.isFallback).toBe(false);
    });

    it('stays loading while integrations query is pending — does not fall back', () => {
        mockIntegrationsState = {
            data: [],
            isLoading: false,
            isPending: true,
            isFetching: false,
            isFetched: false,
            isError: false,
        };

        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'plex-1',
                compatibleTypes: ['plex', 'jellyfin', 'emby'],
                widgetType: 'media-stream',
            }),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.reason).toBe('loading');
        expect(result.current.isFallback).toBe(false);
        expect(result.current.integrationId).toBeNull();
    });

    it('holds loading when configured plex is missing mid-fetch (avoids jellyfin persist race)', () => {
        // Partial list: only jellyfin visible while refetch in flight — must NOT fall back
        mockIntegrationsState = {
            data: [mockInstances[0]], // jellyfin only
            isLoading: false,
            isPending: false,
            isFetching: true,
            isFetched: true,
            isError: false,
        };

        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'plex-1',
                compatibleTypes: ['plex', 'jellyfin', 'emby'],
                widgetType: 'media-stream',
            }),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.isFallback).toBe(false);
        expect(result.current.integrationId).toBeNull();
    });

    it('falls back to jellyfin only after settled fetch confirms plex is gone', () => {
        mockIntegrationsState = {
            data: [mockInstances[0]], // jellyfin only, settled
            isLoading: false,
            isPending: false,
            isFetching: false,
            isFetched: true,
            isError: false,
        };

        const { result } = renderHook(() =>
            useIntegrationFallback({
                configuredId: 'plex-1',
                compatibleTypes: ['plex', 'jellyfin', 'emby'],
                widgetType: 'media-stream',
            }),
        );

        expect(result.current.loading).toBe(false);
        expect(result.current.isFallback).toBe(true);
        expect(result.current.integrationId).toBe('jellyfin-1');
    });
});
