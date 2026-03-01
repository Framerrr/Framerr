/**
 * useMediaSearch Hook
 * 
 * Search media across configured integrations using the local library index.
 * Handles sync status, loading states, and per-integration results.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { widgetFetch } from '../../utils/widgetFetch';
import { useMediaServerMeta } from '../../shared/hooks/useMediaServerMeta';
import logger from '../../utils/logger';
import type { MediaItem, SearchResults, OverseerrMediaResult, OverseerrSearchResults } from './types';


// ============================================================================
// TYPES (API Response)
// ============================================================================

interface ApiMediaItem {
    id: number;
    integrationId: string;
    mediaType: string;
    itemKey: string;
    title: string;
    originalTitle: string | null;
    year: number | null;
    thumb: string | null;
    summary: string | null;
    genres: string[] | null;
    director: string | null;
    actors: string[] | null;
    rating: number | null;
    tmdbId: number | null;
    imdbId: string | null;
}

interface ApiSearchResult {
    integrationId: string;
    status: 'ready' | 'syncing' | 'error';
    progress?: { indexed: number; total: number };
    items?: ApiMediaItem[];
    error?: string;
    displayName?: string;
    integrationType?: string;
    totalMatches?: number;
    hasMore?: boolean;
}

interface ApiSearchResponse {
    results: Record<string, ApiSearchResult>;
}

interface SyncStatus {
    integrationInstanceId: string;
    totalItems: number;
    indexedItems: number;
    lastSyncStarted: string | null;
    lastSyncCompleted: string | null;
    syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
    errorMessage: string | null;
}

// ============================================================================
// RECENT SEARCHES
// ============================================================================

export interface RecentSearch {
    id: number | string;
    query: string;
    timestamp: number;
}

// ============================================================================
// HOOK
// ============================================================================

interface UseMediaSearchOptions {
    widgetId: string;
    integrationIds: string[];
    integrationNames: Record<string, string>;
    overseerrIntegrationIds?: string[];
    hideOverseerrAvailable?: boolean;
    onItemClick?: (item: MediaItem) => void;
}

interface UseMediaSearchReturn {
    query: string;
    setQuery: (query: string) => void;
    results: SearchResults | null;
    isSearching: boolean;
    syncStatuses: Record<string, SyncStatus>;
    allSyncing: boolean;
    anySyncing: boolean;
    hasNoSyncedLibrary: boolean;
    search: (query: string) => void;
    clearResults: () => void;
    refetchSyncStatuses: () => Promise<void>;
    // Recent searches
    recentSearches: RecentSearch[];
    addRecentSearch: (query: string) => void;
    clearRecentSearches: () => void;
    // Open in app
    machineIds: Record<string, string>;
    serverUrls: Record<string, string>;
    // Pagination
    loadMore: (integrationId: string) => void;
    isLoadingMore: boolean;
    // Overseerr search
    overseerrResults: OverseerrSearchResults | null;
    isOverseerrSearching: boolean;
    hasOverseerr: boolean;
}

export function useMediaSearch({
    widgetId,
    integrationIds,
    integrationNames,
    overseerrIntegrationIds = [],
    hideOverseerrAvailable = true,
}: UseMediaSearchOptions): UseMediaSearchReturn {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({});
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    // Track offsets for pagination
    const [offsets, setOffsets] = useState<Record<string, number>>({});

    // Shared hook for machineId (Plex) and serverUrl (Jellyfin/Emby)
    const { machineIds, serverUrls } = useMediaServerMeta(integrationIds, 'media-search');

    // Overseerr search state
    const [overseerrResults, setOverseerrResults] = useState<OverseerrSearchResults | null>(null);
    const [isOverseerrSearching, setIsOverseerrSearching] = useState(false);
    const overseerrAbortRef = useRef<AbortController | null>(null);
    const hasOverseerr = overseerrIntegrationIds.length > 0;

    // Pending search counter — isSearching stays true until ALL active searches complete
    const pendingSearchCountRef = useRef(0);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);



    // Fetch search history from API on mount
    useEffect(() => {
        if (!widgetId) return;

        const fetchHistory = async () => {
            try {
                const response = await widgetFetch(`/api/media/search-history/${widgetId}`, 'media-search');
                if (response.ok) {
                    const data = await response.json() as { history: RecentSearch[] };
                    setRecentSearches(data.history);
                }
            } catch {
                // Ignore errors - just means no history
            }
        };

        fetchHistory();
    }, [widgetId]);

    // Add a search to recent searches via API
    const addRecentSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || !widgetId) return;

        try {
            const response = await widgetFetch(`/api/media/search-history/${widgetId}`, 'media-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery.trim() })
            });

            if (response.ok) {
                // Refetch full history to get accurate state
                const historyResponse = await widgetFetch(`/api/media/search-history/${widgetId}`, 'media-search');
                if (historyResponse.ok) {
                    const data = await historyResponse.json() as { history: RecentSearch[] };
                    setRecentSearches(data.history);
                }
            }
        } catch {
            // Ignore errors
        }
    }, [widgetId]);

    // Clear all recent searches via API
    const clearRecentSearches = useCallback(async () => {
        if (!widgetId) return;

        try {
            await widgetFetch(`/api/media/search-history/${widgetId}`, 'media-search', {
                method: 'DELETE'
            });
            setRecentSearches([]);
        } catch {
            // Ignore errors
        }
    }, [widgetId]);

    // Calculate sync state flags
    const { allSyncing, anySyncing, hasNoSyncedLibrary } = useMemo(() => {
        const statuses = Object.values(syncStatuses);
        if (statuses.length === 0) return { allSyncing: false, anySyncing: false, hasNoSyncedLibrary: false };

        const syncingCount = statuses.filter(s => s.syncStatus === 'syncing').length;
        const totalIndexed = statuses.reduce((sum, s) => sum + s.indexedItems, 0);

        // hasNoSyncedLibrary is TRUE when:
        // - We have statuses loaded (statuses.length > 0)
        // - No integrations are currently syncing
        // - Total indexed items across all integrations is 0
        const noSyncedLibrary = statuses.length > 0 &&
            syncingCount === 0 &&
            totalIndexed === 0;

        return {
            allSyncing: syncingCount === integrationIds.length && integrationIds.length > 0,
            anySyncing: syncingCount > 0,
            hasNoSyncedLibrary: noSyncedLibrary
        };
    }, [syncStatuses, integrationIds.length]);

    // Fetch sync status for all integrations
    const fetchSyncStatuses = useCallback(async () => {
        const statuses: Record<string, SyncStatus> = {};

        for (const id of integrationIds) {
            try {
                const response = await widgetFetch(`/api/media/sync/status/${id}`, 'media-search');
                if (response.ok) {
                    statuses[id] = await response.json() as SyncStatus;
                } else {
                    statuses[id] = {
                        integrationInstanceId: id,
                        totalItems: 0,
                        indexedItems: 0,
                        lastSyncStarted: null,
                        lastSyncCompleted: null,
                        syncStatus: 'idle',
                        errorMessage: null
                    };
                }
            } catch {
                statuses[id] = {
                    integrationInstanceId: id,
                    totalItems: 0,
                    indexedItems: 0,
                    lastSyncStarted: null,
                    lastSyncCompleted: null,
                    syncStatus: 'idle',
                    errorMessage: null
                };
            }
        }

        setSyncStatuses(statuses);
    }, [integrationIds]);

    // Perform library search
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 1 || integrationIds.length === 0) {
            setResults(null);
            // Decrement pending count instead of directly clearing
            pendingSearchCountRef.current = Math.max(0, pendingSearchCountRef.current - 1);
            if (pendingSearchCountRef.current === 0) {
                setIsSearching(false);
            }
            return;
        }

        try {
            // Reset offsets for new search
            setOffsets({});

            const params = new URLSearchParams({
                q: searchQuery,
                integrations: integrationIds.join(',')
            });

            const response = await widgetFetch(`/api/media/search?${params}`, 'media-search');

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json() as ApiSearchResponse;

            // Convert API response to widget format
            const formattedResults: SearchResults = {};

            for (const [integrationId, result] of Object.entries(data.results)) {
                // Use actual values from backend response
                const displayName = result.displayName || integrationId;
                const integrationType = (result.integrationType || 'plex') as 'plex' | 'jellyfin' | 'emby';

                if (result.status === 'syncing') {
                    formattedResults[integrationId] = {
                        integrationName: displayName,
                        integrationType,
                        items: [],
                        loading: true
                    };
                } else if (result.status === 'error') {
                    formattedResults[integrationId] = {
                        integrationName: displayName,
                        integrationType,
                        items: [],
                        error: result.error
                    };
                } else if (result.items && result.items.length > 0) {
                    formattedResults[integrationId] = {
                        integrationName: displayName,
                        integrationType,
                        items: result.items.map((apiItem: ApiMediaItem): MediaItem => ({
                            id: String(apiItem.id),
                            externalId: apiItem.itemKey,
                            title: apiItem.title,
                            year: apiItem.year ?? undefined,
                            mediaType: apiItem.mediaType as 'movie' | 'show',
                            posterUrl: apiItem.thumb ?? undefined,
                            summary: apiItem.summary ?? undefined,
                            rating: apiItem.rating ?? undefined,
                            genres: apiItem.genres ?? undefined,
                            actors: apiItem.actors ?? undefined,
                            integrationId,
                            integrationName: displayName,
                            integrationType,
                            tmdbId: apiItem.tmdbId ?? undefined,
                            imdbId: apiItem.imdbId ?? undefined,
                        })),
                        totalMatches: result.totalMatches,
                        hasMore: result.hasMore
                    };
                }
            }

            setResults(Object.keys(formattedResults).length > 0 ? formattedResults : null);
        } catch (error) {
            logger.error('[useMediaSearch] Search failed:', error);
            setResults(null);
        } finally {
            // Decrement pending count; only clear isSearching when all searches done
            pendingSearchCountRef.current = Math.max(0, pendingSearchCountRef.current - 1);
            if (pendingSearchCountRef.current === 0) {
                setIsSearching(false);
            }
        }
    }, [integrationIds, integrationNames]);

    // Perform Overseerr search (parallel with library search)
    const performOverseerrSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2 || overseerrIntegrationIds.length === 0) {
            setOverseerrResults(null);
            setIsOverseerrSearching(false);
            // Decrement pending count instead of directly clearing
            pendingSearchCountRef.current = Math.max(0, pendingSearchCountRef.current - 1);
            if (pendingSearchCountRef.current === 0) {
                setIsSearching(false);
            }
            return;
        }

        // Abort any in-flight Overseerr request
        if (overseerrAbortRef.current) {
            overseerrAbortRef.current.abort();
        }
        const abortController = new AbortController();
        overseerrAbortRef.current = abortController;

        setIsOverseerrSearching(true);

        try {
            const allResults: OverseerrSearchResults = {};

            // Search all Overseerr instances in parallel
            await Promise.all(overseerrIntegrationIds.map(async (instanceId) => {
                try {
                    const params = new URLSearchParams({
                        query: searchQuery,
                        page: '1',
                    });

                    const fetchOnce = async (): Promise<Response> =>
                        widgetFetch(
                            `/api/integrations/${instanceId}/proxy/search?${params}`,
                            'media-search',
                            { signal: abortController.signal }
                        );

                    let response = await fetchOnce();

                    // Retry once on 429 (Too Many Requests) with backoff
                    if (response.status === 429) {
                        const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
                        const delayMs = Math.min(retryAfter, 10) * 1000; // Cap at 10s
                        logger.debug(`[useMediaSearch] Overseerr 429 — retrying in ${delayMs}ms`);
                        await new Promise(r => setTimeout(r, delayMs));
                        if (abortController.signal.aborted) return;
                        response = await fetchOnce();
                    }

                    if (!response.ok) {
                        const errorBody = await response.json().catch(() => ({})) as { error?: string };
                        throw new Error(`HTTP ${response.status}: ${errorBody.error || response.statusText}`);
                    }

                    const data = await response.json() as {
                        results: OverseerrMediaResult[];
                        pageInfo?: { pages: number; page: number; results: number };
                    };

                    // Filter results based on hideOverseerrAvailable setting
                    let filteredItems = data.results || [];
                    if (hideOverseerrAvailable) {
                        // Hide fully available titles (status 5)
                        filteredItems = filteredItems.filter(
                            item => !item.mediaInfo || item.mediaInfo.status !== 5
                        );
                    }

                    // Only add group if there are results after filtering
                    if (filteredItems.length > 0) {
                        allResults[instanceId] = {
                            integrationId: instanceId,
                            integrationName: instanceId, // Will be resolved by widget
                            items: filteredItems,
                            loading: false,
                        };
                    }
                } catch (err) {
                    if ((err as Error).name === 'AbortError') return; // Expected on new search
                    allResults[instanceId] = {
                        integrationId: instanceId,
                        integrationName: instanceId,
                        items: [],
                        loading: false,
                        error: 'Overseerr search failed',
                    };
                }
            }));

            // Only update if not aborted
            if (!abortController.signal.aborted) {
                setOverseerrResults(
                    Object.keys(allResults).length > 0 ? allResults : null
                );
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                logger.error('[useMediaSearch] Overseerr search failed:', error);
                setOverseerrResults(null);
            }
        } finally {
            if (!abortController.signal.aborted) {
                setIsOverseerrSearching(false);
                // Decrement pending count; only clear isSearching when all searches done
                pendingSearchCountRef.current = Math.max(0, pendingSearchCountRef.current - 1);
                if (pendingSearchCountRef.current === 0) {
                    setIsSearching(false);
                }
            }
        }
    }, [overseerrIntegrationIds, hideOverseerrAvailable]);

    // Debounced search trigger
    const search = useCallback((newQuery: string) => {
        setQuery(newQuery);

        // Clear debounce timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // If query is empty, clear ALL results immediately
        if (!newQuery.trim()) {
            setIsSearching(false);
            setResults(null);
            setOverseerrResults(null);
            setIsOverseerrSearching(false);
            pendingSearchCountRef.current = 0;
            // Abort any in-flight Overseerr request
            if (overseerrAbortRef.current) {
                overseerrAbortRef.current.abort();
                overseerrAbortRef.current = null;
            }
            return;
        }

        // Determine which searches will fire for this query length
        const willSearchLibrary = integrationIds.length > 0 && newQuery.length >= 1;
        const willSearchOverseerr = hasOverseerr && newQuery.length >= 2;

        if (!willSearchLibrary && !willSearchOverseerr) {
            // No search will fire — don't show searching state
            return;
        }

        // Clear overseerr results if overseerr won't search this time
        // (e.g. user backspaced from 2 chars to 1 char)
        if (!willSearchOverseerr) {
            setOverseerrResults(null);
            setIsOverseerrSearching(false);
        }

        // Count pending searches and set universal searching flag
        let count = 0;
        if (willSearchLibrary) count++;
        if (willSearchOverseerr) count++;
        pendingSearchCountRef.current = count;
        setIsSearching(true);

        debounceRef.current = setTimeout(() => {
            if (willSearchLibrary) {
                performSearch(newQuery);
            }
            if (willSearchOverseerr) {
                performOverseerrSearch(newQuery);
            }
        }, 300);
    }, [performSearch, performOverseerrSearch, hasOverseerr, integrationIds]);

    // Clear results
    const clearResults = useCallback(() => {
        setQuery('');
        setResults(null);
        setOverseerrResults(null);
        setIsSearching(false);
        setIsOverseerrSearching(false);
        setOffsets({});
        pendingSearchCountRef.current = 0;
        // Abort any in-flight Overseerr request
        if (overseerrAbortRef.current) {
            overseerrAbortRef.current.abort();
            overseerrAbortRef.current = null;
        }
    }, []);

    // Load more results for a specific integration
    const loadMore = useCallback(async (integrationId: string) => {
        if (!query || !results || !results[integrationId]) return;

        const currentData = results[integrationId];
        if (!currentData.hasMore) return;

        setIsLoadingMore(true);

        try {
            // Calculate new offset (current items count)
            const newOffset = currentData.items.length;
            const newOffsets = { ...offsets, [integrationId]: newOffset };

            const params = new URLSearchParams({
                q: query,
                integrations: integrationId,  // Only fetch for this integration
                offsets: JSON.stringify({ [integrationId]: newOffset })
            });

            const response = await widgetFetch(`/api/media/search?${params}`, 'media-search');
            if (!response.ok) throw new Error('Load more failed');

            const data = await response.json() as ApiSearchResponse;
            const result = data.results[integrationId];

            if (result?.status === 'ready' && result.items && result.items.length > 0) {
                const displayName = result.displayName || integrationId;
                const integrationType = (result.integrationType || 'plex') as 'plex' | 'jellyfin' | 'emby';

                const newItems: MediaItem[] = result.items.map((apiItem: ApiMediaItem): MediaItem => ({
                    id: String(apiItem.id),
                    externalId: apiItem.itemKey,
                    title: apiItem.title,
                    year: apiItem.year ?? undefined,
                    mediaType: apiItem.mediaType as 'movie' | 'show',
                    posterUrl: apiItem.thumb ?? undefined,
                    summary: apiItem.summary ?? undefined,
                    rating: apiItem.rating ?? undefined,
                    genres: apiItem.genres ?? undefined,
                    actors: apiItem.actors ?? undefined,
                    integrationId,
                    integrationName: displayName,
                    integrationType,
                    tmdbId: apiItem.tmdbId ?? undefined,
                    imdbId: apiItem.imdbId ?? undefined,
                }));

                // Merge new items with existing
                setResults(prev => prev ? {
                    ...prev,
                    [integrationId]: {
                        ...prev[integrationId],
                        items: [...prev[integrationId].items, ...newItems],
                        hasMore: result.hasMore,
                        totalMatches: result.totalMatches
                    }
                } : null);

                setOffsets(newOffsets);
            }
        } catch (error) {
            logger.error('[useMediaSearch] Load more failed:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [query, results, offsets]);

    // Fetch sync statuses on mount / integration change
    useEffect(() => {
        if (integrationIds.length > 0) {
            fetchSyncStatuses();
        }
    }, [integrationIds.join(','), fetchSyncStatuses]);

    return {
        query,
        setQuery,
        results,
        isSearching,
        syncStatuses,
        allSyncing,
        anySyncing,
        hasNoSyncedLibrary,
        search,
        clearResults,
        // Expose refetch for SSE invalidation from widget
        refetchSyncStatuses: fetchSyncStatuses,
        // Recent searches
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        // Machine IDs for Open in App (Plex)
        machineIds,
        // Server URLs for Open in App (Jellyfin/Emby)
        serverUrls,
        // Pagination
        loadMore,
        isLoadingMore,
        // Overseerr search
        overseerrResults,
        isOverseerrSearching,
        hasOverseerr,
    };
}
