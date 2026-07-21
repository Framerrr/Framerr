/**
 * useRadarrData - Data management hook for the Radarr widget
 * 
 * Manages:
 * - SSE subscription for calendar (upcoming movies)
 * - SSE subscription for missing counts (stats bar)
 * - On-demand fetch for missing movie list (paginated)
 * - On-demand fetch for cutoff-unmet movie list (paginated)
 * - Admin actions: auto search, release search, grab
 * - Optimistic updates after actions
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import api from '../../../api/client';
import { computeMovieDisplayState, filterAndSortByStrictDate } from './radarrDisplayState';
import type {
    CalendarMovie,
    WantedMovie,
    WantedMovieResponse,
    MissingCounts,
    RadarrRelease,
    RadarrWidgetData,
    QueueItem,
    ReleaseTypeVisibility,
    MovieDisplayInfo,
} from '../radarr.types';

const PAGE_SIZE = 25;

export type RadarrSortBy = 'nextDate' | 'cinema' | 'digital' | 'physical';

interface UseRadarrDataOpts {
    integrationId: string | undefined;
    enabled: boolean;
    /** Ordering/filtering mode (spec §1.8). Defaults to 'nextDate' (7-state tree). */
    sortBy?: RadarrSortBy;
    /** Max days out to show upcoming movies. 'all' disables the bound. */
    lookAheadDays?: number | 'all';
    /** Which release-date types are considered/shown at all. All default true. */
    visibility?: ReleaseTypeVisibility;
}

const DEFAULT_VISIBILITY: ReleaseTypeVisibility = {
    showCinema: true,
    showDigital: true,
    showPhysical: true,
};

export function useRadarrData({
    integrationId,
    enabled,
    sortBy = 'nextDate',
    lookAheadDays = 30,
    visibility = DEFAULT_VISIBILITY,
}: UseRadarrDataOpts): RadarrWidgetData {
    // ========================================================================
    // STATE
    // ========================================================================

    // Raw calendar data as delivered by SSE (deduped, hasFile-filtered only —
    // NOT yet sorted/filtered by sortBy/lookAheadDays/visibility). Those config
    // options are derived reactively below via useMemo, so changing them in
    // the widget's config takes effect immediately without waiting for the
    // next SSE push.
    const [rawUpcoming, setRawUpcoming] = useState<CalendarMovie[]>([]);
    const [missingCounts, setMissingCounts] = useState<MissingCounts | null>(null);
    const [missingMovies, setMissingMovies] = useState<WantedMovie[]>([]);
    const [missingPage, setMissingPage] = useState(1);
    const [missingTotal, setMissingTotal] = useState(0);
    const [missingLoading, setMissingLoading] = useState(false);
    const [cutoffMovies, setCutoffMovies] = useState<WantedMovie[]>([]);
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
    // (missing movies, cutoff movies, queue items) would otherwise show data
    // from the old integration.
    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setRawUpcoming([]);
            setMissingCounts(null);
            setMissingMovies([]);
            setMissingPage(1);
            setMissingTotal(0);
            setCutoffMovies([]);
            setCutoffPage(1);
            setCutoffTotal(0);
            setQueueItems([]);
            setError(null);
        }
    }, [integrationId]);

    // ========================================================================
    // SSE: Calendar (upcoming movies)
    // ========================================================================

    const { loading: calendarLoading, isConnected: calendarConnected } = useIntegrationSSE<{
        items: CalendarMovie[];
        _meta?: unknown;
    }>({
        integrationType: 'radarr',
        subtype: 'calendar',
        integrationId,
        enabled,
        onData: (data) => {
            if (Date.now() < optimisticUntil.current) return;

            const items = data?.items;
            const allMovies = Array.isArray(items) ? items : [];

            // Already-downloaded movies never appear in upcoming, regardless of sort mode.
            const notDownloaded = allMovies.filter(movie => !movie.hasFile);

            // Deduplicate by movie ID (SSE can deliver overlapping data)
            const seen = new Set<number>();
            const uniqueMovies = notDownloaded.filter(movie => {
                if (seen.has(movie.id)) return false;
                seen.add(movie.id);
                return true;
            });

            setRawUpcoming(uniqueMovies);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load calendar');
        },
    });

    // Sort/filter is derived reactively from rawUpcoming + the current
    // sortBy/lookAheadDays/visibility config — recomputes on every config
    // change immediately, not just the next time the SSE happens to push.
    const { upcoming, upcomingDisplay } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lookAheadMs = lookAheadDays === 'all' ? null : lookAheadDays * 24 * 60 * 60 * 1000;
        const withinLookAhead = (displayDateStr: string | null): boolean => {
            if (lookAheadMs === null) return true;
            // State 3 ("In Cinemas Now") has no future date to compare — exempt from the bound.
            if (displayDateStr === null) return true;
            const displayMs = new Date(displayDateStr).setHours(0, 0, 0, 0);
            return displayMs - today.getTime() <= lookAheadMs;
        };

        let orderedEntries: Array<{ movie: CalendarMovie; display: MovieDisplayInfo }>;

        if (sortBy === 'nextDate') {
            orderedEntries = rawUpcoming
                .map(movie => {
                    const display = computeMovieDisplayState(movie, today, visibility);
                    return display ? { movie, display } : null;
                })
                .filter((entry): entry is { movie: CalendarMovie; display: MovieDisplayInfo } => entry !== null)
                .filter(entry => withinLookAhead(entry.display.displayDate))
                .sort((a, b) => a.display.sortKey - b.display.sortKey);
        } else {
            const field = sortBy === 'cinema' ? 'inCinemas' : sortBy === 'digital' ? 'digitalRelease' : 'physicalRelease';
            const visible = sortBy === 'cinema' ? visibility.showCinema
                : sortBy === 'digital' ? visibility.showDigital
                    : visibility.showPhysical;
            orderedEntries = filterAndSortByStrictDate(rawUpcoming, field, today, visible)
                .filter(entry => withinLookAhead(entry.display.displayDate));
        }

        return {
            upcoming: orderedEntries.map(entry => entry.movie),
            upcomingDisplay: new Map(orderedEntries.map(entry => [entry.movie.id, entry.display])),
        };
    }, [rawUpcoming, sortBy, lookAheadDays, visibility]);

    // ========================================================================
    // SSE: Missing counts (stats bar)
    // ========================================================================

    useIntegrationSSE<MissingCounts & { _meta?: unknown }>({
        integrationType: 'radarr',
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
            movieId?: number;
            status: string;
            trackedDownloadStatus?: string;
            trackedDownloadState?: string;
            progress?: number;
            timeleft?: string;
        }>;
        _meta?: unknown;
    }>({
        integrationType: 'radarr',
        integrationId,
        enabled,
        onData: (data) => {
            const items = data?.items;
            if (!Array.isArray(items)) return;
            setQueueItems(items.map(q => ({
                id: q.id,
                movieId: q.movieId,
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
    // ON-DEMAND: Missing movie list (paginated)
    // ========================================================================

    const fetchMissingPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        // Prevent concurrent fetches via ref (not state — avoids dep cascade)
        if (missingLoadingRef.current) return;
        missingLoadingRef.current = true;
        setMissingLoading(true);

        try {
            const data = await api.get<WantedMovieResponse>(
                `/api/integrations/${integrationId}/proxy/missing?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'radarr' } }
            );

            setMissingMovies(prev => {
                if (!append) return data.records;
                // Deduplicate when appending — same movie can appear across pages
                const existingIds = new Set(prev.map(m => m.id));
                const newRecords = data.records.filter(m => !existingIds.has(m.id));
                return [...prev, ...newRecords];
            });
            setMissingTotal(data.totalRecords);
            setMissingPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load missing movies');
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
        setMissingMovies([]);
        setMissingTotal(0);
        // Use setTimeout to ensure state is cleared before fetch
        setTimeout(() => fetchMissingPage(1, false), 0);
    }, [fetchMissingPage]);

    const missingHasMore = missingMovies.length < missingTotal;

    // Track whether initial load has happened (stable ref, no re-render cascade)
    const hasLoadedMissingOnce = useRef(false);
    useEffect(() => {
        if (missingMovies.length > 0 || missingTotal > 0) {
            hasLoadedMissingOnce.current = true;
        }
    }, [missingMovies.length, missingTotal]);

    // Auto-refresh missing list every 60s to stay in sync with Radarr
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
    // ON-DEMAND: Cutoff-unmet movie list (paginated) — mirrors missing above
    // ========================================================================

    const fetchCutoffPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        if (cutoffLoadingRef.current) return;
        cutoffLoadingRef.current = true;
        setCutoffLoading(true);

        try {
            const data = await api.get<WantedMovieResponse>(
                `/api/integrations/${integrationId}/proxy/cutoff?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'radarr' } }
            );

            // Radarr's MovieResource has no `cutoffNotMet` field of its own — being
            // returned by /wanted/cutoff at all IS the signal. Stamp it explicitly so
            // getMovieStatus() in MovieDetailModal can tell this apart from a fully
            // satisfied, hasFile-true movie (which would otherwise read as 'available'
            // and hide the search/upgrade actions).
            const records = data.records.map(m => ({ ...m, cutoffNotMet: true }));

            setCutoffMovies(prev => {
                if (!append) return records;
                const existingIds = new Set(prev.map(m => m.id));
                const newRecords = records.filter(m => !existingIds.has(m.id));
                return [...prev, ...newRecords];
            });
            setCutoffTotal(data.totalRecords);
            setCutoffPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load cutoff-unmet movies');
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
        setCutoffMovies([]);
        setCutoffTotal(0);
        setTimeout(() => fetchCutoffPage(1, false), 0);
    }, [fetchCutoffPage]);

    const cutoffHasMore = cutoffMovies.length < cutoffTotal;

    const hasLoadedCutoffOnce = useRef(false);
    useEffect(() => {
        if (cutoffMovies.length > 0 || cutoffTotal > 0) {
            hasLoadedCutoffOnce.current = true;
        }
    }, [cutoffMovies.length, cutoffTotal]);

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

    const triggerAutoSearch = useCallback(async (movieIds: number[]): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/command`,
                { name: 'MoviesSearch', movieIds },
                { headers: { 'X-Widget-Type': 'radarr' } }
            );
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    const searchReleases = useCallback(async (movieId: number): Promise<RadarrRelease[]> => {
        if (!integrationId) return [];

        const data = await api.get<RadarrRelease[]>(
            `/api/integrations/${integrationId}/proxy/release?movieId=${movieId}`,
            { headers: { 'X-Widget-Type': 'radarr' } }
        );
        return data;
    }, [integrationId]);

    const grabRelease = useCallback(async (guid: string, indexerId: number, shouldOverride?: boolean): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/release`,
                { guid, indexerId, ...(shouldOverride && { shouldOverride: true }) },
                { headers: { 'X-Widget-Type': 'radarr' } }
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
        upcomingDisplay,
        missingCounts,
        queueItems,
        calendarConnected,
        calendarLoading,
        missingMovies,
        missingLoading,
        missingHasMore,
        loadMoreMissing,
        refreshMissing,
        cutoffMovies,
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
