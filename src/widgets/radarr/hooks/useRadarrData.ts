/**
 * useRadarrData - Data management hook for the Radarr widget
 * 
 * Manages:
 * - SSE subscription for calendar (upcoming movies)
 * - SSE subscription for missing counts (stats bar)
 * - On-demand fetch for missing movie list (paginated)
 * - Admin actions: auto search, release search, grab
 * - Optimistic updates after actions
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import { widgetFetchJson } from '../../../utils/widgetFetch';
import type {
    CalendarMovie,
    WantedMovie,
    WantedMovieResponse,
    MissingCounts,
    RadarrRelease,
    RadarrWidgetData,
    QueueItem,
} from '../radarr.types';

const PAGE_SIZE = 25;

interface UseRadarrDataOpts {
    integrationId: string | undefined;
    enabled: boolean;
}


export function useRadarrData({ integrationId, enabled }: UseRadarrDataOpts): RadarrWidgetData {
    // ========================================================================
    // STATE
    // ========================================================================

    const [upcoming, setUpcoming] = useState<CalendarMovie[]>([]);
    const [missingCounts, setMissingCounts] = useState<MissingCounts | null>(null);
    const [missingMovies, setMissingMovies] = useState<WantedMovie[]>([]);
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

            // Filter to upcoming movies not yet downloaded.
            // Primary date: digitalRelease (when Radarr actually grabs it).
            // Fallback: inCinemas (if no digital date set yet, cinema date gives a timeline).
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingMovies = allMovies.filter(movie => {
                if (movie.hasFile) return false;
                // If digital release exists, only show if it's in the future
                if (movie.digitalRelease) return new Date(movie.digitalRelease) >= today;
                // No digital release announced — movie is waiting for digital,
                // show it as upcoming with TBA (even if cinema date is past)
                return true;
            });

            // Deduplicate by movie ID (SSE can deliver overlapping data)
            const seen = new Set<number>();
            const uniqueMovies = upcomingMovies.filter(movie => {
                if (seen.has(movie.id)) return false;
                seen.add(movie.id);
                return true;
            });

            setUpcoming(uniqueMovies);
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

    useIntegrationSSE<{ items: Array<{ id: number; movieId?: number; status: string; trackedDownloadStatus?: string; trackedDownloadState?: string }>; _meta?: unknown }>({
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
            const data = await widgetFetchJson<WantedMovieResponse>(
                `/api/integrations/${integrationId}/proxy/missing?page=${page}&pageSize=${PAGE_SIZE}`,
                'radarr'
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
    const hasLoadedOnce = useRef(false);
    useEffect(() => {
        if (missingMovies.length > 0 || missingTotal > 0) {
            hasLoadedOnce.current = true;
        }
    }, [missingMovies.length, missingTotal]);

    // Auto-refresh missing list every 60s to stay in sync with Radarr
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

    const triggerAutoSearch = useCallback(async (movieIds: number[]): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await widgetFetchJson(
                `/api/integrations/${integrationId}/proxy/command`,
                'radarr',
                {
                    method: 'POST',
                    body: JSON.stringify({ name: 'MoviesSearch', movieIds }),
                }
            );
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    const searchReleases = useCallback(async (movieId: number): Promise<RadarrRelease[]> => {
        if (!integrationId) return [];

        const data = await widgetFetchJson<RadarrRelease[]>(
            `/api/integrations/${integrationId}/proxy/release?movieId=${movieId}`,
            'radarr'
        );
        return data;
    }, [integrationId]);

    const grabRelease = useCallback(async (guid: string, indexerId: number, shouldOverride?: boolean): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await widgetFetchJson(
                `/api/integrations/${integrationId}/proxy/release`,
                'radarr',
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
        missingMovies,
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
