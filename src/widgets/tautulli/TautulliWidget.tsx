import React, { useState, useRef, useCallback, useMemo } from 'react';
import { BarChart3, Film, Tv, Music, Image, Play, Clock, Library, Users } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useIntegrationSSE } from '../../shared/widgets/hooks/useIntegrationSSE';
import { SegmentedControl } from '../../shared/ui';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import type { WidgetProps } from '../types';
import './styles.css';

// ============================================================================
// TYPES — Matching backend poller shapes
// ============================================================================

interface TautulliLibrary {
    sectionId: string;
    sectionName: string;
    sectionType: string;
    count: number;
    parentCount: number;
    childCount: number;
    plays: number;
    duration: number;
    lastPlayed: string;
    lastAccessed: number;
    isActive: number;
}

interface TautulliStatItem {
    title: string;
    totalPlays: number;
    totalDuration: number;
    thumb: string;
    ratingKey: number;
    mediaType: string;
    year?: number;
    usersWatched?: string;
    lastPlay?: number;
    sectionId?: number;
    grandparentThumb?: string;
    userThumb?: string;
    friendlyName?: string;
}

interface TautulliStatCategory {
    statId: string;
    statType?: string;
    rows: TautulliStatItem[];
}

interface TautulliRecentItem {
    title: string;
    fullTitle: string;
    year: string;
    mediaType: string;
    addedAt: string;
    thumb: string;
    ratingKey: string;
    grandparentTitle?: string;
    grandparentThumb?: string;
    parentTitle?: string;
    parentMediaIndex?: number;
    mediaIndex?: number;
    libraryName: string;
}

interface TautulliConfig {
    integrationId?: string;
    itemCount?: string;
    showStatsBar?: string;
    [key: string]: unknown;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Format seconds into human-readable duration */
function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    if (hours < 24) return `${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days < 7) return `${days}d ${remainingHours}h`;
    return `${days}d`;
}

/** Format large numbers compactly */
function formatCount(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

/** Get icon for library section type */
function getLibraryIcon(sectionType: string): React.ElementType {
    switch (sectionType) {
        case 'movie': return Film;
        case 'show': return Tv;
        case 'artist': return Music;
        case 'photo': return Image;
        default: return Library;
    }
}



// ============================================================================
// STATS SUMMARY BAR — Compact inline strip
// ============================================================================

interface StatsSummaryProps {
    libraries: TautulliLibrary[];
}

const StatsSummary = React.memo(({ libraries }: StatsSummaryProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const movieCount = libraries.filter(l => l.sectionType === 'movie').reduce((s, l) => s + l.count, 0);
    const showCount = libraries.filter(l => l.sectionType === 'show').reduce((s, l) => s + l.count, 0);
    const totalPlays = libraries.reduce((s, l) => s + l.plays, 0);
    const totalDuration = libraries.reduce((s, l) => s + l.duration, 0);

    // Build stat items based on available content
    const items: { icon: React.ElementType; value: string; label: string }[] = [];
    if (movieCount > 0) items.push({ icon: Film, value: formatCount(movieCount), label: 'Movies' });
    if (showCount > 0) items.push({ icon: Tv, value: formatCount(showCount), label: 'Shows' });
    if (totalPlays > 0) items.push({ icon: Play, value: formatCount(totalPlays), label: 'Plays' });
    if (totalDuration > 0) items.push({ icon: Clock, value: formatDuration(totalDuration), label: 'Watch Time' });

    // Detect which items start a new visual row and mark them
    const updateWrapClasses = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const children = Array.from(el.querySelectorAll('.tautulli-stats-item'));
        let lastTop = -1;
        children.forEach((child, i) => {
            const top = (child as HTMLElement).getBoundingClientRect().top;
            if (i === 0 || (lastTop !== -1 && Math.abs(top - lastTop) > 2)) {
                child.classList.add('wrap-start');
            } else {
                child.classList.remove('wrap-start');
            }
            lastTop = top;
        });
    }, []);

    React.useLayoutEffect(() => {
        updateWrapClasses();
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(updateWrapClasses);
        ro.observe(el);
        return () => ro.disconnect();
    }, [updateWrapClasses, items.length]);

    if (items.length === 0) return null;

    return (
        <div ref={containerRef} className="tautulli-stats-summary">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <span key={item.label} className="tautulli-stats-item">
                        <Icon size={11} />
                        <span className="tautulli-stats-value">{item.value}</span>
                        <span className="tautulli-stats-label">{item.label}</span>
                    </span>
                );
            })}
        </div>
    );
});

StatsSummary.displayName = 'StatsSummary';

// ============================================================================
// LIBRARY CARDS COMPONENT
// ============================================================================

interface LibraryCardsProps {
    libraries: TautulliLibrary[];
}

const LibraryCards = React.memo(({ libraries }: LibraryCardsProps) => {
    const activeLibraries = libraries.filter(l => l.isActive);

    return (
        <div className="tautulli-library-grid">
            {activeLibraries.map((lib) => {
                const Icon = getLibraryIcon(lib.sectionType);
                const subtitle = lib.sectionType === 'show'
                    ? `${formatCount(lib.count)} shows · ${formatCount(lib.childCount)} episodes`
                    : lib.sectionType === 'artist'
                        ? `${formatCount(lib.count)} artists · ${formatCount(lib.childCount)} tracks`
                        : `${formatCount(lib.count)} items`;

                return (
                    <div key={lib.sectionId} className="tautulli-library-card glass-subtle">
                        <div className="tautulli-library-header">
                            <div className="tautulli-library-icon">
                                <Icon size={14} />
                            </div>
                            <div className="tautulli-library-info">
                                <span className="tautulli-library-name text-theme-primary">{lib.sectionName}</span>
                                <span className="tautulli-library-count text-theme-secondary">{subtitle}</span>
                            </div>
                        </div>
                        <div className="tautulli-library-stats">
                            <div className="tautulli-library-metric">
                                <Play size={10} className="text-theme-tertiary" />
                                <span className="text-theme-secondary">{formatCount(lib.plays)}</span>
                            </div>
                            <div className="tautulli-library-metric">
                                <Clock size={10} className="text-theme-tertiary" />
                                <span className="text-theme-secondary">{formatDuration(lib.duration)}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

LibraryCards.displayName = 'LibraryCards';

// ============================================================================
// TOP ITEMS LIST COMPONENT
// ============================================================================

interface TopItemsListProps {
    stats: TautulliStatCategory[];
    statId: string;
    integrationId?: string;
    itemCount?: number;
}

/** Build image proxy URL for a thumb path */
function tautulliImageUrl(integrationId: string | undefined, thumb: string, width = 300, height = 450): string | null {
    if (!integrationId || !thumb) return null;
    return `/api/integrations/${integrationId}/proxy/tautulli-image?img=${encodeURIComponent(thumb)}&width=${width}&height=${height}`;
}

/** Format subtitle based on media type */
function formatStatSubtitle(item: TautulliStatItem): string {
    if (item.year) return String(item.year);
    return '';
}

const TopItemsList = React.memo(({ stats, statId, integrationId, itemCount = 5 }: TopItemsListProps) => {
    const category = stats.find(s => s.statId === statId);
    const items = category?.rows || [];
    const displayItems = items.slice(0, itemCount);

    if (displayItems.length === 0) return null;

    const isUserList = statId === 'top_users' || statId === 'top_platforms';

    return (
        <div className="tautulli-list-section">
            <div className="tautulli-list-items">
                {displayItems.map((item, idx) => {
                    const thumbPath = item.grandparentThumb || item.thumb;
                    const imgUrl = isUserList
                        ? tautulliImageUrl(integrationId, item.userThumb || item.thumb, 100, 100)
                        : tautulliImageUrl(integrationId, thumbPath, 300, 450);
                    const subtitle = formatStatSubtitle(item);
                    // For users, use friendlyName; for media, use title
                    const displayTitle = isUserList ? (item.friendlyName || item.title) : item.title;

                    return (
                        <div key={item.ratingKey || idx} className="tautulli-card">
                            {/* Poster / Avatar */}
                            <div className={`tautulli-card-poster ${isUserList ? 'tautulli-card-avatar' : ''}`}>
                                {imgUrl ? (
                                    <img
                                        src={imgUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="tautulli-card-poster-placeholder">
                                        <Film size={16} />
                                    </div>
                                )}
                                {!isUserList && (
                                    <span className="tautulli-card-rank">{idx + 1}</span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="tautulli-card-info">
                                <span className="tautulli-card-title text-theme-primary">{displayTitle}</span>
                                {isUserList && item.title && (
                                    <span className="tautulli-card-subtitle text-theme-tertiary">{item.title}</span>
                                )}
                                {!isUserList && subtitle && (
                                    <span className="tautulli-card-subtitle text-theme-tertiary">{subtitle}</span>
                                )}
                            </div>

                            {/* Plays */}
                            <span className="tautulli-card-plays text-accent">
                                {formatCount(item.totalPlays)} {item.totalPlays === 1 ? 'play' : 'plays'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

TopItemsList.displayName = 'TopItemsList';

// ============================================================================
// RECENTLY ADDED LIST COMPONENT
// ============================================================================

interface RecentlyAddedProps {
    items: TautulliRecentItem[];
    integrationId?: string;
    itemCount?: number;
}

/** Format time-ago from unix timestamp */
function formatTimeAgo(unixStr: string): string {
    const ts = Number(unixStr);
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
}

/** Build subtitle for recently added items */
function formatRecentSubtitle(item: TautulliRecentItem): string {
    const parts: string[] = [];

    // For episodes: show S#E#
    if (item.mediaType === 'episode' && item.parentMediaIndex && item.mediaIndex) {
        parts.push(`S${item.parentMediaIndex} · E${item.mediaIndex}`);
    } else if (item.year) {
        parts.push(item.year);
    }

    const timeAgo = formatTimeAgo(item.addedAt);
    if (timeAgo) parts.push(timeAgo);

    return parts.join(' · ');
}

const RecentlyAdded = React.memo(({ items, integrationId, itemCount = 5 }: RecentlyAddedProps) => {
    const displayItems = items.slice(0, itemCount);
    if (displayItems.length === 0) return null;

    return (
        <div className="tautulli-list-section">
            <div className="tautulli-list-items">
                {displayItems.map((item, idx) => {
                    const thumbPath = item.grandparentThumb || item.thumb;
                    const imgUrl = tautulliImageUrl(integrationId, thumbPath, 300, 450);
                    const displayTitle = item.grandparentTitle || item.title;
                    const subtitle = formatRecentSubtitle(item);

                    return (
                        <div key={item.ratingKey || idx} className="tautulli-card">
                            {/* Poster */}
                            <div className="tautulli-card-poster">
                                {imgUrl ? (
                                    <img
                                        src={imgUrl}
                                        alt={displayTitle}
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="tautulli-card-poster-placeholder">
                                        <Film size={16} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="tautulli-card-info">
                                <span className="tautulli-card-title text-theme-primary">{displayTitle}</span>
                                {subtitle && (
                                    <span className="tautulli-card-subtitle text-theme-tertiary">{subtitle}</span>
                                )}
                                {item.grandparentTitle && (
                                    <span className="tautulli-card-episode-title text-theme-secondary">{item.title}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

RecentlyAdded.displayName = 'RecentlyAdded';

// ============================================================================
// PREVIEW DATA
// ============================================================================

const PREVIEW_LIBRARIES: TautulliLibrary[] = [
    { sectionId: '1', sectionName: 'Movies', sectionType: 'movie', count: 1247, parentCount: 0, childCount: 0, plays: 3842, duration: 6843200, lastPlayed: 'Dune: Part Two', lastAccessed: 0, isActive: 1 },
    { sectionId: '2', sectionName: 'TV Shows', sectionType: 'show', count: 186, parentCount: 864, childCount: 12453, plays: 18294, duration: 29847300, lastPlayed: 'Severance', lastAccessed: 0, isActive: 1 },
    { sectionId: '3', sectionName: 'Music', sectionType: 'artist', count: 342, parentCount: 1847, childCount: 24891, plays: 8421, duration: 2184600, lastPlayed: 'The Beatles', lastAccessed: 0, isActive: 1 },
];

const PREVIEW_STATS: TautulliStatCategory[] = [
    {
        statId: 'top_tv', statType: 'total_plays', rows: [
            { title: 'Severance', totalPlays: 47, totalDuration: 84600, thumb: '', ratingKey: 1, mediaType: 'episode' },
            { title: 'The Bear', totalPlays: 38, totalDuration: 57000, thumb: '', ratingKey: 2, mediaType: 'episode' },
            { title: 'Shogun', totalPlays: 31, totalDuration: 68200, thumb: '', ratingKey: 3, mediaType: 'episode' },
            { title: 'House of the Dragon', totalPlays: 24, totalDuration: 43200, thumb: '', ratingKey: 4, mediaType: 'episode' },
            { title: 'The Last of Us', totalPlays: 19, totalDuration: 34200, thumb: '', ratingKey: 5, mediaType: 'episode' },
        ]
    },
];

// ============================================================================
// MAIN WIDGET COMPONENT
// ============================================================================

export interface TautulliWidgetProps extends WidgetProps {
    // No additional props
}

const TautulliWidget = ({ widget, previewMode = false }: TautulliWidgetProps): React.JSX.Element => {

    // ---- Auth & access ----
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const config = widget.config as TautulliConfig | undefined;
    const configuredIntegrationId = config?.integrationId;
    const itemCount = parseInt(config?.itemCount || '5', 10);
    const showStatsBar = config?.showStatsBar !== 'false';

    // Interactive tab state
    const [activeTab, setActiveTab] = useState('top_tv');

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('tautulli', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;



    // ---- SSE subscriptions ----
    const [libraries, setLibraries] = useState<TautulliLibrary[]>([]);
    const [stats, setStats] = useState<TautulliStatCategory[]>([]);
    const [recentItems, setRecentItems] = useState<TautulliRecentItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Main: libraries (60s polling)
    // SSE wraps arrays as { items: [...], _meta: {...} } for delta patching safety
    const { loading: librariesLoading, isConnected } = useIntegrationSSE<{ items: TautulliLibrary[]; _meta?: unknown }>({
        integrationType: 'tautulli',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            const items = data?.items;
            setLibraries(Array.isArray(items) ? items : []);
            setError(null);
        },
        onError: (err) => setError(err.message || 'Failed to load libraries'),
    });

    // Stats subtype (5min polling)
    useIntegrationSSE<{ items: TautulliStatCategory[]; _meta?: unknown }>({
        integrationType: 'tautulli',
        subtype: 'stats',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            const items = data?.items;
            setStats(Array.isArray(items) ? items : []);
        },
        onError: () => { /* stats are optional, don't surface errors */ },
    });

    // Recent subtype (5min polling)
    useIntegrationSSE<{ items: TautulliRecentItem[]; _meta?: unknown }>({
        integrationType: 'tautulli',
        subtype: 'recent',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            const items = data?.items;
            setRecentItems(Array.isArray(items) ? items : []);
        },
        onError: () => { /* recent items are optional */ },
    });



    // ---- Tab options (built dynamically from available data) ----
    const tabOptions = useMemo(() => {
        const opts = [
            { value: 'top_movies', label: 'Top Movies', shortLabel: 'Movies', icon: Film },
            { value: 'top_tv', label: 'Top TV', shortLabel: 'TV', icon: Tv },
            { value: 'top_users', label: 'Top Users', shortLabel: 'Users', icon: Users },
        ];
        if (recentItems.length > 0) {
            opts.push({ value: 'recently_added', label: 'Recently Added', shortLabel: 'Recent', icon: Clock });
        }
        return opts;
    }, [recentItems.length]);

    // ---- All hooks declared above this line ----

    // ---- Preview mode: skip data fetching, show mock data ----
    if (previewMode) {
        return (
            <div className="tautulli-widget">
                <StatsSummary libraries={PREVIEW_LIBRARIES} />
                <TopItemsList stats={PREVIEW_STATS} statId="top_tv" />
            </div>
        );
    }

    // ---- Access state handling (after all hooks) ----
    if (accessLoading) return <WidgetStateMessage variant="loading" />;
    if (accessStatus === 'noAccess') return <WidgetStateMessage variant="noAccess" serviceName="Tautulli" />;
    if (accessStatus === 'disabled') return <WidgetStateMessage variant="disabled" serviceName="Tautulli" isAdmin={userIsAdmin} />;
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Tautulli" isAdmin={userIsAdmin} />;
    }

    // Loading state
    if ((librariesLoading && libraries.length === 0) || (!isConnected && libraries.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Error state
    if (error) {
        const isUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return <WidgetStateMessage variant={isUnavailable ? 'unavailable' : 'error'} serviceName="Tautulli" instanceName={isUnavailable ? effectiveDisplayName : undefined} message={isUnavailable ? undefined : error} />;
    }

    // Empty state
    if (libraries.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={BarChart3}
                emptyTitle="No Libraries Found"
                emptySubtitle="Check your Tautulli connection"
            />
        );
    }


    const isRecentTab = activeTab === 'recently_added';

    return (
        <div className="tautulli-widget">
            {/* Stats overview — hero strip at top */}
            {showStatsBar && (
                <>
                    <StatsSummary libraries={libraries} />
                    <div className="tautulli-divider" />
                </>
            )}

            {/* Section header + tab navigation */}
            <span className="tautulli-section-title text-theme-secondary">Activity</span>
            <SegmentedControl
                options={tabOptions}
                value={activeTab}
                onChange={setActiveTab}
                size="sm"
                id="tautulli-tabs"
            />

            {/* Content area */}
            <div className="tautulli-content">
                {isRecentTab && recentItems.length > 0 ? (
                    <RecentlyAdded items={recentItems} integrationId={integrationId} itemCount={itemCount} />
                ) : stats.length > 0 ? (
                    <TopItemsList stats={stats} statId={activeTab} integrationId={integrationId} itemCount={itemCount} />
                ) : (
                    <div className="text-theme-tertiary" style={{ fontSize: '0.7rem', padding: '1rem', textAlign: 'center' }}>
                        Select a category above
                    </div>
                )}
            </div>
        </div>
    );
};

export default TautulliWidget;
