/**
 * useSonarrData - Data management hook for the Sonarr widget
 * 
 * Manages:
 * - SSE subscription for calendar (upcoming episodes)
 * - SSE subscription for missing counts (stats bar)
 * - On-demand fetch for missing episode list (paginated)
 * - Admin actions: auto search, release search, grab
 * - Optimistic updates after actions
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import { widgetFetchJson } from '../../../utils/widgetFetch';
import type {
    CalendarEpisode,
    WantedEpisode,
    WantedResponse,
    MissingCounts,
    SonarrRelease,
    SonarrWidgetData,
    QueueItem,
} from '../sonarr.types';

const PAGE_SIZE = 25;

interface UseSonarrDataOpts {
    integrationId: string | undefined;
    enabled: boolean;
}

export function useSonarrData({ integrationId, enabled }: UseSonarrDataOpts): SonarrWidgetData {
    // ========================================================================
    // STATE
    // ========================================================================

    const [upcoming, setUpcoming] = useState<CalendarEpisode[]>([]);
    const [missingCounts, setMissingCounts] = useState<MissingCounts | null>(null);
    const [missingEpisodes, setMissingEpisodes] = useState<WantedEpisode[]>([]);
    const [missingPage, setMissingPage] = useState(1);
    const [missingTotal, setMissingTotal] = useState(0);
    const [missingLoading, setMissingLoading] = useState(false);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Optimistic update suppression (same pattern as qBittorrent)
    const optimisticUntil = useRef(0);
    // Ref-based loading guard — avoids recreating callbacks on every loading toggle
    const missingLoadingRef = useRef(false);

    // ========================================================================
    // RESET ON INTEGRATION CHANGE
    // ========================================================================
    // When the effective integration changes (e.g., fallback to another instance),
    // clear all on-demand state. SSE hooks auto-resubscribe, but local state
    // (missing episodes, queue items) would otherwise show data from the old integration.
    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setUpcoming([]);
            setMissingCounts(null);
            setMissingEpisodes([]);
            setMissingPage(1);
            setMissingTotal(0);
            setQueueItems([]);
            setError(null);
        }
    }, [integrationId]);

    // ========================================================================
    // SSE: Calendar (upcoming episodes)
    // ========================================================================

    const { loading: calendarLoading, isConnected: calendarConnected } = useIntegrationSSE<{
        items: CalendarEpisode[];
        _meta?: unknown;
    }>({
        integrationType: 'sonarr',
        subtype: 'calendar',
        integrationId,
        enabled,
        onData: (data) => {
            if (Date.now() < optimisticUntil.current) return;

            const items = data?.items;
            const allEpisodes = Array.isArray(items) ? items : [];

            // Filter to future episodes only
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingEps = allEpisodes.filter(ep => {
                const airDate = ep.airDateUtc || ep.airDate;
                if (!airDate) return false;
                return new Date(airDate) >= today;
            });

            // Deduplicate by episode ID (SSE can deliver overlapping data)
            const seen = new Set<number>();
            const uniqueEps = upcomingEps.filter(ep => {
                if (seen.has(ep.id)) return false;
                seen.add(ep.id);
                return true;
            });

            setUpcoming(uniqueEps);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load calendar');
        },
    });

    // ========================================================================
    // SSE: Missing counts (stats bar)
    // ========================================================================

    useIntegrationSSE<MissingCounts & { _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'missing',
        integrationId,
        enabled,
        onData: (data) => {
            if (Date.now() < optimisticUntil.current) return;
            setMissingCounts({
                missingCount: data?.missingCount ?? 0,
                cutoffUnmetCount: data?.cutoffUnmetCount ?? 0,
            });
        },
        onError: () => {
            // Non-critical — stats bar just won't show counts
        },
    });

    // ========================================================================
    // SSE: Queue (download pipeline state for missing list enrichment)
    // ========================================================================

    useIntegrationSSE<{ items: Array<{ id: number; episodeId?: number; status: string; trackedDownloadStatus?: string; trackedDownloadState?: string }>; _meta?: unknown }>({
        integrationType: 'sonarr',
        integrationId,
        enabled,
        onData: (data) => {
            const items = data?.items;
            if (!Array.isArray(items)) return;
            setQueueItems(items.map(q => ({
                id: q.id,
                episodeId: q.episodeId,
                status: q.status,
                trackedDownloadStatus: q.trackedDownloadStatus,
                trackedDownloadState: q.trackedDownloadState,
            })));
        },
        onError: () => {
            // Non-critical — missing list just won't show download states
        },
    });

    // ========================================================================
    // ON-DEMAND: Missing episode list (paginated)
    // ========================================================================

    const fetchMissingPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        // Prevent concurrent fetches via ref (not state — avoids dep cascade)
        if (missingLoadingRef.current) return;
        missingLoadingRef.current = true;
        setMissingLoading(true);

        try {
            const data = await widgetFetchJson<WantedResponse>(
                `/api/integrations/${integrationId}/proxy/missing?page=${page}&pageSize=${PAGE_SIZE}`,
                'sonarr'
            );

            setMissingEpisodes(prev => {
                if (!append) return data.records;
                // Deduplicate when appending — same episode can appear across pages
                const existingIds = new Set(prev.map(ep => ep.id));
                const newRecords = data.records.filter(ep => !existingIds.has(ep.id));
                return [...prev, ...newRecords];
            });
            setMissingTotal(data.totalRecords);
            setMissingPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load missing episodes');
        } finally {
            missingLoadingRef.current = false;
            setMissingLoading(false);
        }
    }, [integrationId]);

    /** Load next page (append). Guarded against overrun. */
    const loadMoreMissing = useCallback(() => {
        fetchMissingPage(missingPage + 1, true);
    }, [fetchMissingPage, missingPage]);

    /** Reset to page 1 (full refresh). */
    const refreshMissing = useCallback(() => {
        setMissingPage(1);
        setMissingEpisodes([]);
        setMissingTotal(0);
        // Use setTimeout to ensure state is cleared before fetch
        setTimeout(() => fetchMissingPage(1, false), 0);
    }, [fetchMissingPage]);

    const missingHasMore = missingEpisodes.length < missingTotal;

    // Track whether initial load has happened (stable ref, no re-render cascade)
    const hasLoadedOnce = useRef(false);
    useEffect(() => {
        if (missingEpisodes.length > 0 || missingTotal > 0) {
            hasLoadedOnce.current = true;
        }
    }, [missingEpisodes.length, missingTotal]);

    // Auto-refresh missing list every 60s to stay in sync with Sonarr
    useEffect(() => {
        if (!integrationId || !enabled) return;
        // Only refresh if we've loaded at least once
        if (!hasLoadedOnce.current) return;

        const interval = setInterval(() => {
            fetchMissingPage(1, false);
        }, 60_000);

        return () => clearInterval(interval);
    }, [integrationId, enabled, fetchMissingPage]);

    // ========================================================================
    // ADMIN ACTIONS
    // ========================================================================

    const triggerAutoSearch = useCallback(async (episodeIds: number[]): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await widgetFetchJson(
                `/api/integrations/${integrationId}/proxy/command`,
                'sonarr',
                {
                    method: 'POST',
                    body: JSON.stringify({ name: 'EpisodeSearch', episodeIds }),
                }
            );
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    const searchReleases = useCallback(async (episodeId: number): Promise<SonarrRelease[]> => {
        if (!integrationId) return [];

        const data = await widgetFetchJson<SonarrRelease[]>(
            `/api/integrations/${integrationId}/proxy/release?episodeId=${episodeId}`,
            'sonarr'
        );
        return data;
    }, [integrationId]);

    const grabRelease = useCallback(async (guid: string, indexerId: number, shouldOverride?: boolean): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await widgetFetchJson(
                `/api/integrations/${integrationId}/proxy/release`,
                'sonarr',
                {
                    method: 'POST',
                    body: JSON.stringify({ guid, indexerId, ...(shouldOverride && { shouldOverride: true }) }),
                }
            );
            // Suppress stale SSE data for 3s
            optimisticUntil.current = Date.now() + 3000;
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    // ========================================================================
    // RETURN
    // ========================================================================

    return {
        upcoming,
        missingCounts,
        queueItems,
        calendarConnected,
        calendarLoading,
        missingEpisodes,
        missingLoading,
        missingHasMore,
        loadMoreMissing,
        refreshMissing,
        error,
        triggerAutoSearch,
        searchReleases,
        grabRelease,
    };
}
