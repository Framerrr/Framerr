/**
 * useOverseerrRequest Hook
 * 
 * Centralizes Overseerr request logic:
 * - Server/profile fetching (Radarr/Sonarr instances, 4K detection)
 * - TV show season list fetching
 * - Request submission (POST to proxy)
 * - Request state management (loading, success, error, auto-reset)
 */

import { useState, useCallback, useRef } from 'react';
import { widgetFetch } from '../../../utils/widgetFetch';
import logger from '../../../utils/logger';
import type { OverseerrMediaResult, RequestButtonState } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface OverseerrServer {
    id: number;
    name: string;
    is4k: boolean;
    isDefault: boolean;
}

export interface OverseerrServers {
    radarr: OverseerrServer[];
    sonarr: OverseerrServer[];
}

export interface TvSeason {
    seasonNumber: number;
    name: string;
    episodeCount: number;
    /** Overseerr request status: 2=Pending, 3=Processing, 4=Partial, 5=Available */
    status?: number;
}

interface RequestPayload {
    mediaType: 'movie' | 'tv';
    mediaId: number;  // TMDB ID
    seasons?: number[];
    serverId?: number;
    is4k?: boolean;
}

interface UseOverseerrRequestOptions {
    overseerrInstanceId: string;
}

interface UseOverseerrRequestReturn {
    // Server data
    servers: OverseerrServers | null;
    fetchServers: () => Promise<OverseerrServers | null>;
    serversLoading: boolean;

    // TV details
    tvSeasons: TvSeason[];
    fetchTvDetails: (tmdbId: number) => Promise<TvSeason[]>;
    refetchTvDetails: (tmdbId: number) => Promise<TvSeason[]>;
    tvLoading: boolean;
    /** Season numbers that are already requested/available (status 2-5) */
    requestedSeasonNumbers: number[];

    // Request submission
    submitRequest: (payload: RequestPayload) => Promise<boolean>;
    requestState: RequestButtonState;
    resetRequestState: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOverseerrRequest({
    overseerrInstanceId,
}: UseOverseerrRequestOptions): UseOverseerrRequestReturn {
    // Server state (cached per instance)
    const [servers, setServers] = useState<OverseerrServers | null>(null);
    const [serversLoading, setServersLoading] = useState(false);
    const serversCache = useRef<Record<string, OverseerrServers>>({});

    // TV state
    const [tvSeasons, setTvSeasons] = useState<TvSeason[]>([]);
    const [tvLoading, setTvLoading] = useState(false);

    // Request state
    const [requestState, setRequestState] = useState<RequestButtonState>('idle');
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



    // ── Fetch Servers ──
    const fetchServers = useCallback(async (): Promise<OverseerrServers | null> => {
        // Return cached if available
        if (serversCache.current[overseerrInstanceId]) {
            const cached = serversCache.current[overseerrInstanceId];
            setServers(cached);
            return cached;
        }

        setServersLoading(true);
        try {
            const response = await widgetFetch(
                `/api/integrations/${overseerrInstanceId}/proxy/servers`,
                'media-search'
            );

            if (!response.ok) throw new Error('Failed to fetch servers');

            const data = await response.json() as OverseerrServers;
            serversCache.current[overseerrInstanceId] = data;
            setServers(data);
            return data;
        } catch (error) {
            logger.error('[useOverseerrRequest] fetchServers failed:', error);
            return null;
        } finally {
            setServersLoading(false);
        }
    }, [overseerrInstanceId]);

    // ── Fetch TV Details (Seasons) with per-season status ──
    const tvCache = useRef<Record<number, TvSeason[]>>({});

    const parseTvResponse = useCallback((data: any): TvSeason[] => {
        // Build a map of season status from Overseerr mediaInfo
        // Overseerr puts per-season status in TWO places:
        //   1. mediaInfo.seasons[] — availability tracking (may be empty)
        //   2. mediaInfo.requests[].seasons[] — request tracking (per-request)
        const seasonStatusMap = new Map<number, number>();

        // Source 1: mediaInfo.seasons (direct availability)
        if (data.mediaInfo?.seasons) {
            for (const s of data.mediaInfo.seasons as Array<{ seasonNumber: number; status: number }>) {
                if (s.status >= 2) seasonStatusMap.set(s.seasonNumber, s.status);
            }
        }

        // Source 2: mediaInfo.requests[].seasons (request tracking — primary source)
        if (data.mediaInfo?.requests) {
            for (const req of data.mediaInfo.requests as Array<{ seasons?: Array<{ seasonNumber: number; status: number }> }>) {
                if (req.seasons) {
                    for (const s of req.seasons) {
                        // Use highest status (5=available > 2=pending)
                        const current = seasonStatusMap.get(s.seasonNumber) ?? 0;
                        if (s.status > current) seasonStatusMap.set(s.seasonNumber, s.status);
                    }
                }
            }
        }

        return (data.seasons || [])
            .filter((s: any) => s.seasonNumber > 0) // Exclude specials (season 0)
            .map((s: any) => ({
                seasonNumber: s.seasonNumber,
                name: s.name || `Season ${s.seasonNumber}`,
                episodeCount: s.episodeCount || 0,
                status: seasonStatusMap.get(s.seasonNumber),
            }));
    }, []);

    const fetchTvDetails = useCallback(async (tmdbId: number): Promise<TvSeason[]> => {
        // Return cached if available
        if (tvCache.current[tmdbId]) {
            const cached = tvCache.current[tmdbId];
            setTvSeasons(cached);
            return cached;
        }

        setTvLoading(true);
        try {
            const response = await widgetFetch(
                `/api/integrations/${overseerrInstanceId}/proxy/tv/${tmdbId}`,
                'media-search'
            );

            if (!response.ok) throw new Error('Failed to fetch TV details');

            const data = await response.json();
            const seasons = parseTvResponse(data);

            tvCache.current[tmdbId] = seasons;
            setTvSeasons(seasons);
            return seasons;
        } catch (error) {
            logger.error('[useOverseerrRequest] fetchTvDetails failed:', error);
            setTvSeasons([]);
            return [];
        } finally {
            setTvLoading(false);
        }
    }, [overseerrInstanceId, parseTvResponse]);

    // Refetch bypasses cache — used after a request to get updated per-season status
    const refetchTvDetails = useCallback(async (tmdbId: number): Promise<TvSeason[]> => {
        delete tvCache.current[tmdbId];
        return fetchTvDetails(tmdbId);
    }, [fetchTvDetails]);

    // Derived: season numbers that are already requested/processing/available (status 2-5)
    const requestedSeasonNumbers = tvSeasons
        .filter(s => s.status !== undefined && s.status >= 2)
        .map(s => s.seasonNumber);

    // ── Submit Request ──
    const submitRequest = useCallback(async (payload: RequestPayload): Promise<boolean> => {
        // Clear any existing reset timer
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }

        setRequestState('loading');

        try {
            const response = await widgetFetch(
                `/api/integrations/${overseerrInstanceId}/proxy/request`,
                'media-search',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
                throw new Error(errorData.error || `Request failed (${response.status})`);
            }

            // Success
            setRequestState('success');

            // Transition to permanent "requested" after brief success display
            resetTimerRef.current = setTimeout(() => {
                setRequestState('requested');
            }, 1500);

            return true;
        } catch (error) {
            logger.error('[useOverseerrRequest] submitRequest failed:', error);

            setRequestState('error');

            // Auto-reset to idle after 1s
            resetTimerRef.current = setTimeout(() => {
                setRequestState('idle');
            }, 1000);

            // Re-throw so caller can handle toast messaging
            throw error;
        }
    }, [overseerrInstanceId]);

    // ── Reset ──
    const resetRequestState = useCallback(() => {
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
        setRequestState('idle');
    }, []);

    return {
        servers,
        fetchServers,
        serversLoading,
        tvSeasons,
        fetchTvDetails,
        refetchTvDetails,
        tvLoading,
        requestedSeasonNumbers,
        submitRequest,
        requestState,
        resetRequestState,
    };
}

// ============================================================================
// HELPER: Determine if modal is needed or if inline fire is sufficient
// ============================================================================

export function needsModal(
    item: OverseerrMediaResult,
    servers: OverseerrServers | null
): boolean {
    if (!servers) return false;

    // TV always needs modal (season picker)
    if (item.mediaType === 'tv') return true;

    // Movie with multiple Radarr instances needs modal (server picker)
    if (servers.radarr.length > 1) return true;

    return false;
}

/**
 * Get the default server ID for an inline (no-modal) request.
 * For movies with a single non-4K Radarr instance.
 */
export function getDefaultServerId(
    item: OverseerrMediaResult,
    servers: OverseerrServers | null
): number | undefined {
    if (!servers) return undefined;

    if (item.mediaType === 'movie') {
        const nonFourK = servers.radarr.filter(s => !s.is4k);
        if (nonFourK.length === 1) return nonFourK[0].id;
        const defaultServer = servers.radarr.find(s => s.isDefault && !s.is4k);
        return defaultServer?.id;
    }

    return undefined;
}
