import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IntegrationInstance } from '../../../../db/integrationInstances';

const mockGetInstancesByType = vi.fn();
vi.mock('../../../../db/integrationInstances', () => ({
    getInstancesByType: (...args: unknown[]) => mockGetInstancesByType(...args),
}));

const mockAdapterGet = vi.fn();
vi.mock('../../../../integrations/registry', () => ({
    getPlugin: (type: string) => {
        if (type === 'plex' || type === 'overseerr') {
            return { adapter: { get: mockAdapterGet } };
        }
        return null;
    },
}));

vi.mock('../../../../integrations/utils', () => ({
    toPluginInstance: (instance: IntegrationInstance) => instance,
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { pickMediaServerCandidates, resolveMediaServer } from '../mediaServerResolver';

function makeInstance(id: string, type: string): IntegrationInstance {
    return {
        id,
        type,
        displayName: id,
        config: {},
        enabled: true,
        createdAt: '',
        updatedAt: null,
    };
}

describe('pickMediaServerCandidates', () => {
    const mixed = [
        makeInstance('plex-1', 'plex'),
        makeInstance('jellyfin-1', 'jellyfin'),
        makeInstance('radarr-1', 'radarr'),
    ];

    it('returns plex candidates when ratingKey is set', () => {
        const result = pickMediaServerCandidates({ ratingKey: '123' }, mixed);
        expect(result).toEqual({ type: 'plex', candidates: [makeInstance('plex-1', 'plex')] });
    });

    it('returns jellyfin type with empty candidates when jellyfinMediaId set but no jellyfin instances', () => {
        const plexOnly = [makeInstance('plex-1', 'plex'), makeInstance('radarr-1', 'radarr')];
        const result = pickMediaServerCandidates({ jellyfinMediaId: 'abc' }, plexOnly);
        expect(result).toEqual({ type: 'jellyfin', candidates: [] });
    });

    it('returns null when neither field is set', () => {
        expect(pickMediaServerCandidates({}, mixed)).toBeNull();
        expect(pickMediaServerCandidates(undefined, mixed)).toBeNull();
    });
});

describe('resolveMediaServer', () => {
    const overseerr = makeInstance('overseerr-1', 'overseerr');

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInstancesByType.mockImplementation((type: string) => {
            if (type === 'plex') return [makeInstance('plex-a', 'plex')];
            if (type === 'jellyfin') return [];
            return [];
        });
    });

    it('resolves single plex candidate without adapter calls', async () => {
        const result = await resolveMediaServer(overseerr, { ratingKey: '99' });
        expect(result).toEqual({ type: 'plex', integrationId: 'plex-a' });
        expect(mockAdapterGet).not.toHaveBeenCalled();
    });

    it('disambiguates two plex candidates via Overseerr machineId', async () => {
        mockGetInstancesByType.mockImplementation((type: string) => {
            if (type === 'plex') {
                return [makeInstance('plex-a', 'plex'), makeInstance('plex-b', 'plex')];
            }
            return [];
        });
        mockAdapterGet.mockImplementation((inst: IntegrationInstance, path: string) => {
            if (path === '/api/v1/settings/plex') {
                return Promise.resolve({ data: { machineId: 'machine-b' } });
            }
            if (path === '/') {
                const machineId = inst.id === 'plex-b' ? 'machine-b' : 'machine-a';
                return Promise.resolve({ data: `<MediaContainer machineIdentifier="${machineId}"/>` });
            }
            return Promise.reject(new Error('unexpected'));
        });

        const result = await resolveMediaServer(overseerr, { ratingKey: '99' });
        expect(result).toEqual({ type: 'plex', integrationId: 'plex-b' });
    });

    it('returns null when two plex candidates do not match machineId', async () => {
        mockGetInstancesByType.mockImplementation((type: string) => {
            if (type === 'plex') {
                return [makeInstance('plex-a', 'plex'), makeInstance('plex-b', 'plex')];
            }
            return [];
        });
        mockAdapterGet.mockImplementation((_inst: IntegrationInstance, path: string) => {
            if (path === '/api/v1/settings/plex') {
                return Promise.resolve({ data: { machineId: 'no-match' } });
            }
            if (path === '/') {
                return Promise.resolve({ data: '<MediaContainer machineIdentifier="other"/>' });
            }
            return Promise.reject(new Error('unexpected'));
        });

        expect(await resolveMediaServer(overseerr, { ratingKey: '99' })).toBeNull();
    });

    it('returns null for two jellyfin candidates (no disambiguation)', async () => {
        mockGetInstancesByType.mockImplementation((type: string) => {
            if (type === 'jellyfin') {
                return [makeInstance('jf-a', 'jellyfin'), makeInstance('jf-b', 'jellyfin')];
            }
            return [];
        });

        expect(await resolveMediaServer(overseerr, { jellyfinMediaId: 'item-1' })).toBeNull();
        expect(mockAdapterGet).not.toHaveBeenCalled();
    });

    it('returns null when Overseerr settings/plex throws', async () => {
        mockGetInstancesByType.mockImplementation((type: string) => {
            if (type === 'plex') {
                return [makeInstance('plex-a', 'plex'), makeInstance('plex-b', 'plex')];
            }
            return [];
        });
        mockAdapterGet.mockRejectedValue(new Error('404'));

        await expect(resolveMediaServer(overseerr, { ratingKey: '99' })).resolves.toBeNull();
    });
});
