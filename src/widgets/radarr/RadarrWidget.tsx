/**
 * Radarr Widget
 * 
 * Movie management widget with:
 * - Admin view: Header chips + stats bar + Hero/mini-scroll upcoming + Needs Attention
 * - User view: Upcoming poster grid
 * - Preview mode: Mock data display
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Film } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useRetryPoll } from '../../shared/widgets/hooks';
import { useAuth } from '../../context/useAuth';
import { isAdmin } from '../../utils/permissions';
import { useRadarrData, type RadarrSortBy } from './hooks/useRadarrData';
import HeroCard from './components/HeroCard';
import UpcomingCarousel from './components/UpcomingCarousel';
import MissingList from './components/MissingList';
import MovieDetailModal from './components/MovieDetailModal';
import HeaderChips from './components/HeaderChips';
import type { WidgetProps } from '../types';
import type { CalendarMovie, WantedMovie, ReleaseTypeVisibility } from './radarr.types';
import './styles.css';

// ============================================================================
// PREVIEW MODE
// ============================================================================

const PREVIEW_MOVIES = [
    { id: 1, title: 'Dune: Part Three', year: 2026, inCinemas: '2026-03-15' },
    { id: 2, title: 'The Batman Part II', year: 2027, inCinemas: '2027-10-01' },
    { id: 3, title: 'Avatar 3', year: 2025, inCinemas: '2025-12-19' },
    { id: 4, title: 'Mission: Impossible 8', year: 2025, inCinemas: '2025-05-23' },
    { id: 5, title: 'Blade Runner 2099', year: 2026, digitalRelease: '2026-06-15' },
];

function PreviewMode(): React.JSX.Element {
    return (
        <div className="rdr-widget">
            <HeaderChips
                upcomingCount={5}
                cinemaCount={1}
                missingCount={3}
                cutoffUnmetCount={0}
                downloadingCount={0}
            />
            <div className="rdr-divider" />

            <div className="rdr-section-header">Upcoming</div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {PREVIEW_MOVIES.map(movie => (
                    <div key={`preview-${movie.id}`} className="rdr-missing-item" style={{ cursor: 'default' }}>
                        <div className="rdr-missing-poster-placeholder">
                            <Film size={14} />
                        </div>
                        <div className="rdr-missing-info">
                            <span className="rdr-missing-series">{movie.title}</span>
                            <span className="rdr-missing-year">
                                {movie.year} · {movie.inCinemas || (movie as { digitalRelease?: string }).digitalRelease}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// USER VIEW - Stacked poster grid
// ============================================================================
// ADMIN VIEW - Header chips + Stats bar + Hero/mini-scroll + Needs Attention
// ============================================================================


interface AdminViewProps {
    integrationId: string;
    data: ReturnType<typeof useRadarrData>;
    viewMode: 'auto' | 'stacked' | 'column';
    showStatsBar: boolean;
    userIsAdmin: boolean;
    showMissing: boolean;
    showUpgrades: boolean;
}

function AdminView({
    integrationId,
    data,
    viewMode: configViewMode,
    showStatsBar,
    userIsAdmin,
    showMissing,
    showUpgrades,
}: AdminViewProps): React.JSX.Element {
    const [selectedMovie, setSelectedMovie] = useState<WantedMovie | CalendarMovie | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleMovieClick = useCallback((movie: WantedMovie | CalendarMovie) => {
        setSelectedMovie(movie);
        setModalOpen(true);
    }, []);

    const handleQuickSearch = useCallback((movieId: number) => {
        return data.triggerAutoSearch([movieId]);
    }, [data]);

    const fetchFirstPage = useCallback(() => {
        if (showMissing) data.refreshMissing();
        if (showUpgrades) data.refreshCutoff();
    }, [data, showMissing, showUpgrades]);

    const showNeedsAttention = showMissing || showUpgrades;

    // ResizeObserver for auto layout detection (same pattern as Sonarr/Overseerr)
    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
    const roRef = useRef<ResizeObserver | null>(null);
    const wrapperRef = useCallback((node: HTMLDivElement | null) => {
        if (roRef.current) {
            roRef.current.disconnect();
            roRef.current = null;
        }
        if (configViewMode !== 'auto' || !node) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setContainerSize({ w: width, h: height });
        });
        ro.observe(node);
        roRef.current = ro;
    }, [configViewMode]);

    // Resolve view mode: auto uses aspect ratio, others are explicit
    const isWide = configViewMode === 'column'
        || (configViewMode === 'auto' && containerSize.w > containerSize.h && containerSize.w > 0);

    const upcomingCount = data.upcoming.length;
    const missingCount = showMissing ? (data.missingCounts?.missingCount ?? 0) : 0;
    const cutoffUnmetCount = showUpgrades ? (data.missingCounts?.cutoffUnmetCount ?? 0) : 0;
    const visibleMissingMovies = showMissing ? data.missingMovies : [];
    const visibleCutoffMovies = showUpgrades ? data.cutoffMovies : [];

    // Header chips (spec §1.2, extended) — the single consolidated urgency
    // summary for the whole widget. Cinema/missing read the display info
    // already computed by useRadarrData; downloading is a live count from the
    // (unpaginated) queue SSE feed, so it's always accurate regardless of how
    // many Needs Attention pages are currently loaded.
    const cinemaCount = useMemo(() => {
        return data.upcoming.filter(movie => data.upcomingDisplay.get(movie.id)?.displayType === 'cinema').length;
    }, [data.upcoming, data.upcomingDisplay]);

    const downloadingCount = useMemo(() => {
        return data.queueItems.filter(q => q.trackedDownloadState === 'downloading').length;
    }, [data.queueItems]);

    const heroMovie = data.upcoming[0];
    const restMovies = data.upcoming.slice(1);
    const heroDisplay = heroMovie ? data.upcomingDisplay.get(heroMovie.id) ?? null : null;

    return (
        <div ref={wrapperRef} className="rdr-widget">
            {/* Single consolidated summary bar — toggleable via the "Stats Bar"
             * config option. "Upcoming" always shows (even at 0) since it's an
             * overview stat; the rest are urgency signals that only appear
             * once there's actually something to flag. */}
            {showStatsBar && (
                <>
                    <HeaderChips
                        upcomingCount={upcomingCount}
                        cinemaCount={cinemaCount}
                        missingCount={missingCount}
                        cutoffUnmetCount={cutoffUnmetCount}
                        downloadingCount={downloadingCount}
                    />
                    <div className="rdr-divider" />
                </>
            )}

            {/* Body — switches between vertical stack and two-column */}
            <div className={`rdr-body ${isWide ? 'rdr-body--wide' : ''}`}>
                {/* Upcoming Column — Hero card + mini poster scroll */}
                {data.upcoming.length > 0 && heroMovie && (
                    <div className={`rdr-body-col ${isWide ? 'rdr-body-col--upcoming' : ''}`}>
                        <div className="rdr-section-header">Upcoming</div>
                        <HeroCard
                            movie={heroMovie}
                            integrationId={integrationId}
                            display={heroDisplay}
                            onClick={handleMovieClick}
                            compact={!isWide}
                        />
                        <UpcomingCarousel
                            movies={restMovies}
                            displayMap={data.upcomingDisplay}
                            integrationId={integrationId}
                            onMovieClick={handleMovieClick}
                            vertical={isWide}
                        />
                    </div>
                )}

                {/* Needs Attention Column — optional via config (missing / upgrades) */}
                {showNeedsAttention && (
                    <div className={`rdr-body-col ${isWide ? 'rdr-body-col--missing' : ''}`}>
                        <div className="rdr-section-header">Needs Attention</div>
                        <MissingList
                            missingMovies={visibleMissingMovies}
                            cutoffMovies={visibleCutoffMovies}
                            integrationId={integrationId}
                            missingLoading={showMissing && data.missingLoading}
                            cutoffLoading={showUpgrades && data.cutoffLoading}
                            missingHasMore={showMissing && data.missingHasMore}
                            cutoffHasMore={showUpgrades && data.cutoffHasMore}
                            onLoadMoreMissing={data.loadMoreMissing}
                            onLoadMoreCutoff={data.loadMoreCutoff}
                            onMovieClick={handleMovieClick}
                            onQuickSearch={handleQuickSearch}
                            queueItems={data.queueItems}
                            autoFetch
                            fetchFirstPage={fetchFirstPage}
                            userIsAdmin={userIsAdmin}
                        />
                    </div>
                )}
            </div>

            {/* Movie Detail Modal */}
            <MovieDetailModal
                movie={selectedMovie}
                integrationId={integrationId}
                open={modalOpen}
                onOpenChange={setModalOpen}
                triggerAutoSearch={data.triggerAutoSearch}
                searchReleases={data.searchReleases}
                grabRelease={data.grabRelease}
                userIsAdmin={userIsAdmin}
            />
        </div>
    );
}

// ============================================================================
// MAIN WIDGET
// ============================================================================

interface RadarrConfig {
    integrationId?: string;
    viewMode?: 'auto' | 'stacked' | 'column';
    showStatsBar?: string;
    sortBy?: RadarrSortBy;
    lookAheadDays?: string;
    showCinema?: boolean;
    showDigital?: boolean;
    showPhysical?: boolean;
    showMissing?: boolean;
    showUpgrades?: boolean;
    [key: string]: unknown;
}

export type RadarrWidgetProps = WidgetProps;

const RadarrWidget = ({ widget, previewMode = false }: RadarrWidgetProps): React.JSX.Element => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound
    const config = widget.config as RadarrConfig | undefined;
    const configuredIntegrationId = config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';
    const showStatsBar = config?.showStatsBar !== 'false';
    const sortBy: RadarrSortBy = config?.sortBy ?? 'nextDate';
    const lookAheadDaysRaw = config?.lookAheadDays ?? '30';
    const lookAheadDays = lookAheadDaysRaw === 'all' ? 'all' : Number(lookAheadDaysRaw) || 30;
    const showCinema = config?.showCinema !== false;
    const showDigital = config?.showDigital !== false;
    const showPhysical = config?.showPhysical !== false;
    const showMissing = config?.showMissing !== false;
    const showUpgrades = config?.showUpgrades !== false;
    // Stable reference across renders (unless a flag actually flips) — useRadarrData
    // depends on this object identity to know when to re-derive the upcoming list.
    const visibility: ReleaseTypeVisibility = useMemo(
        () => ({ showCinema, showDigital, showPhysical }),
        [showCinema, showDigital, showPhysical]
    );

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('radarr', configuredIntegrationId, previewMode ? undefined : widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const handleRetry = useRetryPoll(integrationId, 'radarr');

    // Data hook — manages all SSE subscriptions and fetching
    const data = useRadarrData({
        integrationId: previewMode ? undefined : integrationId,
        enabled: !previewMode && isIntegrationBound,
        sortBy,
        lookAheadDays,
        visibility,
    });

    // Handle access states
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Radarr" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Radarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Radarr" isAdmin={userIsAdmin} />;
    }

    // Loading state
    if ((data.calendarLoading && data.upcoming.length === 0) || (!data.calendarConnected && data.upcoming.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Error state
    if (data.error) {
        const isUnavailable = data.error.includes('unavailable') || data.error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isUnavailable ? 'unavailable' : 'error'}
                serviceName="Radarr"
                instanceName={isUnavailable ? effectiveDisplayName : undefined}
                message={isUnavailable ? undefined : data.error}
                onRetry={isUnavailable ? handleRetry : undefined}
            />
        );
    }

    // Everyone sees the same view — non-admins get read-only (no click actions)
    return (
        <AdminView
            integrationId={integrationId!}
            data={data}
            viewMode={configViewMode}
            showStatsBar={showStatsBar}
            userIsAdmin={userIsAdmin}
            showMissing={showMissing}
            showUpgrades={showUpgrades}
        />
    );
};

export default RadarrWidget;
