/**
 * Prowlarr Poller Tests — joinIndexerHealth pure function
 */

import { describe, it, expect } from 'vitest';
import {
    joinIndexerHealth,
    type RawIndexer,
    type RawIndexerStatus,
    type RawHealthMessage,
} from '../prowlarr/poller';

describe('joinIndexerHealth', () => {
    const baseIndexers: RawIndexer[] = [
        {
            id: 1,
            name: '1337x',
            enable: true,
            protocol: 'torrent',
            privacy: 'private',
            priority: 25,
        },
        {
            id: 2,
            name: 'AnimeTosho',
            enable: false,
            protocol: 'usenet',
            privacy: 'public',
            priority: 10,
        },
    ];

    it('empty indexerstatus → all enabled indexers healthy', () => {
        const result = joinIndexerHealth(baseIndexers, [], []);

        expect(result.indexers).toHaveLength(2);
        expect(result.indexers[0].status).toBe('healthy');
        expect(result.summary.healthy).toBe(1);
        expect(result.summary.disabled).toBe(1);
    });

    it('indexer.enable=false → disabled regardless of status entry', () => {
        const statuses: RawIndexerStatus[] = [
            {
                indexerId: 2,
                disabledTill: new Date(Date.now() + 3600000).toISOString(),
                mostRecentFailureMessage: 'Should be ignored',
            },
        ];

        const result = joinIndexerHealth(baseIndexers, statuses, []);
        const disabled = result.indexers.find((i) => i.id === 2);

        expect(disabled?.status).toBe('disabled');
    });

    it('status entry with future disabledTill → failing', () => {
        const statuses: RawIndexerStatus[] = [
            {
                indexerId: 1,
                disabledTill: new Date(Date.now() + 3600000).toISOString(),
                mostRecentFailure: new Date(Date.now() - 60000).toISOString(),
                mostRecentFailureMessage: 'Connection failed',
            },
        ];

        const result = joinIndexerHealth(baseIndexers, statuses, []);
        const failing = result.indexers.find((i) => i.id === 1);

        expect(failing?.status).toBe('failing');
        expect(failing?.failureMessage).toBe('Connection failed');
    });

    it('status entry with past disabledTill → healthy', () => {
        const statuses: RawIndexerStatus[] = [
            {
                indexerId: 1,
                disabledTill: new Date(Date.now() - 3600000).toISOString(),
                mostRecentFailureMessage: 'Old failure',
            },
        ];

        const result = joinIndexerHealth(baseIndexers, statuses, []);
        const indexer = result.indexers.find((i) => i.id === 1);

        expect(indexer?.status).toBe('healthy');
    });

    it('CF message naming the indexer → cloudflareSuspected=true', () => {
        const statuses: RawIndexerStatus[] = [
            {
                indexerId: 1,
                disabledTill: new Date(Date.now() + 3600000).toISOString(),
                mostRecentFailureMessage: 'Cloudflare protection detected for 1337x',
            },
        ];

        const result = joinIndexerHealth(baseIndexers, statuses, []);
        const indexer = result.indexers.find((i) => i.id === 1);

        expect(indexer?.cloudflareSuspected).toBe(true);
    });

    it('CF message not naming any indexer → no badge, message in healthMessages', () => {
        const healthMessages: RawHealthMessage[] = [
            {
                source: 'IndexerRssCheck',
                type: 'warning',
                message: 'Cloudflare protection detected — see wiki for FlareSolverr setup.',
            },
        ];

        const result = joinIndexerHealth(baseIndexers, [], healthMessages);

        expect(result.indexers.every((i) => i.cloudflareSuspected === false)).toBe(true);
        expect(result.healthMessages).toHaveLength(1);
        expect(result.healthMessages[0].message).toContain('Cloudflare');
    });
});
