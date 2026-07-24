/**
 * Media Search Widget
 *
 * Search across media libraries with multi-integration support.
 * Shows results grouped by integration instance.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { SearchDropdown } from '../../shared/ui';
import { WidgetStateMessage } from '../../shared/widgets';
import { useRoleAwareIntegrations } from '../../api/hooks/useIntegrations';
import { useRealtimeSSE } from '@/features/realtime/useRealtimeSSE';
import { useMediaSearch } from './useMediaSearch';
import { useMediaSearchConfig } from './hooks/useMediaSearchConfig';
import { useRequestFlow } from './hooks/useRequestFlow';
import MediaSearchInfoModal from './modals/MediaSearchInfoModal';
import SearchTakeover from './components/SearchTakeover';
import SearchDropdownContent from './components/SearchDropdownContent';
import { useRecommendations } from './hooks/useRecommendations';
import type { RecommendationItem } from './hooks/useRecommendations';
import { openMediaInApp } from '../../shared/utils/mediaDeepLinks';
import type { WidgetProps } from '../types';
import type { MediaItem } from './types';
import './styles.css';

// ============================================================================
// COMPONENT
// ============================================================================

type MediaSearchWidgetProps = WidgetProps;

const MediaSearchWidget: React.FC<MediaSearchWidgetProps> = ({
    widget,
    previewMode = false
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isTakeoverActive, setIsTakeoverActive] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const takeoverInputRef = useRef<HTMLInputElement>(null);

    // Get all integrations to filter out deleted/orphaned IDs
    const { data: allIntegrations } = useRoleAwareIntegrations();
    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    // Config extraction hook
    const {
        configuredIntegrations,
        overseerrIntegrationIds,
        integrationNames,
        hideOverseerrAvailable,
        isTakeoverEnabled,
    } = useMediaSearchConfig({
        widgetConfig: widget.config as Record<string, unknown> | undefined,
        validIntegrationIds,
    });

    // Use the media search hook (skip in preview mode)
    const {
        query,
        results,
        isSearching,
        syncStatuses,
        allSyncing,
        hasNoSyncedLibrary,
        search,
        clearResults,
        refetchSyncStatuses,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        machineIds,
        serverUrls,
        serverIds,
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

    // Request flow hook
    const {
        requestModalItem,
        setRequestModalItem,
        getItemState,
        handleRequestClick,
        handleModalComplete,
        firstOverseerrId,
    } = useRequestFlow({
        overseerrIntegrationIds,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- SSE subscription must bind once
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
        const serverId = serverIds[item.integrationId];
        openMediaInApp(item.integrationType, item.externalId || '', { machineId, serverUrl, serverId });
    }, [machineIds, serverUrls, serverIds]);

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

    // Handle Load More click - calls hook to fetch more from backend
    const handleLoadMore = (integrationId: string) => {
        loadMore(integrationId);
    };

    // Not configured state
    if (!hasIntegrations && !previewMode) {
        return <WidgetStateMessage variant="notConfigured" message="Select media integrations" />;
    }

    // ═══════════════════════════════════════════════════════════════════
    // UNIFIED STATE FLAGS — governs all dropdown visibility and content
    // ═══════════════════════════════════════════════════════════════════
    const hasLibrary = configuredIntegrations.length > 0;
    const hasRecents = recentSearches.length > 0;
    const hasRecommendations = hasLibrary && (recommendationItems.length > 0 || isRecsLoading);

    // Effective minimum chars: 1 if library configured, 2 if Overseerr-only
    const effectiveMinChars = hasLibrary ? 1 : 2;
    const isQuerySearchable = query.length >= effectiveMinChars;

    // Dropdown visible ONLY when there is content to show
    // Idle: recs or recents to show | Searching: spinner | Done: results or no-results message
    const hasDropdownContent =
        (!isQuerySearchable && (hasRecents || hasRecommendations)) ||
        (isQuerySearchable); // spinner, results, or "no results" — always something when searchable
    const showDropdown = isDropdownOpen && !previewMode && hasDropdownContent;
    const showTakeoverDropdown = isTakeoverActive && !previewMode && hasDropdownContent;

    // Shared dropdown content props
    const dropdownContentProps = {
        query,
        results,
        isSearching,
        allSyncing,
        hasNoSyncedLibrary,
        isLoadingMore,
        overseerrResults,
        hasOverseerr,
        recentSearches,
        configuredIntegrations,
        recommendationItems,
        recommendationSource,
        isRecsLoading,
        hasMultipleIntegrationTypes,
        showGroupHeaders,
        requestModalItem,
        firstOverseerrId,
        onItemClick: handleItemClick,
        onOpenIn: handleOpenIn,
        onRecentClick: handleRecentClick,
        onLoadMore: handleLoadMore,
        onRequestClick: handleRequestClick,
        onClearRecentSearches: clearRecentSearches,
        onRecommendationClick: handleRecommendationClick,
        getItemState,
        setRequestModalItem,
        onModalComplete: handleModalComplete,
    };

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
                        {showTakeoverDropdown && <SearchDropdownContent {...dropdownContentProps} />}
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
                        <SearchDropdownContent {...dropdownContentProps} />
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
