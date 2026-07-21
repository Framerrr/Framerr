/**
 * useSonarrData - Data management hook for the Sonarr widget
 * 
 * Manages:
 * - SSE subscription for calendar (upcoming episodes)
 * - SSE subscription for missing counts (stats bar)
 * - On-demand fetch for missing episode list (paginated)
 * - On-demand fetch for cutoff-unmet episode list (paginated)
 * - Admin actions: auto search, release search, grab
 * - Optimistic updates after actions
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import api from '../../../api/client';
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
    /** Max days out to show upcoming episodes. Unlike Radarr, Sonarr's config has no 'all' choice — always a finite number. */
    lookAheadDays?: number;
}

export function useSonarrData({ integrationId, enabled, lookAheadDays = 7 }: UseSonarrDataOpts): SonarrWidgetData {
    // ========================================================================
    // STATE
    // ========================================================================

    // Raw calendar data as delivered by SSE (deduped only — NOT yet filtered by
    // lookAheadDays). lookAheadDays is derived reactively below via useMemo, so
    // changing it in the widget's config takes effect immediately without
    // waiting for the next SSE push.
    const [rawUpcoming, setRawUpcoming] = useState<CalendarEpisode[]>([]);
    const [missingCounts, setMissingCounts] = useState<MissingCounts | null>(null);
    const [missingEpisodes, setMissingEpisodes] = useState<WantedEpisode[]>([]);
    const [missingPage, setMissingPage] = useState(1);
    const [missingTotal, setMissingTotal] = useState(0);
    const [missingLoading, setMissingLoading] = useState(false);
    const [cutoffEpisodes, setCutoffEpisodes] = useState<WantedEpisode[]>([]);
    const [cutoffPage, setCutoffPage] = useState(1);
    const [cutoffTotal, setCutoffTotal] = useState(0);
    const [cutoffLoading, setCutoffLoading] = useState(false);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Optimistic update suppression (same pattern as qBittorrent)
    const optimisticUntil = useRef(0);
    // Ref-based loading guards — avoid recreating callbacks on every loading toggle
    const missingLoadingRef = useRef(false);
    const cutoffLoadingRef = useRef(false);

    // ========================================================================
    // RESET ON INTEGRATION CHANGE
    // ========================================================================
    // When the effective integration changes (e.g., fallback to another instance),
    // clear all on-demand state. SSE hooks auto-resubscribe, but local state
    // (missing episodes, cutoff episodes, queue items) would otherwise show data
    // from the old integration.
    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setRawUpcoming([]);
            setMissingCounts(null);
            setMissingEpisodes([]);
            setMissingPage(1);
            setMissingTotal(0);
            setCutoffEpisodes([]);
            setCutoffPage(1);
            setCutoffTotal(0);
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

            // Deduplicate by episode ID (SSE can deliver overlapping data)
            const seen = new Set<number>();
            const uniqueEps = allEpisodes.filter(ep => {
                if (seen.has(ep.id)) return false;
                seen.add(ep.id);
                return true;
            });

            setRawUpcoming(uniqueEps);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load calendar');
        },
    });

    // Future-only + lookAheadDays filtering is derived reactively from
    // rawUpcoming + the current lookAheadDays config — recomputes on every
    // config change immediately, not just the next time the SSE happens to push.
    const upcoming = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();
        const lookAheadMs = lookAheadDays * 24 * 60 * 60 * 1000;

        return rawUpcoming
            .filter(ep => {
                const airDate = ep.airDateUtc || ep.airDate;
                if (!airDate) return false;
                const airMs = new Date(airDate).getTime();
                if (airMs < todayMs) return false;
                return airMs - todayMs <= lookAheadMs;
            })
            .sort((a, b) => {
                const aMs = new Date(a.airDateUtc || a.airDate!).getTime();
                const bMs = new Date(b.airDateUtc || b.airDate!).getTime();
                return aMs - bMs;
            });
    }, [rawUpcoming, lookAheadDays]);

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

    useIntegrationSSE<{
        items: Array<{
            id: number;
            episodeId?: number;
            status: string;
            trackedDownloadStatus?: string;
            trackedDownloadState?: string;
            progress?: number;
            timeleft?: string;
        }>;
        _meta?: unknown;
    }>({
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
                progress: q.progress,
                timeleft: q.timeleft,
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
            const data = await api.get<WantedResponse>(
                `/api/integrations/${integrationId}/proxy/missing?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'sonarr' } }
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
    const hasLoadedMissingOnce = useRef(false);
    useEffect(() => {
        if (missingEpisodes.length > 0 || missingTotal > 0) {
            hasLoadedMissingOnce.current = true;
        }
    }, [missingEpisodes.length, missingTotal]);

    // Auto-refresh missing list every 60s to stay in sync with Sonarr
    useEffect(() => {
        if (!integrationId || !enabled) return;
        // Only refresh if we've loaded at least once
        if (!hasLoadedMissingOnce.current) return;

        const interval = setInterval(() => {
            fetchMissingPage(1, false);
        }, 60_000);

        return () => clearInterval(interval);
    }, [integrationId, enabled, fetchMissingPage]);

    // ========================================================================
    // ON-DEMAND: Cutoff-unmet episode list (paginated) — mirrors missing above
    // ========================================================================

    const fetchCutoffPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        if (cutoffLoadingRef.current) return;
        cutoffLoadingRef.current = true;
        setCutoffLoading(true);

        try {
            const data = await api.get<WantedResponse>(
                `/api/integrations/${integrationId}/proxy/cutoff?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'sonarr' } }
            );

            // Sonarr's EpisodeResource has no `cutoffNotMet` field of its own — being
            // returned by /wanted/cutoff at all IS the signal. Stamp it explicitly so
            // getEpisodeStatus() in EpisodeDetailModal can tell this apart from a fully
            // satisfied, hasFile-true episode (which would otherwise read as 'available'
            // and hide the search/upgrade actions).
            const records = data.records.map(ep => ({ ...ep, cutoffNotMet: true }));

            setCutoffEpisodes(prev => {
                if (!append) return records;
                const existingIds = new Set(prev.map(ep => ep.id));
                const newRecords = records.filter(ep => !existingIds.has(ep.id));
                return [...prev, ...newRecords];
            });
            setCutoffTotal(data.totalRecords);
            setCutoffPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load cutoff-unmet episodes');
        } finally {
            cutoffLoadingRef.current = false;
            setCutoffLoading(false);
        }
    }, [integrationId]);

    const loadMoreCutoff = useCallback(() => {
        fetchCutoffPage(cutoffPage + 1, true);
    }, [fetchCutoffPage, cutoffPage]);

    const refreshCutoff = useCallback(() => {
        setCutoffPage(1);
        setCutoffEpisodes([]);
        setCutoffTotal(0);
        setTimeout(() => fetchCutoffPage(1, false), 0);
    }, [fetchCutoffPage]);

    const cutoffHasMore = cutoffEpisodes.length < cutoffTotal;

    const hasLoadedCutoffOnce = useRef(false);
    useEffect(() => {
        if (cutoffEpisodes.length > 0 || cutoffTotal > 0) {
            hasLoadedCutoffOnce.current = true;
        }
    }, [cutoffEpisodes.length, cutoffTotal]);

    // Independently guarded 60s auto-refresh — does not share the missing-list interval.
    useEffect(() => {
        if (!integrationId || !enabled) return;
        if (!hasLoadedCutoffOnce.current) return;

        const interval = setInterval(() => {
            fetchCutoffPage(1, false);
        }, 60_000);

        return () => clearInterval(interval);
    }, [integrationId, enabled, fetchCutoffPage]);

    // ========================================================================
    // ADMIN ACTIONS
    // ========================================================================

    const triggerAutoSearch = useCallback(async (episodeIds: number[]): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/command`,
                { name: 'EpisodeSearch', episodeIds },
                { headers: { 'X-Widget-Type': 'sonarr' } }
            );
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    const searchReleases = useCallback(async (episodeId: number): Promise<SonarrRelease[]> => {
        if (!integrationId) return [];

        const data = await api.get<SonarrRelease[]>(
            `/api/integrations/${integrationId}/proxy/release?episodeId=${episodeId}`,
            { headers: { 'X-Widget-Type': 'sonarr' } }
        );
        return data;
    }, [integrationId]);

    const grabRelease = useCallback(async (guid: string, indexerId: number, shouldOverride?: boolean): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/release`,
                { guid, indexerId, ...(shouldOverride && { shouldOverride: true }) },
                { headers: { 'X-Widget-Type': 'sonarr' } }
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
        cutoffEpisodes,
        cutoffLoading,
        cutoffHasMore,
        loadMoreCutoff,
        refreshCutoff,
        error,
        triggerAutoSearch,
        searchReleases,
        grabRelease,
    };
}
