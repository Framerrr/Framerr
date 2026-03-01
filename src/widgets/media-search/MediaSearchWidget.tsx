/**
 * Media Search Widget
 *
 * Search across media libraries with multi-integration support.
 * Shows results grouped by integration instance.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, X, Film, Tv, Loader2, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { SearchDropdown, Button } from '../../shared/ui';
import { WidgetStateMessage } from '../../shared/widgets';
import { useRoleAwareIntegrations } from '../../api/hooks/useIntegrations';
import { useRealtimeSSE } from '../../hooks/useRealtimeSSE';
import { useNotification } from '../../hooks/useNotification';
import { useMediaSearch } from './useMediaSearch';
import { useOverseerrRequest, needsModal, getDefaultServerId } from './hooks/useOverseerrRequest';
import { RequestButton, getInitialRequestState } from './components/RequestButton';
import { RequestModal } from './modals/RequestModal';
import MediaSearchInfoModal from './modals/MediaSearchInfoModal';
import SearchTakeover from './components/SearchTakeover';
import RecommendationRow from './components/RecommendationRow';
import { useRecommendations } from './hooks/useRecommendations';
import type { RecommendationItem } from './hooks/useRecommendations';
import { openMediaInApp } from '../../shared/utils/mediaDeepLinks';
import type { WidgetProps } from '../types';
import type { MediaItem, OverseerrMediaResult, RequestButtonState } from './types';
import './styles.css';

// ============================================================================
// MOCK DATA (for preview mode only)
// ============================================================================
// COMPONENT
// ============================================================================

interface MediaSearchWidgetProps extends WidgetProps {
    // Additional props if needed
}

const MediaSearchWidget: React.FC<MediaSearchWidgetProps> = ({
    widget,
    previewMode = false
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isTakeoverActive, setIsTakeoverActive] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const takeoverInputRef = useRef<HTMLInputElement>(null);

    // Phase 4: Request state
    const [requestModalItem, setRequestModalItem] = useState<OverseerrMediaResult | null>(null);
    const [itemRequestStates, setItemRequestStates] = useState<Map<number, RequestButtonState>>(new Map());
    const { success: toastSuccess, error: toastError } = useNotification();

    // Read takeover config (default: true)
    const isTakeoverEnabled = (widget.config as Record<string, unknown>)?.searchTakeover !== false;

    // Get all integrations to filter out deleted/orphaned IDs
    const { data: allIntegrations } = useRoleAwareIntegrations();
    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    // Extract configured library integrations from widget config
    // Config uses groupKey: libraryIntegrationIds (array) from integrationGroups
    // Backward compat: also check legacy per-type keys (plexIntegrationIds, etc.)
    // Filter out any IDs that no longer exist (deleted integrations)
    const configuredIntegrations = useMemo(() => {
        const config = widget.config as Record<string, unknown> | undefined;
        if (!config) return [];

        const ids: string[] = [];

        // Primary: read from group key (new format)
        const groupIds = config.libraryIntegrationIds;
        if (Array.isArray(groupIds)) {
            ids.push(...groupIds as string[]);
        }

        // Backward compat: check legacy per-type keys if group key is empty
        if (ids.length === 0) {
            for (const type of ['plex', 'jellyfin', 'emby']) {
                const arrayKey = `${type}IntegrationIds`;
                const arrayValue = config[arrayKey];
                if (Array.isArray(arrayValue)) {
                    ids.push(...arrayValue as string[]);
                }

                const singularKey = `${type}IntegrationId`;
                const singularValue = config[singularKey];
                if (typeof singularValue === 'string' && singularValue) {
                    ids.push(singularValue);
                }
            }
        }

        // Filter out deleted/orphaned integration IDs
        if (validIntegrationIds.size > 0) {
            return ids.filter(id => validIntegrationIds.has(id));
        }
        return ids;
    }, [widget.config, validIntegrationIds]);

    // Extract configured Overseerr integration IDs (for request feature)
    const overseerrIntegrationIds = useMemo(() => {
        const config = widget.config as Record<string, unknown> | undefined;
        if (!config) return [];

        const ids: string[] = [];
        const groupIds = config.overseerrIntegrationIds;
        if (Array.isArray(groupIds)) {
            ids.push(...groupIds as string[]);
        }

        if (validIntegrationIds.size > 0) {
            return ids.filter(id => validIntegrationIds.has(id));
        }
        return ids;
    }, [widget.config, validIntegrationIds]);

    // Build integration names map (in real impl would come from integration instances)
    const integrationNames = useMemo(() => {
        const names: Record<string, string> = {};
        for (const id of configuredIntegrations) {
            names[id] = id; // Will be replaced with real names from integration query
        }
        return names;
    }, [configuredIntegrations]);

    // Read hideOverseerrAvailable from config (default: true)
    const hideOverseerrAvailable = (widget.config as Record<string, unknown>)?.hideOverseerrAvailable !== false;

    // Use the media search hook (skip in preview mode)
    const {
        query,
        results,
        isSearching,
        syncStatuses,
        allSyncing,
        anySyncing,
        hasNoSyncedLibrary,
        search,
        clearResults,
        refetchSyncStatuses,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        machineIds,
        serverUrls,
        loadMore,
        isLoadingMore,
        overseerrResults,
        hasOverseerr,
    } = useMediaSearch({
        widgetId: widget.id,
        integrationIds: previewMode ? [] : configuredIntegrations,
        integrationNames,
        overseerrIntegrationIds: previewMode ? [] : overseerrIntegrationIds,
        hideOverseerrAvailable,
    });

    // Recommendations hook — only show recs from integrations that have completed sync
    const syncedIntegrationIds = useMemo(() => {
        if (previewMode) return [];
        return configuredIntegrations.filter(id => {
            const status = syncStatuses[id];
            // Include if: sync completed with items, or no status yet (legacy/non-library)
            return !status || (status.syncStatus !== 'syncing' && status.indexedItems > 0);
        });
    }, [previewMode, configuredIntegrations, syncStatuses]);

    const { items: recommendationItems, source: recommendationSource, isLoading: isRecsLoading } = useRecommendations(
        syncedIntegrationIds
    );

    // Show integration type badge on recommendation cards when 2+ different types are bound
    const hasMultipleIntegrationTypes = useMemo(() => {
        if (!allIntegrations || configuredIntegrations.length < 2) return false;
        const types = new Set<string>();
        for (const id of configuredIntegrations) {
            const integration = allIntegrations.find(i => i.id === id);
            if (integration) types.add(integration.type);
        }
        return types.size >= 2;
    }, [allIntegrations, configuredIntegrations]);

    // Handle recommendation card click → open info modal
    const handleRecommendationClick = useCallback((rec: RecommendationItem) => {
        const item: MediaItem = {
            id: rec.ratingKey,
            externalId: rec.ratingKey,
            title: rec.title,
            year: rec.year ?? undefined,
            mediaType: rec.mediaType,
            posterUrl: rec.thumb ?? undefined,
            summary: rec.summary ?? undefined,
            genres: rec.genres ?? undefined,
            rating: rec.rating ?? undefined,
            tmdbId: rec.tmdbId ?? undefined,
            imdbId: rec.imdbId ?? undefined,
            integrationId: rec.integrationId,
            integrationName: '',
            integrationType: rec.integrationType,
        };
        setSelectedItem(item);
    }, []);

    // Phase 4: Overseerr request hook (uses first configured Overseerr instance)
    const firstOverseerrId = overseerrIntegrationIds[0] || '';
    const {
        servers: overseerrServers,
        fetchServers: fetchOverseerrServers,
        submitRequest: submitOverseerrRequest,
    } = useOverseerrRequest({ overseerrInstanceId: firstOverseerrId });

    // Fetch servers once when we have Overseerr
    useEffect(() => {
        if (firstOverseerrId) fetchOverseerrServers();
    }, [firstOverseerrId, fetchOverseerrServers]);

    // Get or initialize request state for an Overseerr item
    const getItemState = useCallback((item: OverseerrMediaResult): RequestButtonState => {
        return itemRequestStates.get(item.id) ?? getInitialRequestState(item);
    }, [itemRequestStates]);

    // Handle inline request button click
    const handleRequestClick = useCallback(async (item: OverseerrMediaResult) => {
        // Check if we need a modal (TV show or 4K available)
        if (needsModal(item, overseerrServers)) {
            setRequestModalItem(item);
            return;
        }

        // Inline fire for simple cases (movie, single non-4K server)
        setItemRequestStates(prev => new Map(prev).set(item.id, 'loading'));

        try {
            const serverId = getDefaultServerId(item, overseerrServers);
            await submitOverseerrRequest({
                mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                mediaId: item.id,
                serverId,
            });

            setItemRequestStates(prev => new Map(prev).set(item.id, 'success'));
            toastSuccess('Request Sent', `${item.title || item.name || 'Title'} has been requested`);

            // Transition to permanent "requested" after brief success display
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(item.id, 'requested'));
            }, 1500);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Request failed';
            setItemRequestStates(prev => new Map(prev).set(item.id, 'error'));

            // Context-aware toast messages
            if (msg.includes('link your') || msg.includes('403')) {
                toastError('Account Required', 'Link your Overseerr account to make requests');
            } else if (msg.includes('already') || msg.includes('409')) {
                toastError('Already Requested', `${item.title || item.name} has already been requested`);
            } else {
                toastError('Request Failed', msg);
            }

            // Auto-reset to idle after 1s
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(item.id, 'idle'));
            }, 1000);
        }
    }, [overseerrServers, submitOverseerrRequest, toastSuccess, toastError]);

    // Handle modal request completion
    // For TV: success=true means ALL seasons requested, success=false means partial (more to go)
    const handleModalComplete = useCallback((success: boolean) => {
        if (!requestModalItem) return;

        if (success) {
            toastSuccess('Request Sent', `${requestModalItem.title || requestModalItem.name || 'Title'} has been requested`);
            // All done — show success → requested transition on inline button
            setItemRequestStates(prev => new Map(prev).set(requestModalItem.id, 'success'));
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(requestModalItem.id, 'requested'));
            }, 1500);
        }
        // If !success: either error (modal shows inline error) or TV partial (user can request more)
    }, [requestModalItem, toastSuccess]);

    const hasIntegrations = configuredIntegrations.length > 0 || overseerrIntegrationIds.length > 0 || previewMode;

    // Listen for SSE invalidation when sync settings change
    const { onSettingsInvalidate } = useRealtimeSSE();
    useEffect(() => {
        if (previewMode) return;

        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'media-search-sync') {
                // Sync state changed - refetch sync statuses
                refetchSyncStatuses();
                // If user has a query, re-search to show fresh results.
                // Otherwise just clear stale results.
                if (query.trim()) {
                    search(query);
                } else {
                    clearResults();
                }
            }
        });

        return unsubscribe;
    }, [onSettingsInvalidate, refetchSyncStatuses, clearResults, previewMode]);

    // Clear stale results when integration bindings change (e.g. unbinding Plex in config modal)
    const integrationKey = configuredIntegrations.join(',');
    const overseerrKey = overseerrIntegrationIds.join(',');
    const prevIntegrationKeyRef = useRef(integrationKey);
    const prevOverseerrKeyRef = useRef(overseerrKey);
    useEffect(() => {
        if (prevIntegrationKeyRef.current !== integrationKey || prevOverseerrKeyRef.current !== overseerrKey) {
            clearResults();
            prevIntegrationKeyRef.current = integrationKey;
            prevOverseerrKeyRef.current = overseerrKey;
        }
    }, [integrationKey, overseerrKey, clearResults]);

    // Handle query change with debounce (handled by hook)
    const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        search(newQuery);
        setIsDropdownOpen(true);
    }, [search]);

    // Clear search
    const handleClear = useCallback(() => {
        clearResults();
        if (isTakeoverActive) {
            takeoverInputRef.current?.focus();
        } else {
            setIsDropdownOpen(true);
            inputRef.current?.focus();
        }
    }, [clearResults, isTakeoverActive]);

    // Handle result click - open info modal (keep dropdown open)
    const handleItemClick = useCallback((item: MediaItem) => {
        // Add query to recent searches
        if (query.trim()) {
            addRecentSearch(query);
        }
        // Open the media info modal (dropdown stays open)
        setSelectedItem(item);
    }, [query, addRecentSearch]);

    // Handle "Open in X" click — opens new tab, keeps search state intact
    const handleOpenIn = useCallback((item: MediaItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const machineId = machineIds[item.integrationId];
        const serverUrl = serverUrls[item.integrationId];
        openMediaInApp(item.integrationType, item.externalId || '', { machineId, serverUrl });
    }, [machineIds, serverUrls]);

    // Handle recent search click
    const handleRecentClick = useCallback((recentQuery: string) => {
        search(recentQuery);
    }, [search]);

    // Handle input focus
    const handleFocus = useCallback(() => {
        if (isTakeoverEnabled && !previewMode) {
            setIsTakeoverActive(true);
        } else {
            setIsDropdownOpen(true);
        }
    }, [isTakeoverEnabled, previewMode]);

    // Handle closing the takeover
    const handleTakeoverClose = useCallback(() => {
        setIsTakeoverActive(false);
        // Add query to recent searches on close if there was a query
        if (query.trim()) {
            addRecentSearch(query);
        }
    }, [query, addRecentSearch]);

    // Count total results and integrations
    const { integrationCount } = useMemo(() => {
        if (!results) return { totalResults: 0, integrationCount: 0 };

        let total = 0;
        for (const group of Object.values(results)) {
            total += group.items.length;
        }
        return {
            totalResults: total,
            integrationCount: Object.keys(results).length
        };
    }, [results]);

    // Show single integration mode (hide headers if only one integration)
    const showGroupHeaders = integrationCount >= 1;
    const isMultiIntegration = integrationCount > 1;

    // Get visible items (backend handles pagination now)
    const getVisibleItems = (_integrationId: string, items: MediaItem[]) => {
        return items;
    };

    // Handle Load More click - calls hook to fetch more from backend
    const handleLoadMore = (integrationId: string) => {
        loadMore(integrationId);
    };

    // Not configured state
    if (!hasIntegrations && !previewMode) {
        return <WidgetStateMessage variant="notConfigured" message="Select media integrations" />;
    }

    // Get app name for button label
    const getAppName = (type: 'plex' | 'jellyfin' | 'emby') => {
        const names = {
            plex: 'Plex',
            jellyfin: 'Jellyfin',
            emby: 'Emby'
        };
        return names[type];
    };

    // ═══════════════════════════════════════════════════════════════════
    // UNIFIED STATE FLAGS — governs all dropdown visibility and content
    // ═══════════════════════════════════════════════════════════════════
    const hasLibrary = configuredIntegrations.length > 0;
    const hasRecents = recentSearches.length > 0;
    const hasRecommendations = hasLibrary && (recommendationItems.length > 0 || isRecsLoading);
    const hasResults = results && Object.keys(results).length > 0;
    const hasOverseerrResults = overseerrResults && Object.keys(overseerrResults).length > 0;

    // Effective minimum chars: 1 if library configured, 2 if Overseerr-only
    const effectiveMinChars = hasLibrary ? 1 : 2;
    // isQuerySearchable = query meets the minimum for at least one configured search to fire
    const isQuerySearchable = query.length >= effectiveMinChars;
    // Did Overseerr actually participate in this search? (only at 2+ chars with Overseerr configured)
    const overseerrWasSearched = hasOverseerr && query.length >= 2;

    // Dropdown visible ONLY when there is content to show
    // Idle: recs or recents to show | Searching: spinner | Done: results or no-results message
    const hasDropdownContent =
        (!isQuerySearchable && (hasRecents || hasRecommendations)) ||
        (isQuerySearchable); // spinner, results, or "no results" — always something when searchable
    const showDropdown = isDropdownOpen && !previewMode && hasDropdownContent;
    const showTakeoverDropdown = isTakeoverActive && !previewMode && hasDropdownContent;

    // Shared dropdown content (used by both inline and takeover modes)
    const renderDropdownContent = () => (
        <>
            {/* All Syncing Message (library-specific) */}
            {hasLibrary && allSyncing && isQuerySearchable && (
                <div className="flex items-center justify-center gap-2 py-4 px-3 text-sm text-theme-tertiary">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Libraries are syncing...</span>
                </div>
            )}

            {/* Universal Searching Spinner — one spinner, stays until ALL searches done */}
            {isSearching && !allSyncing && (
                <div className="flex items-center justify-center gap-2 py-4 px-3 text-sm text-theme-tertiary">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Searching...</span>
                </div>
            )}

            {/* Recommendations (library-only, idle state) */}
            {!isSearching && !isQuerySearchable && hasRecommendations && !allSyncing && (
                <RecommendationRow
                    items={recommendationItems}
                    source={recommendationSource}
                    isLoading={isRecsLoading}
                    onItemClick={handleRecommendationClick}
                    showTypeBadge={hasMultipleIntegrationTypes}
                />
            )}

            {/* Recent Searches (idle state, widget-level — works for any config) */}
            {!isSearching && !isQuerySearchable && hasRecents && (
                <div>
                    <div className="flex items-center justify-between w-full px-2 py-1">
                        <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-theme-tertiary">
                            <Clock size={12} />
                            <span>Recent Searches</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearRecentSearches();
                            }}
                            className="text-theme-tertiary hover:text-theme-primary text-xs transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    {recentSearches.map(recent => (
                        <button
                            key={recent.id}
                            onClick={() => handleRecentClick(recent.query)}
                            className="media-search-recent-item"
                        >
                            <span>{recent.query}</span>
                            <ChevronRight size={14} className="text-theme-tertiary" />
                        </button>
                    ))}
                </div>
            )}

            {/* No Synced Library (library-specific, idle) */}
            {hasLibrary && !isSearching && !isQuerySearchable && hasNoSyncedLibrary && !allSyncing && (
                <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-theme-secondary">No synced library available.</span>
                        <span className="text-theme-tertiary text-xs">
                            Enable Library Sync in your Plex integration settings, or add a different integration.
                        </span>
                    </div>
                </div>
            )}

            {/* No Synced Library - with query (library-specific) */}
            {hasLibrary && !isSearching && isQuerySearchable && hasNoSyncedLibrary && !allSyncing && (
                <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-theme-secondary">No synced library available.</span>
                        <span className="text-theme-tertiary text-xs">
                            Enable Library Sync in your Plex integration settings, or add a different integration.
                        </span>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* RESULTS — only rendered when ALL searches are done         */}
            {/* ═══════════════════════════════════════════════════════════ */}

            {/* Global "No results" — when nothing found in ANY searched source */}
            {!isSearching && isQuerySearchable && !hasResults && !hasNoSyncedLibrary && !allSyncing &&
                (!overseerrWasSearched || !hasOverseerrResults) && hasLibrary && (
                    <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                        No results for "{query}"
                    </div>
                )}

            {/* Library Results */}
            {hasLibrary && !isSearching && isQuerySearchable && hasResults && Object.entries(results!).map(([integrationId, group]) => {
                const visibleItems = getVisibleItems(integrationId, group.items);

                return (
                    <div key={integrationId} className="media-search-group">
                        {/* Group Header */}
                        {showGroupHeaders && (
                            <div className="media-search-group-header">
                                {group.integrationName}
                                {group.loading && (
                                    <span className="media-search-syncing-badge">
                                        <Loader2 size={10} className="animate-spin" />
                                        Syncing
                                    </span>
                                )}
                                {group.error && (
                                    <span className="media-search-error-badge">
                                        <AlertCircle size={10} />
                                        {group.error}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Items */}
                        {visibleItems.map(item => (
                            <div
                                key={item.id}
                                className="media-search-item"
                                onClick={() => handleItemClick(item)}
                            >
                                {/* Poster */}
                                {item.posterUrl ? (
                                    <img
                                        src={item.posterUrl}
                                        alt={item.title}
                                        className="media-search-poster"
                                        onError={(e) => {
                                            // Hide broken image, show placeholder sibling
                                            e.currentTarget.style.display = 'none';
                                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (placeholder) placeholder.style.display = '';
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="media-search-poster-placeholder"
                                    style={item.posterUrl ? { display: 'none' } : undefined}
                                >
                                    {item.mediaType === 'movie' ? (
                                        <Film size={14} />
                                    ) : (
                                        <Tv size={14} />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="media-search-info">
                                    <div className="media-search-title" title={item.title}>
                                        {item.title}
                                    </div>
                                    <div className="media-search-meta">
                                        {item.year && (
                                            <span className="media-search-year">{item.year}</span>
                                        )}
                                        {item.resolution && (
                                            <span className="media-search-quality">{item.resolution}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Open Button */}
                                <Button
                                    variant="primary"
                                    size="sm"
                                    textSize="sm"
                                    onClick={(e) => handleOpenIn(item, e)}
                                    className="media-search-request-btn"
                                >
                                    Open in {getAppName(item.integrationType)}
                                </Button>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {group.hasMore && (
                            <button
                                onClick={() => handleLoadMore(integrationId)}
                                className="media-search-load-more"
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore ? 'Loading...' : `Load more`}
                            </button>
                        )}
                    </div>
                );
            })}

            {/* Library "no results" with header (only when Overseerr HAS results) */}
            {hasLibrary && !isSearching && isQuerySearchable && !hasResults && !hasNoSyncedLibrary &&
                overseerrWasSearched && hasOverseerrResults && (
                    <div className="media-search-group">
                        {showGroupHeaders && (
                            <div className="media-search-group-header">Library</div>
                        )}
                        <div className="py-3 px-3 text-center text-sm text-theme-tertiary">
                            No library results
                        </div>
                    </div>
                )}

            {/* ═══════════════════════════════════════════ */}
            {/* Overseerr "Request" Section                 */}
            {/* ═══════════════════════════════════════════ */}

            {/* Overseerr Results (only at 2+ chars, only when ALL searches done) */}
            {hasOverseerr && !isSearching && overseerrWasSearched && hasOverseerrResults && (
                <div className="media-search-overseerr-section">
                    <div className="media-search-section-header">
                        <Search size={12} />
                        <span>Request</span>
                    </div>
                    {Object.values(overseerrResults!).map(group => (
                        group.error ? (
                            <div key={group.integrationId} className="px-3 py-2 text-xs text-theme-tertiary">
                                <AlertCircle size={12} className="inline mr-1" />
                                {group.error}
                            </div>
                        ) : (
                            group.items.map(item => {
                                const title = item.title || item.name || 'Unknown';
                                const year = (item.releaseDate || item.firstAirDate || '').slice(0, 4);
                                const posterUrl = item.posterPath
                                    ? `https://image.tmdb.org/t/p/w92${item.posterPath}`
                                    : undefined;
                                const mediaLabel = item.mediaType === 'movie' ? 'Movie' : 'TV';
                                const status = item.mediaInfo?.status;
                                const { requestedSeasonCount, totalSeasonCount } = item.mediaInfo ?? {};
                                // TV shows: show badge only for partial requests (not all seasons covered)
                                const isTvPartial = item.mediaType === 'tv' && status !== undefined && status >= 2 && status < 5
                                    && (requestedSeasonCount === undefined || totalSeasonCount === undefined || requestedSeasonCount < totalSeasonCount);
                                // Status 4 = Partially Available (some downloaded), 2/3 = Partially Requested
                                const partialBadgeText = status === 4 ? 'Partially Available' : 'Partially Requested';

                                return (
                                    <div
                                        key={`${group.integrationId}-${item.id}`}
                                        className="media-search-item media-search-overseerr-item"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setRequestModalItem(item)}
                                    >
                                        {/* Poster */}
                                        {posterUrl ? (
                                            <img
                                                src={posterUrl}
                                                alt={title}
                                                className="media-search-poster"
                                            />
                                        ) : (
                                            <div className="media-search-poster-placeholder">
                                                {item.mediaType === 'movie' ? (
                                                    <Film size={14} />
                                                ) : (
                                                    <Tv size={14} />
                                                )}
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="media-search-info">
                                            <div className="media-search-title" title={title}>
                                                {title}
                                            </div>
                                            <div className="media-search-meta">
                                                {year && (
                                                    <span className="media-search-year">{year}</span>
                                                )}
                                                <span className="media-search-type-badge">{mediaLabel}</span>
                                                {item.voteAverage !== undefined && item.voteAverage > 0 && (
                                                    <span className="media-search-rating">★ {item.voteAverage.toFixed(1)}</span>
                                                )}
                                                {isTvPartial && (
                                                    <span style={{
                                                        fontSize: '0.5625rem',
                                                        fontWeight: 500,
                                                        padding: '0.0625rem 0.25rem',
                                                        borderRadius: '0.1875rem',
                                                        background: 'var(--warning-glass, rgba(234, 179, 8, 0.15))',
                                                        color: 'var(--warning)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {partialBadgeText}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Request Button (Phase 4) */}
                                        <RequestButton
                                            state={getItemState(item)}
                                            onClick={() => handleRequestClick(item)}
                                        />
                                    </div>
                                );
                            })
                        )
                    ))}
                </div>
            )}

            {/* Overseerr "no results" with Request header */}
            {/* Shows when: Overseerr-only and no results, OR both configs and library has results but Overseerr doesn't */}
            {hasOverseerr && !isSearching && overseerrWasSearched && !hasOverseerrResults &&
                (hasResults || !hasLibrary) && (
                    <div className="media-search-overseerr-section">
                        <div className="media-search-section-header">
                            <Search size={12} />
                            <span>Request</span>
                        </div>
                        <div className="py-3 px-3 text-center text-sm text-theme-tertiary">
                            No request results
                        </div>
                    </div>
                )}

            {/* Request Modal */}
            {requestModalItem && firstOverseerrId && (
                <RequestModal
                    item={requestModalItem}
                    overseerrInstanceId={firstOverseerrId}
                    onClose={() => setRequestModalItem(null)}
                    onRequestComplete={handleModalComplete}
                    zIndex={250}
                    itemState={itemRequestStates.get(requestModalItem.id) || getInitialRequestState(requestModalItem)}
                />
            )}
        </>
    );

    return (
        <div className="media-search-widget">
            {/* Takeover Mode: search bar in widget is just a trigger */}
            {isTakeoverEnabled && !previewMode ? (
                <LayoutGroup>
                    {/* In-widget trigger bar — animates to takeover via layoutId */}
                    <div className="search-dropdown-anchor">
                        {!isTakeoverActive ? (
                            <motion.div
                                layoutId={`search-bar-${widget.id}`}
                                className="media-search-input-container media-search-input-container--trigger"
                                onClick={handleFocus}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                style={{ borderRadius: '1rem' }}
                            >
                                <Search size={14} className="media-search-icon" />
                                <div className="media-search-input media-search-input--placeholder">
                                    {query || 'Search movies, shows, actors...'}
                                </div>
                            </motion.div>
                        ) : (
                            /* Invisible spacer holds layout space while bar is in the portal */
                            <div className="media-search-input-container media-search-input-container--spacer" />
                        )}
                    </div>

                    {/* Takeover portal */}
                    <SearchTakeover
                        isActive={isTakeoverActive}
                        onClose={handleTakeoverClose}
                        query={query}
                        onQueryChange={handleQueryChange}
                        onClear={handleClear}
                        inputRef={takeoverInputRef}
                        previewMode={previewMode}
                        layoutId={`search-bar-${widget.id}`}
                    >
                        {showTakeoverDropdown && renderDropdownContent()}
                    </SearchTakeover>
                </LayoutGroup>
            ) : (
                /* Inline Mode: current SearchDropdown behavior */
                <SearchDropdown
                    open={showDropdown}
                    onOpenChange={setIsDropdownOpen}
                    maxWidth={850}
                    ignoreCloseSelectors={[
                        '.media-search-input-container',
                        '.media-search-clear',
                        '[data-radix-dialog-overlay]',
                        '[data-radix-dialog-content]'
                    ]}
                    closeOnScroll={false}
                    anchor={
                        <div className="media-search-input-container">
                            <Search size={14} className="media-search-icon" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="media-search-input"
                                placeholder="Search movies, shows, actors..."
                                value={query}
                                onChange={handleQueryChange}
                                onFocus={(e) => { handleFocus(); e.target.select(); }}
                                disabled={previewMode}
                            />
                            {query && (
                                <button
                                    className="media-search-clear"
                                    onClick={handleClear}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    title="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    }
                >
                    <SearchDropdown.Content className="media-search-dropdown" maxWidth={850} maxHeight={400}>
                        {renderDropdownContent()}
                    </SearchDropdown.Content>
                </SearchDropdown>
            )}

            {/* Media Info Modal */}
            {selectedItem && (
                <MediaSearchInfoModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onOpenInApp={(item) => {
                        handleOpenIn(item, { stopPropagation: () => { } } as React.MouseEvent);
                    }}
                    zIndex={isTakeoverActive ? 250 : undefined}
                />
            )}
        </div>
    );
};

export default MediaSearchWidget;
