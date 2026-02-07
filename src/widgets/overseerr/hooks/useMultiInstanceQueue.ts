/**
 * useMultiInstanceQueue
 * 
 * Hook to subscribe to queue data from multiple Radarr/Sonarr instances.
 * This is specifically designed for the Overseerr widget which needs to
 * correlate downloads from multiple instances.
 * 
 * Since React hooks can't be called in loops, this hook uses a pattern
 * where it subscribes to up to MAX_INSTANCES_PER_TYPE instances.
 */

import { useState, useEffect, useCallback } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';

/** Maximum instances per type we support (Radarr/Sonarr each) */
const MAX_INSTANCES_PER_TYPE = 4;

/** Queue item from Radarr/Sonarr */
export interface QueueItem {
    id?: number;
    progress?: number;
    timeleft?: string;
    movie?: { tmdbId?: number; title?: string };
    series?: { tmdbId?: number; title?: string };
    size?: number;
    sizeleft?: number;
}

/** Aggregated queue data keyed by integrationId */
export interface MultiInstanceQueueData {
    /** Map from integrationId -> queue items */
    queues: Map<string, QueueItem[]>;
    /** Whether any subscriptions are loading */
    loading: boolean;
}

/**
 * Hook to subscribe to queue SSE from multiple instances.
 * 
 * @param radarrIds - Array of Radarr integration IDs to subscribe to
 * @param sonarrIds - Array of Sonarr integration IDs to subscribe to
 * @returns Aggregated queue data from all instances
 */
export function useMultiInstanceQueue(
    radarrIds: string[],
    sonarrIds: string[]
): MultiInstanceQueueData {
    // State to hold all queue data keyed by integrationId
    const [queues, setQueues] = useState<Map<string, QueueItem[]>>(new Map());
    const [loading, setLoading] = useState(true);

    // Pad arrays to fixed length (hook count must be constant)
    const paddedRadarrIds = [...radarrIds.slice(0, MAX_INSTANCES_PER_TYPE)];
    const paddedSonarrIds = [...sonarrIds.slice(0, MAX_INSTANCES_PER_TYPE)];
    while (paddedRadarrIds.length < MAX_INSTANCES_PER_TYPE) paddedRadarrIds.push('');
    while (paddedSonarrIds.length < MAX_INSTANCES_PER_TYPE) paddedSonarrIds.push('');

    // Callback to update queue data for a specific integration
    const updateQueue = useCallback((integrationId: string, data: QueueItem[]) => {
        if (!integrationId) return;
        setQueues(prev => {
            const next = new Map(prev);
            next.set(integrationId, data);
            return next;
        });
        setLoading(false);
    }, []);

    // Subscribe to each Radarr instance (fixed number of hooks)
    // SSE data is now wrapped as {items: [...], _meta: {...}} to survive delta patching
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'queue',
        integrationId: paddedRadarrIds[0] || undefined,
        enabled: !!paddedRadarrIds[0],
        onData: (data) => updateQueue(paddedRadarrIds[0], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'queue',
        integrationId: paddedRadarrIds[1] || undefined,
        enabled: !!paddedRadarrIds[1],
        onData: (data) => updateQueue(paddedRadarrIds[1], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'queue',
        integrationId: paddedRadarrIds[2] || undefined,
        enabled: !!paddedRadarrIds[2],
        onData: (data) => updateQueue(paddedRadarrIds[2], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'queue',
        integrationId: paddedRadarrIds[3] || undefined,
        enabled: !!paddedRadarrIds[3],
        onData: (data) => updateQueue(paddedRadarrIds[3], Array.isArray(data?.items) ? data.items : []),
    });

    // Subscribe to each Sonarr instance (fixed number of hooks)
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'queue',
        integrationId: paddedSonarrIds[0] || undefined,
        enabled: !!paddedSonarrIds[0],
        onData: (data) => updateQueue(paddedSonarrIds[0], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'queue',
        integrationId: paddedSonarrIds[1] || undefined,
        enabled: !!paddedSonarrIds[1],
        onData: (data) => updateQueue(paddedSonarrIds[1], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'queue',
        integrationId: paddedSonarrIds[2] || undefined,
        enabled: !!paddedSonarrIds[2],
        onData: (data) => updateQueue(paddedSonarrIds[2], Array.isArray(data?.items) ? data.items : []),
    });
    useIntegrationSSE<{ items: QueueItem[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'queue',
        integrationId: paddedSonarrIds[3] || undefined,
        enabled: !!paddedSonarrIds[3],
        onData: (data) => updateQueue(paddedSonarrIds[3], Array.isArray(data?.items) ? data.items : []),
    });

    // Clear stale entries when IDs change
    useEffect(() => {
        const validIds = new Set([...radarrIds, ...sonarrIds]);
        setQueues(prev => {
            const next = new Map<string, QueueItem[]>();
            for (const [id, data] of prev) {
                if (validIds.has(id)) {
                    next.set(id, data);
                }
            }
            return next;
        });
    }, [radarrIds.join(','), sonarrIds.join(',')]);

    return { queues, loading };
}

/**
 * Find download info for a media item across all queues.
 * 
 * @param tmdbId - TMDB ID of the media
 * @param mediaType - 'movie' or 'tv'
 * @param queues - Map of integrationId -> queue items
 * @returns Array of download info per integration
 */
export function findDownloadsForMedia(
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    queues: Map<string, QueueItem[]>
): Array<{ integrationId: string; progress: number; timeLeft?: string; episodeCount?: number }> {
    const downloads: Array<{ integrationId: string; progress: number; timeLeft?: string; episodeCount?: number }> = [];

    for (const [integrationId, queueItems] of queues) {
        if (mediaType === 'movie') {
            const match = queueItems.find(q => q.movie?.tmdbId === tmdbId);
            if (match) {
                downloads.push({
                    integrationId,
                    progress: match.progress || 0,
                    timeLeft: match.timeleft
                });
            }
        } else {
            // TV: aggregate all episodes for this series
            const matches = queueItems.filter(q => q.series?.tmdbId === tmdbId);
            if (matches.length > 0) {
                const totalSize = matches.reduce((sum, q) => sum + (q.size || 0), 0);
                const totalSizeLeft = matches.reduce((sum, q) => sum + (q.sizeleft || 0), 0);
                const progress = totalSize > 0 ? Math.round(((totalSize - totalSizeLeft) / totalSize) * 100) : 0;
                const longestTime = matches.reduce((max, q) => q.timeleft && q.timeleft > max ? q.timeleft : max, '');

                downloads.push({
                    integrationId,
                    progress,
                    timeLeft: longestTime || undefined,
                    episodeCount: matches.length
                });
            }
        }
    }

    // Sort alphabetically by integrationId for stable ordering
    downloads.sort((a, b) => a.integrationId.localeCompare(b.integrationId));

    return downloads;
}
