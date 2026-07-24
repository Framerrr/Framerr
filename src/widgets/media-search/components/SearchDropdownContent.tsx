/**
 * SearchDropdownContent
 *
 * Extracted from MediaSearchWidget renderDropdownContent().
 * Contains all dropdown UI: syncing state, search spinner, recommendations,
 * recent searches, library results, Overseerr results, and request modal.
 */

import React from 'react';
import { Search, Film, Tv, Loader2, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { RequestButton } from './RequestButton';
import { RequestModal } from '../modals/RequestModal';
import RecommendationRow from './RecommendationRow';
import type { RecommendationItem } from '../hooks/useRecommendations';
import type { MediaItem, OverseerrMediaResult, OverseerrSearchResults, SearchResults, RequestButtonState } from '../types';
import type { RecentSearch } from '../useMediaSearch';

// ============================================================================
// PROPS
// ============================================================================

interface SearchDropdownContentProps {
    // useMediaSearch returns
    query: string;
    results: SearchResults | null;
    isSearching: boolean;
    allSyncing: boolean;
    hasNoSyncedLibrary: boolean;
    isLoadingMore: boolean;
    overseerrResults: OverseerrSearchResults | null;
    hasOverseerr: boolean;
    recentSearches: RecentSearch[];

    // useMediaSearchConfig returns
    configuredIntegrations: string[];

    // useRecommendations returns
    recommendationItems: RecommendationItem[];
    recommendationSource: 'personalized' | 'random' | 'none';
    isRecsLoading: boolean;

    // Derived in parent
    hasMultipleIntegrationTypes: boolean;
    showGroupHeaders: boolean;

    // useRequestFlow returns
    requestModalItem: OverseerrMediaResult | null;
    firstOverseerrId: string;

    // Callbacks
    onItemClick: (item: MediaItem) => void;
    onOpenIn: (item: MediaItem, e: React.MouseEvent) => void;
    onRecentClick: (query: string) => void;
    onLoadMore: (integrationId: string) => void;
    onRequestClick: (item: OverseerrMediaResult) => void;
    onClearRecentSearches: () => void;
    onRecommendationClick: (rec: RecommendationItem) => void;
    getItemState: (item: OverseerrMediaResult) => RequestButtonState;
    setRequestModalItem: (item: OverseerrMediaResult | null) => void;
    onModalComplete: (success: boolean) => void;
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

/** Identity function — returns all items (backend handles pagination) */
const getVisibleItems = (_integrationId: string, items: MediaItem[]) => {
    return items;
};

/** Maps integration type to display name */
const getAppName = (type: 'plex' | 'jellyfin' | 'emby') => {
    const names = {
        plex: 'Plex',
        jellyfin: 'Jellyfin',
        emby: 'Emby'
    };
    return names[type];
};

// ============================================================================
// COMPONENT
// ============================================================================

const SearchDropdownContent: React.FC<SearchDropdownContentProps> = ({
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
    onItemClick,
    onOpenIn,
    onRecentClick,
    onLoadMore,
    onRequestClick,
    onClearRecentSearches,
    onRecommendationClick,
    getItemState,
    setRequestModalItem,
    onModalComplete,
}) => {
    // ═══════════════════════════════════════════════════════════════════
    // DERIVED STATE FLAGS — exact match to live logic
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

    return (
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
                    onItemClick={onRecommendationClick}
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
                                onClearRecentSearches();
                            }}
                            className="text-theme-tertiary hover:text-theme-primary text-xs transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    {recentSearches.map(recent => (
                        <button
                            key={recent.id}
                            onClick={() => onRecentClick(recent.query)}
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
                        No results for &quot;{query}&quot;
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
                                onClick={() => onItemClick(item)}
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
                                    onClick={(e) => onOpenIn(item, e)}
                                    className="media-search-request-btn"
                                >
                                    Open in {getAppName(item.integrationType)}
                                </Button>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {group.hasMore && (
                            <button
                                onClick={() => onLoadMore(integrationId)}
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
                                            onClick={() => onRequestClick(item)}
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
                    onRequestComplete={onModalComplete}
                    zIndex={250}
                    itemState={getItemState(requestModalItem)}
                />
            )}
        </>
    );
};

export default SearchDropdownContent;
