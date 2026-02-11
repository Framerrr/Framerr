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
import { useIntegrations } from '../../api/hooks/useIntegrations';
import { useRealtimeSSE } from '../../hooks/useRealtimeSSE';
import { useMediaSearch } from './useMediaSearch';
import MediaSearchInfoModal from './modals/MediaSearchInfoModal';
import SearchTakeover from './components/SearchTakeover';
import { openInApp } from './mediaUrls';
import type { WidgetProps } from '../types';
import type { MediaItem } from './types';
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

    // Read takeover config (default: true)
    const isTakeoverEnabled = (widget.config as Record<string, unknown>)?.searchTakeover !== false;

    // Get all integrations to filter out deleted/orphaned IDs
    const { data: allIntegrations } = useIntegrations();
    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    // Extract configured integrations from widget config
    // Config uses keys like plexIntegrationIds, jellyfinIntegrationIds, embyIntegrationIds (arrays)
    // Also support legacy singular keys: plexIntegrationId, etc.
    // Filter out any IDs that no longer exist (deleted integrations)
    const configuredIntegrations = useMemo(() => {
        const config = widget.config as Record<string, unknown> | undefined;
        if (!config) return [];

        const ids: string[] = [];

        // Check each integration type for configured IDs
        for (const type of ['plex', 'jellyfin', 'emby']) {
            // Check array key (new format)
            const arrayKey = `${type}IntegrationIds`;
            const arrayValue = config[arrayKey];
            if (Array.isArray(arrayValue)) {
                ids.push(...arrayValue as string[]);
            }

            // Check singular key (legacy format)
            const singularKey = `${type}IntegrationId`;
            const singularValue = config[singularKey];
            if (typeof singularValue === 'string' && singularValue) {
                ids.push(singularValue);
            }
        }

        // Filter out deleted/orphaned integration IDs
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

    // Use the media search hook (skip in preview mode)
    const {
        query,
        results,
        isSearching,
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
        isLoadingMore
    } = useMediaSearch({
        widgetId: widget.id,
        integrationIds: previewMode ? [] : configuredIntegrations,
        integrationNames
    });

    const hasIntegrations = configuredIntegrations.length > 0 || previewMode;

    // Listen for SSE invalidation when sync settings change
    const { onSettingsInvalidate } = useRealtimeSSE();
    useEffect(() => {
        if (previewMode) return;

        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'media-search-sync') {
                // Sync state changed - refetch sync statuses and clear stale results
                refetchSyncStatuses();
                clearResults();
            }
        });

        return unsubscribe;
    }, [onSettingsInvalidate, refetchSyncStatuses, clearResults, previewMode]);

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

    // Handle "Open in X" click
    const handleOpenIn = useCallback((item: MediaItem, e: React.MouseEvent) => {
        e.stopPropagation();
        // Use machineId for Plex, serverUrl for Jellyfin/Emby
        const machineId = machineIds[item.integrationId];
        const serverUrl = serverUrls[item.integrationId];
        openInApp(item, { machineId, serverUrl });
        setIsDropdownOpen(false);
        setIsTakeoverActive(false);
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
    const showGroupHeaders = integrationCount > 1;
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

    // Determine what to show in dropdown
    const hasQuery = query.length >= 2;
    const hasResults = results && Object.keys(results).length > 0;
    const hasRecents = recentSearches.length > 0;
    const showDropdown = isDropdownOpen && !previewMode && (hasRecents || hasQuery || isSearching);
    const showTakeoverDropdown = isTakeoverActive && !previewMode && (hasRecents || hasQuery || isSearching);

    // Shared dropdown content (used by both inline and takeover modes)
    const renderDropdownContent = () => (
        <>
            {/* All Syncing Message */}
            {allSyncing && hasQuery && (
                <div className="flex items-center justify-center gap-2 py-4 px-3 text-sm text-theme-tertiary">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Libraries are syncing...</span>
                </div>
            )}

            {/* Loading State */}
            {isSearching && !allSyncing && (
                <div className="flex items-center justify-center gap-2 py-4 px-3 text-sm text-theme-tertiary">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Searching...</span>
                </div>
            )}

            {/* Recent Searches (when no query AND library is synced) */}
            {!isSearching && !hasQuery && hasRecents && !hasNoSyncedLibrary && (
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

            {/* No Synced Library message */}
            {!isSearching && !hasQuery && hasNoSyncedLibrary && !allSyncing && (
                <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-theme-secondary">No synced library available.</span>
                        <span className="text-theme-tertiary text-xs">
                            Enable Library Sync in your Plex integration settings, or add a different integration.
                        </span>
                    </div>
                </div>
            )}

            {/* No Synced Library - with query */}
            {!isSearching && hasQuery && hasNoSyncedLibrary && !allSyncing && (
                <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-theme-secondary">No synced library available.</span>
                        <span className="text-theme-tertiary text-xs">
                            Enable Library Sync in your Plex integration settings, or add a different integration.
                        </span>
                    </div>
                </div>
            )}

            {/* No Results */}
            {!isSearching && hasQuery && !hasResults && !allSyncing && !hasNoSyncedLibrary && (
                <div className="py-4 px-3 text-center text-sm text-theme-tertiary">
                    No results for "{query}"
                </div>
            )}

            {/* Search Results */}
            {!isSearching && hasResults && Object.entries(results!).map(([integrationId, group]) => {
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
                                    className="media-search-open-btn"
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
                                onFocus={handleFocus}
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
                        setSelectedItem(null);
                    }}
                    zIndex={isTakeoverActive ? 250 : undefined}
                />
            )}
        </div>
    );
};

export default MediaSearchWidget;
