/**
 * useLidarrData - Data management hook for the Lidarr widget
 *
 * Manages:
 * - SSE subscription for calendar (upcoming albums)
 * - SSE subscription for missing counts (stats bar)
 * - On-demand fetch for missing album list (paginated)
 * - On-demand fetch for cutoff-unmet album list (paginated)
 * - Admin actions: auto search, release search, grab
 * - Optimistic updates after actions
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import api from '../../../api/client';
import type {
    CalendarAlbum,
    WantedAlbum,
    WantedResponse,
    MissingCounts,
    LidarrRelease,
    LidarrWidgetData,
    QueueItem,
} from '../lidarr.types';

const PAGE_SIZE = 25;

interface UseLidarrDataOpts {
    integrationId: string | undefined;
    enabled: boolean;
    /** Max days out to show upcoming albums; `'all'` skips the upper bound. */
    lookAheadDays?: number | 'all';
}

export function useLidarrData({ integrationId, enabled, lookAheadDays = 30 }: UseLidarrDataOpts): LidarrWidgetData {
    const [rawUpcoming, setRawUpcoming] = useState<CalendarAlbum[]>([]);
    const [missingCounts, setMissingCounts] = useState<MissingCounts | null>(null);
    const [missingAlbums, setMissingAlbums] = useState<WantedAlbum[]>([]);
    const [missingPage, setMissingPage] = useState(1);
    const [missingTotal, setMissingTotal] = useState(0);
    const [missingLoading, setMissingLoading] = useState(false);
    const [cutoffAlbums, setCutoffAlbums] = useState<WantedAlbum[]>([]);
    const [cutoffPage, setCutoffPage] = useState(1);
    const [cutoffTotal, setCutoffTotal] = useState(0);
    const [cutoffLoading, setCutoffLoading] = useState(false);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const optimisticUntil = useRef(0);
    const missingLoadingRef = useRef(false);
    const cutoffLoadingRef = useRef(false);

    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setRawUpcoming([]);
            setMissingCounts(null);
            setMissingAlbums([]);
            setMissingPage(1);
            setMissingTotal(0);
            setCutoffAlbums([]);
            setCutoffPage(1);
            setCutoffTotal(0);
            setQueueItems([]);
            setError(null);
        }
    }, [integrationId]);

    const { loading: calendarLoading, isConnected: calendarConnected } = useIntegrationSSE<{
        items: CalendarAlbum[];
        _meta?: unknown;
    }>({
        integrationType: 'lidarr',
        subtype: 'calendar',
        integrationId,
        enabled,
        onData: (data) => {
            if (Date.now() < optimisticUntil.current) return;

            const items = data?.items;
            const allAlbums = Array.isArray(items) ? items : [];

            const seen = new Set<number>();
            const uniqueAlbums = allAlbums.filter(album => {
                if (seen.has(album.id)) return false;
                seen.add(album.id);
                return true;
            });

            setRawUpcoming(uniqueAlbums);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load calendar');
        },
    });

    const upcoming = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();
        const lookAheadMs = lookAheadDays === 'all' ? null : lookAheadDays * 24 * 60 * 60 * 1000;

        return rawUpcoming
            .filter(album => {
                if (!album.releaseDate) return false;
                const releaseMs = new Date(album.releaseDate).getTime();
                if (releaseMs < todayMs) return false;
                if (lookAheadMs === null) return true;
                return releaseMs - todayMs <= lookAheadMs;
            })
            .sort((a, b) => {
                const aMs = new Date(a.releaseDate!).getTime();
                const bMs = new Date(b.releaseDate!).getTime();
                return aMs - bMs;
            });
    }, [rawUpcoming, lookAheadDays]);

    useIntegrationSSE<MissingCounts & { _meta?: unknown }>({
        integrationType: 'lidarr',
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

    useIntegrationSSE<{
        items: Array<{
            id: number;
            albumId?: number;
            status: string;
            trackedDownloadStatus?: string;
            trackedDownloadState?: string;
            progress?: number;
            timeleft?: string;
        }>;
        _meta?: unknown;
    }>({
        integrationType: 'lidarr',
        integrationId,
        enabled,
        onData: (data) => {
            const items = data?.items;
            if (!Array.isArray(items)) return;
            setQueueItems(items.map(q => ({
                id: q.id,
                albumId: q.albumId,
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

    const fetchMissingPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        if (missingLoadingRef.current) return;
        missingLoadingRef.current = true;
        setMissingLoading(true);

        try {
            const data = await api.get<WantedResponse>(
                `/api/integrations/${integrationId}/proxy/missing?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'lidarr' } }
            );

            setMissingAlbums(prev => {
                if (!append) return data.records;
                const existingIds = new Set(prev.map(album => album.id));
                const newRecords = data.records.filter(album => !existingIds.has(album.id));
                return [...prev, ...newRecords];
            });
            setMissingTotal(data.totalRecords);
            setMissingPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load missing albums');
        } finally {
            missingLoadingRef.current = false;
            setMissingLoading(false);
        }
    }, [integrationId]);

    const loadMoreMissing = useCallback(() => {
        fetchMissingPage(missingPage + 1, true);
    }, [fetchMissingPage, missingPage]);

    const refreshMissing = useCallback(() => {
        setMissingPage(1);
        setMissingAlbums([]);
        setMissingTotal(0);
        setTimeout(() => fetchMissingPage(1, false), 0);
    }, [fetchMissingPage]);

    const missingHasMore = missingAlbums.length < missingTotal;

    const hasLoadedMissingOnce = useRef(false);
    useEffect(() => {
        if (missingAlbums.length > 0 || missingTotal > 0) {
            hasLoadedMissingOnce.current = true;
        }
    }, [missingAlbums.length, missingTotal]);

    useEffect(() => {
        if (!integrationId || !enabled) return;
        if (!hasLoadedMissingOnce.current) return;

        const interval = setInterval(() => {
            fetchMissingPage(1, false);
        }, 60_000);

        return () => clearInterval(interval);
    }, [integrationId, enabled, fetchMissingPage]);

    const fetchCutoffPage = useCallback(async (page: number, append: boolean) => {
        if (!integrationId) return;
        if (cutoffLoadingRef.current) return;
        cutoffLoadingRef.current = true;
        setCutoffLoading(true);

        try {
            const data = await api.get<WantedResponse>(
                `/api/integrations/${integrationId}/proxy/cutoff?page=${page}&pageSize=${PAGE_SIZE}`,
                { headers: { 'X-Widget-Type': 'lidarr' } }
            );

            const records = data.records.map(album => ({ ...album, cutoffNotMet: true }));

            setCutoffAlbums(prev => {
                if (!append) return records;
                const existingIds = new Set(prev.map(album => album.id));
                const newRecords = records.filter(album => !existingIds.has(album.id));
                return [...prev, ...newRecords];
            });
            setCutoffTotal(data.totalRecords);
            setCutoffPage(page);
        } catch (err) {
            setError((err as Error).message || 'Failed to load cutoff-unmet albums');
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
        setCutoffAlbums([]);
        setCutoffTotal(0);
        setTimeout(() => fetchCutoffPage(1, false), 0);
    }, [fetchCutoffPage]);

    const cutoffHasMore = cutoffAlbums.length < cutoffTotal;

    const hasLoadedCutoffOnce = useRef(false);
    useEffect(() => {
        if (cutoffAlbums.length > 0 || cutoffTotal > 0) {
            hasLoadedCutoffOnce.current = true;
        }
    }, [cutoffAlbums.length, cutoffTotal]);

    useEffect(() => {
        if (!integrationId || !enabled) return;
        if (!hasLoadedCutoffOnce.current) return;

        const interval = setInterval(() => {
            fetchCutoffPage(1, false);
        }, 60_000);

        return () => clearInterval(interval);
    }, [integrationId, enabled, fetchCutoffPage]);

    const triggerAutoSearch = useCallback(async (albumIds: number[]): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/command`,
                { name: 'AlbumSearch', albumIds },
                { headers: { 'X-Widget-Type': 'lidarr' } }
            );
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    const searchReleases = useCallback(async (albumId: number): Promise<LidarrRelease[]> => {
        if (!integrationId) return [];

        const data = await api.get<LidarrRelease[]>(
            `/api/integrations/${integrationId}/proxy/release?albumId=${albumId}`,
            { headers: { 'X-Widget-Type': 'lidarr' } }
        );
        return data;
    }, [integrationId]);

    const grabRelease = useCallback(async (guid: string, indexerId: number, shouldOverride?: boolean): Promise<boolean> => {
        if (!integrationId) return false;

        try {
            await api.post(
                `/api/integrations/${integrationId}/proxy/release`,
                { guid, indexerId, ...(shouldOverride && { shouldOverride: true }) },
                { headers: { 'X-Widget-Type': 'lidarr' } }
            );
            optimisticUntil.current = Date.now() + 3000;
            return true;
        } catch {
            return false;
        }
    }, [integrationId]);

    return {
        upcoming,
        missingCounts,
        queueItems,
        calendarConnected,
        calendarLoading,
        missingAlbums,
        missingLoading,
        missingHasMore,
        loadMoreMissing,
        refreshMissing,
        cutoffAlbums,
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
