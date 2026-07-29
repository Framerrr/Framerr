import React, { useState } from 'react';
import { BarChart3, Film, History, Tv, Users } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useIntegrationSSE } from '../../shared/widgets/hooks/useIntegrationSSE';
import { useRetryPoll } from '../../shared/widgets/hooks';
import { useAuth } from '../../context/useAuth';
import { isAdmin } from '../../utils/permissions';
import type { WidgetProps } from '../types';
import type { TautulliLibrary, TautulliStatCategory, TautulliRecentItem, TautulliConfig } from './tautulli.types';
import { useTautulliStats } from './hooks/useTautulliStats';
import StatsSummary from './components/StatsSummary';
import TabPanel, { type TabPanelRow } from './components/TabPanel';
import { SlidingTabBar, type SlidingTabBarItem } from '../../shared/ui';
import { formatCount, formatStatSubtitle, formatTimeAgo, tautulliArtByRatingKey, tautulliImageUrl } from './utils';
import './styles.css';

// ============================================================================
// PREVIEW DATA — widget-picker preview (no live integration)
// ============================================================================

const PREVIEW_LIBRARIES: TautulliLibrary[] = [
    { sectionId: '1', sectionName: 'Movies', sectionType: 'movie', count: 1247, parentCount: 0, childCount: 0, plays: 3842, duration: 6843200, lastPlayed: 'Dune: Part Two', lastAccessed: 0, isActive: 1 },
    { sectionId: '2', sectionName: 'TV Shows', sectionType: 'show', count: 186, parentCount: 864, childCount: 12453, plays: 18294, duration: 29847300, lastPlayed: 'Severance', lastAccessed: 0, isActive: 1 },
    { sectionId: '3', sectionName: 'Music', sectionType: 'artist', count: 342, parentCount: 1847, childCount: 24891, plays: 8421, duration: 2184600, lastPlayed: 'The Beatles', lastAccessed: 0, isActive: 1 },
];

const PREVIEW_STATS: TautulliStatCategory[] = [
    {
        statId: 'top_movies', statType: 'total_plays', rows: [
            { title: 'Dune: Part Two', totalPlays: 52, totalDuration: 96000, thumb: '', ratingKey: 101, mediaType: 'movie', year: 2024 },
            { title: 'Oppenheimer', totalPlays: 41, totalDuration: 87000, thumb: '', ratingKey: 102, mediaType: 'movie', year: 2023 },
            { title: 'The Batman', totalPlays: 29, totalDuration: 71400, thumb: '', ratingKey: 103, mediaType: 'movie', year: 2022 },
            { title: 'Furiosa', totalPlays: 22, totalDuration: 54000, thumb: '', ratingKey: 104, mediaType: 'movie', year: 2024 },
            { title: 'Poor Things', totalPlays: 18, totalDuration: 48000, thumb: '', ratingKey: 105, mediaType: 'movie', year: 2023 },
            { title: 'Barbie', totalPlays: 15, totalDuration: 42000, thumb: '', ratingKey: 106, mediaType: 'movie', year: 2023 },
        ]
    },
    {
        statId: 'top_tv', statType: 'total_plays', rows: [
            { title: 'Severance', totalPlays: 47, totalDuration: 84600, thumb: '', ratingKey: 1, mediaType: 'episode', year: 2022 },
            { title: 'The Bear', totalPlays: 38, totalDuration: 57000, thumb: '', ratingKey: 2, mediaType: 'episode', year: 2022 },
            { title: 'Shogun', totalPlays: 31, totalDuration: 68200, thumb: '', ratingKey: 3, mediaType: 'episode', year: 2024 },
            { title: 'Fallout', totalPlays: 27, totalDuration: 61000, thumb: '', ratingKey: 4, mediaType: 'episode', year: 2024 },
            { title: 'The Last of Us', totalPlays: 21, totalDuration: 55000, thumb: '', ratingKey: 5, mediaType: 'episode', year: 2023 },
        ]
    },
    {
        statId: 'top_users', statType: 'total_plays', rows: [
            { title: 'Alex', friendlyName: 'Alex', totalPlays: 64, totalDuration: 118400, thumb: '', userThumb: '', ratingKey: 11, mediaType: '' },
            { title: 'Jordan', friendlyName: 'Jordan', totalPlays: 49, totalDuration: 92100, thumb: '', userThumb: '', ratingKey: 12, mediaType: '' },
            { title: 'Sam', friendlyName: 'Sam', totalPlays: 33, totalDuration: 61700, thumb: '', userThumb: '', ratingKey: 13, mediaType: '' },
            { title: 'Riley', friendlyName: 'Riley', totalPlays: 28, totalDuration: 51000, thumb: '', userThumb: '', ratingKey: 14, mediaType: '' },
            { title: 'Casey', friendlyName: 'Casey', totalPlays: 19, totalDuration: 38000, thumb: '', userThumb: '', ratingKey: 15, mediaType: '' },
        ]
    },
];

const nowSec = () => Math.floor(Date.now() / 1000);

const PREVIEW_RECENT: TautulliRecentItem[] = [
    { title: 'Dune: Part Two', fullTitle: 'Dune: Part Two', year: '2024', mediaType: 'movie', addedAt: String(nowSec() - 3600), thumb: '', ratingKey: '101', libraryName: 'Movies' },
    { title: 'Chapter 5', fullTitle: 'Severance - Chapter 5', year: '2022', mediaType: 'episode', addedAt: String(nowSec() - 7200), thumb: '', ratingKey: '201', grandparentTitle: 'Severance', parentMediaIndex: 1, mediaIndex: 5, libraryName: 'TV Shows' },
    { title: 'Oppenheimer', fullTitle: 'Oppenheimer', year: '2023', mediaType: 'movie', addedAt: String(nowSec() - 14400), thumb: '', ratingKey: '102', libraryName: 'Movies' },
    { title: 'Episode 3', fullTitle: 'The Bear - Episode 3', year: '2023', mediaType: 'episode', addedAt: String(nowSec() - 28800), thumb: '', ratingKey: '202', grandparentTitle: 'The Bear', parentMediaIndex: 3, mediaIndex: 3, libraryName: 'TV Shows' },
    { title: 'Furiosa', fullTitle: 'Furiosa', year: '2024', mediaType: 'movie', addedAt: String(nowSec() - 86400), thumb: '', ratingKey: '104', libraryName: 'Movies' },
    { title: 'Episode 1', fullTitle: 'Fallout - Episode 1', year: '2024', mediaType: 'episode', addedAt: String(nowSec() - 172800), thumb: '', ratingKey: '203', grandparentTitle: 'Fallout', parentMediaIndex: 1, mediaIndex: 1, libraryName: 'TV Shows' },
    { title: 'Poor Things', fullTitle: 'Poor Things', year: '2023', mediaType: 'movie', addedAt: String(nowSec() - 259200), thumb: '', ratingKey: '105', libraryName: 'Movies' },
    { title: 'Barbie', fullTitle: 'Barbie', year: '2023', mediaType: 'movie', addedAt: String(nowSec() - 345600), thumb: '', ratingKey: '106', libraryName: 'Movies' },
];

type TautulliTabId = 'recent' | 'movies' | 'tv' | 'users';

const TABS: SlidingTabBarItem[] = [
    { id: 'recent', label: 'Recently Added', shortLabel: 'Recent', icon: History },
    { id: 'movies', label: 'Top Movies', shortLabel: 'Movies', icon: Film },
    { id: 'tv', label: 'Top TV', shortLabel: 'TV', icon: Tv },
    { id: 'users', label: 'Top Users', shortLabel: 'Users', icon: Users },
];

const LIST_ITEM_CHOICES = [5, 10, 20, 50] as const;

/** Resolve list-item config; migrate legacy 3 → 5. */
function resolveListItemCount(raw: string | undefined): number {
    const n = parseInt(raw || '10', 10);
    if ((LIST_ITEM_CHOICES as readonly number[]).includes(n)) return n;
    if (n === 3) return 5;
    return LIST_ITEM_CHOICES.reduce((best, v) =>
        Math.abs(v - n) < Math.abs(best - n) ? v : best
    , 10);
}

function recentToRows(items: TautulliRecentItem[], integrationId?: string): TabPanelRow[] {
    return items.map((item, idx) => {
        const title = item.grandparentTitle || item.title;
        const timeAgo = formatTimeAgo(item.addedAt);
        const featuredPath = item.art || item.grandparentThumb || item.thumb;
        const listPath = item.grandparentThumb || item.thumb;
        return {
            key: item.ratingKey || `recent-${idx}`,
            title,
            subtitle: item.mediaType === 'episode' && item.parentMediaIndex != null
                ? `S${item.parentMediaIndex} · E${item.mediaIndex ?? '?'}`
                : item.year || undefined,
            meta: timeAgo ? `Added ${timeAgo}` : '',
            featuredImageUrl: tautulliImageUrl(integrationId, featuredPath, 640, 360),
            listImageUrl: tautulliImageUrl(integrationId, listPath, 300, 450),
            variant: 'content' as const,
            mediaType: item.mediaType,
        };
    });
}

function statsToRows(
    stats: TautulliStatCategory[],
    statId: string,
    integrationId: string | undefined,
    mode: 'content' | 'user',
): TabPanelRow[] {
    const category = stats.find((s) => s.statId === statId);
    const rows = category?.rows || [];
    return rows.map((item, idx) => {
        const plays = `${formatCount(item.totalPlays)} ${item.totalPlays === 1 ? 'play' : 'plays'}`;
        if (mode === 'user') {
            const name = item.friendlyName || item.title;
            const avatarPath = item.userThumb || item.thumb;
            return {
                key: String(item.ratingKey || `user-${idx}`),
                title: name,
                meta: plays,
                featuredImageUrl: null,
                listImageUrl: tautulliImageUrl(integrationId, avatarPath, 100, 100),
                variant: 'user' as const,
            };
        }
        const thumbPath = item.grandparentThumb || item.thumb;
        // Stats proxy enriches top_tv/top_movies with real art via get_metadata
        // (same path shape Recently Added already returns). ratingKey art fetch
        // is a secondary fallback if enrichment missed.
        const artFromApi = item.art && item.art.includes('/art/') ? item.art : '';
        // Match Recently Added: default Tautulli fallback (not fallback=none).
        // fallback=none made Tautulli HTTP 400 when PMS art was briefly unavailable.
        const artUrl = artFromApi
            ? tautulliImageUrl(integrationId, artFromApi, 640, 360)
            : tautulliArtByRatingKey(integrationId, item.ratingKey, 640, 360);
        const featured = artUrl;
        const poster = tautulliImageUrl(integrationId, thumbPath, 300, 450);
        return {
            key: String(item.ratingKey || `stat-${idx}`),
            title: item.title,
            subtitle: formatStatSubtitle(item) || undefined,
            meta: plays,
            featuredImageUrl: featured || poster,
            listImageUrl: poster,
            featuredFallbackUrl: poster,
            variant: 'content' as const,
            mediaType: item.mediaType,
        };
    });
}

const PREVIEW_ITEM_COUNT = resolveListItemCount(undefined);

function TautulliPreview(): React.JSX.Element {
    return (
        <div className="tautulli-widget">
            <StatsSummary libraries={PREVIEW_LIBRARIES} />
            <div className="tautulli-divider" />
            <div className="tautulli-content">
                <SlidingTabBar
                    tabs={TABS}
                    activeId="recent"
                    onChange={() => { /* preview: tabs are non-interactive */ }}
                    aria-label="Tautulli sections"
                />
                <div className="tautulli-tab-body" role="tabpanel">
                    <TabPanel
                        rows={recentToRows(PREVIEW_RECENT)}
                        listLimit={PREVIEW_ITEM_COUNT}
                        emptyLabel="No recently added items"
                    />
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WIDGET COMPONENT
// ============================================================================

export type TautulliWidgetProps = WidgetProps;

const TautulliWidget = ({ widget, previewMode = false }: TautulliWidgetProps): React.JSX.Element => {
    if (previewMode) {
        return <TautulliPreview />;
    }

    // ---- Auth & access ----
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const config = widget.config as TautulliConfig | undefined;
    const configuredIntegrationId = config?.forceClearIntegration ? null : config?.integrationId;
    const itemCount = resolveListItemCount(config?.itemCount);
    const showStatsBar = config?.showStatsBar !== 'false';
    const statsTimeRange = parseInt(config?.statsTimeRange || '90', 10);

    const [activeTab, setActiveTab] = useState<TautulliTabId>('recent');

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('tautulli', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const handleRetry = useRetryPoll(integrationId, 'tautulli');

    // ---- SSE subscriptions ----
    const [libraries, setLibraries] = useState<TautulliLibrary[]>([]);
    const [recentItems, setRecentItems] = useState<TautulliRecentItem[]>([]);
    const [error, setError] = useState<string | null>(null);

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

    const { stats, statsLoading, statsError } = useTautulliStats({
        integrationId,
        timeRange: statsTimeRange,
        listItemCount: itemCount,
        enabled: isIntegrationBound,
    });

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

    // ---- All hooks declared above this line ----

    const renderTabs = (
        recentRows: TabPanelRow[],
        movieRows: TabPanelRow[],
        tvRows: TabPanelRow[],
        userRows: TabPanelRow[],
        statsBusy: boolean,
        statsFail: string | null,
    ) => {
        let panel: React.ReactNode;

        if (activeTab === 'recent') {
            panel = (
                <TabPanel
                    rows={recentRows}
                    listLimit={itemCount}
                    emptyLabel="No recently added items"
                />
            );
        } else if (statsFail) {
            panel = (
                <div className="tautulli-stats-status text-theme-secondary" role="status">
                    Couldn&apos;t load top stats — {statsFail}
                </div>
            );
        } else if (statsBusy) {
            panel = (
                <div className="tautulli-stats-status text-theme-secondary" role="status">
                    Loading top stats…
                </div>
            );
        } else if (activeTab === 'movies') {
            panel = <TabPanel rows={movieRows} listLimit={itemCount} emptyLabel="No top movies yet" />;
        } else if (activeTab === 'tv') {
            panel = <TabPanel rows={tvRows} listLimit={itemCount} emptyLabel="No top TV yet" />;
        } else {
            panel = <TabPanel rows={userRows} listLimit={itemCount} emptyLabel="No top users yet" />;
        }

        return (
            <>
                <SlidingTabBar
                    tabs={TABS}
                    activeId={activeTab}
                    onChange={(id) => setActiveTab(id as TautulliTabId)}
                    aria-label="Tautulli sections"
                />
                <div className="tautulli-tab-body" role="tabpanel">
                    {panel}
                </div>
            </>
        );
    };

    // ---- Access state handling (after all hooks) ----
    if (accessLoading) return <WidgetStateMessage variant="loading" />;
    if (accessStatus === 'noAccess') return <WidgetStateMessage variant="noAccess" serviceName="Tautulli" />;
    if (accessStatus === 'disabled') return <WidgetStateMessage variant="disabled" serviceName="Tautulli" isAdmin={userIsAdmin} />;
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Tautulli" isAdmin={userIsAdmin} />;
    }

    if ((librariesLoading && libraries.length === 0) || (!isConnected && libraries.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        const isUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return <WidgetStateMessage variant={isUnavailable ? 'unavailable' : 'error'} serviceName="Tautulli" instanceName={isUnavailable ? effectiveDisplayName : undefined} message={isUnavailable ? undefined : error} onRetry={isUnavailable ? handleRetry : undefined} />;
    }

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

    const recentRows = recentToRows(recentItems, integrationId);
    const movieRows = statsToRows(stats, 'top_movies', integrationId, 'content');
    const tvRows = statsToRows(stats, 'top_tv', integrationId, 'content');
    const userRows = statsToRows(stats, 'top_users', integrationId, 'user');

    return (
        <div className="tautulli-widget">
            {showStatsBar && (
                <>
                    <StatsSummary libraries={libraries} />
                    <div className="tautulli-divider" />
                </>
            )}

            <div className="tautulli-content">
                {renderTabs(
                    recentRows,
                    movieRows,
                    tvRows,
                    userRows,
                    statsLoading && stats.length === 0,
                    statsError,
                )}
            </div>
        </div>
    );
};

export default TautulliWidget;
