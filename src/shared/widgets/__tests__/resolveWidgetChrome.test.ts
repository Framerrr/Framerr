/**
 * resolveWidgetChrome unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../widgets/registry', () => ({
    getWidgetMetadata: vi.fn((type: string) => {
        const map: Record<string, { name: string; multiIntegration?: boolean; compatibleIntegrations?: string[] }> = {
            tautulli: { name: 'Tautulli', compatibleIntegrations: ['tautulli'] },
            downloads: { name: 'Downloads', compatibleIntegrations: ['qbittorrent'] },
            sonarr: { name: 'Sonarr', compatibleIntegrations: ['sonarr'] },
            calendar: { name: 'Calendar', multiIntegration: true },
        };
        return map[type] || { name: 'Widget' };
    }),
    getWidgetIconName: vi.fn((type: string) => {
        const map: Record<string, string> = {
            tautulli: 'BarChart3',
            downloads: 'Download',
            sonarr: 'Tv',
            calendar: 'Calendar',
        };
        return map[type] || 'Server';
    }),
}));

import { resolveWidgetChrome } from '../resolveWidgetChrome';

const schemas = {
    tautulli: { name: 'Tautulli', icon: 'system:tautulli' },
    qbittorrent: { name: 'qBittorrent', icon: 'system:qbittorrent' },
    sonarr: { name: 'Sonarr', icon: 'system:sonarr' },
};

const integrations = [
    { id: 'tautulli-1', type: 'tautulli', name: 'Home Tautulli', displayName: 'Home Tautulli' },
    { id: 'qbittorrent-main', type: 'qbittorrent', name: 'qBit', displayName: 'Living Room qBit' },
    { id: 'sonarr-4k-hdr', type: 'sonarr', name: 'Sonarr 4K', displayName: 'Sonarr 4K' },
];

describe('resolveWidgetChrome', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('unbound widget uses plugin defaults', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'tautulli', config: {} },
            schemas,
            integrations: [],
        });
        expect(result).toEqual({ title: 'Tautulli', iconName: 'BarChart3' });
    });

    it('bound widget uses instance displayName + schema icon', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'tautulli', config: { integrationId: 'tautulli-1' } },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Home Tautulli', iconName: 'system:tautulli' });
    });

    it('explicit overrides win', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'tautulli',
                config: {
                    integrationId: 'tautulli-1',
                    title: 'My Custom',
                    titleOverridden: true,
                    customIcon: 'Star',
                    iconOverridden: true,
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'My Custom', iconName: 'Star' });
    });

    it('explicit false flags ignore stored values', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'tautulli',
                config: {
                    integrationId: 'tautulli-1',
                    title: 'Stale',
                    titleOverridden: false,
                    customIcon: 'Star',
                    iconOverridden: false,
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Home Tautulli', iconName: 'system:tautulli' });
    });

    it('legacy stored values without flags win when different from derived', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'tautulli',
                config: {
                    integrationId: 'tautulli-1',
                    title: 'Old Custom Title',
                    customIcon: 'Heart',
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Old Custom Title', iconName: 'Heart' });
    });

    it('legacy auto-fill equal to derived does not stick', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'tautulli',
                config: {
                    integrationId: 'tautulli-1',
                    title: 'Home Tautulli',
                    customIcon: 'system:tautulli',
                },
            },
            schemas,
            integrations,
        });
        // Equal to derived → treat as non-override; still resolves to same values
        expect(result).toEqual({ title: 'Home Tautulli', iconName: 'system:tautulli' });
    });

    it('hyphenated integration ids resolve via instance type not string split', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'sonarr', config: { integrationId: 'sonarr-4k-hdr' } },
            schemas,
            integrations,
        });
        // split('-')[0] would be 'sonarr' (ok here) but type comes from instance
        expect(result).toEqual({ title: 'Sonarr 4K', iconName: 'system:sonarr' });
    });

    it('downloads unbound uses plugin identity', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'downloads', config: {} },
            schemas,
            integrations: [],
        });
        expect(result).toEqual({ title: 'Downloads', iconName: 'Download' });
    });

    it('downloads bound to qBit uses qBit branding', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'downloads', config: { integrationId: 'qbittorrent-main' } },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Living Room qBit', iconName: 'system:qbittorrent' });
    });

    it('cleared override returns to derived', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'tautulli',
                config: {
                    integrationId: 'tautulli-1',
                    title: '',
                    titleOverridden: false,
                    customIcon: undefined,
                    iconOverridden: false,
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Home Tautulli', iconName: 'system:tautulli' });
    });

    it('multi-integration Calendar ignores stale integrationId and sticky title', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'calendar',
                config: {
                    integrationId: 'qbittorrent-main',
                    title: 'qBittorrent',
                    customIcon: 'system:qbittorrent',
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Calendar', iconName: 'Calendar' });
    });

    it('multi-integration Calendar honors explicit title override', () => {
        const result = resolveWidgetChrome({
            widget: {
                type: 'calendar',
                config: {
                    title: 'Media Calendar',
                    titleOverridden: true,
                },
            },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Media Calendar', iconName: 'Calendar' });
    });

    it('single-slot derives chrome from effective bind when stored integrationId is missing', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'tautulli', config: {} },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Home Tautulli', iconName: 'system:tautulli' });
    });

    it('single-slot with forceClearIntegration stays on plugin defaults', () => {
        const result = resolveWidgetChrome({
            widget: { type: 'tautulli', config: { forceClearIntegration: true } },
            schemas,
            integrations,
        });
        expect(result).toEqual({ title: 'Tautulli', iconName: 'BarChart3' });
    });
});
