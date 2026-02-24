/**
 * Radarr Widget
 * 
 * Movie management widget with:
 * - Admin view: Stats bar + upcoming carousel + missing list
 * - User view: Upcoming poster grid
 * - Preview mode: Mock data display
 */

import React, { useState, useCallback, useRef } from 'react';
import { Film, CalendarDays, AlertTriangle } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { useRadarrData } from './hooks/useRadarrData';
import UpcomingCarousel from './components/UpcomingCarousel';
import MissingList from './components/MissingList';
import MovieDetailModal from './components/MovieDetailModal';
import type { WidgetProps } from '../types';
import type { CalendarMovie, WantedMovie } from './radarr.types';
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
            {/* Stats bar mock */}
            <div className="rdr-stats-bar">
                <span className="rdr-stats-item">
                    <CalendarDays size={14} className="rdr-stats-icon" style={{ color: 'var(--accent)' }} />
                    <span className="rdr-stats-value">5</span> upcoming
                </span>
                <span className="rdr-stats-item">
                    <AlertTriangle size={14} className="rdr-stats-icon" style={{ color: 'var(--warning)' }} />
                    <span className="rdr-stats-value">3</span> missing
                </span>
            </div>

            {/* Preview list */}
            <div className="rdr-section-header">Upcoming</div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {PREVIEW_MOVIES.map(movie => (
                    <div key={`preview-${movie.id}`} className="rdr-missing-item" style={{ cursor: 'default' }}>
                        <div className="rdr-missing-poster-placeholder">
                            <Film size={14} />
                        </div>
                        <div className="rdr-missing-info">
                            <span className="rdr-missing-series">{movie.title}</span>
                            <span className="rdr-missing-episode">
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
// ADMIN VIEW - Stats bar + Carousel + Missing list
// ============================================================================


interface AdminViewProps {
    integrationId: string;
    data: ReturnType<typeof useRadarrData>;
    viewMode: 'auto' | 'stacked' | 'column';
    showStatsBar: boolean;
    userIsAdmin: boolean;
}

function AdminView({ integrationId, data, viewMode: configViewMode, showStatsBar, userIsAdmin }: AdminViewProps): React.JSX.Element {
    const [selectedMovie, setSelectedMovie] = useState<WantedMovie | CalendarMovie | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleMovieClick = useCallback((movie: WantedMovie | CalendarMovie) => {
        setSelectedMovie(movie);
        setModalOpen(true);
    }, []);

    const fetchFirstPage = useCallback(() => {
        data.refreshMissing();
    }, [data.refreshMissing]);

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
    const missingCount = data.missingCounts?.missingCount ?? 0;

    return (
        <div ref={wrapperRef} className="rdr-widget">
            {/* Stats Bar — toggleable via config */}
            {showStatsBar && (
                <>
                    <div className="rdr-stats-bar">
                        <span className="rdr-stats-item">
                            <CalendarDays size={14} className="rdr-stats-icon" style={{ color: 'var(--accent)' }} />
                            <span className="rdr-stats-value">{upcomingCount}</span> upcoming
                        </span>
                        {missingCount > 0 && (
                            <span className="rdr-stats-item">
                                <AlertTriangle size={14} className="rdr-stats-icon" style={{ color: 'var(--warning)' }} />
                                <span className="rdr-stats-value">{missingCount}</span> missing
                            </span>
                        )}
                    </div>
                    <div className="rdr-divider" />
                </>
            )}

            {/* Body — switches between vertical stack and two-column */}
            <div className={`rdr-body ${isWide ? 'rdr-body--wide' : ''}`}>
                {/* Upcoming Column */}
                {data.upcoming.length > 0 && (
                    <div className={`rdr-body-col ${isWide ? 'rdr-body-col--upcoming' : ''}`}>
                        <div className="rdr-section-header">Upcoming</div>
                        <UpcomingCarousel
                            movies={data.upcoming}
                            integrationId={integrationId}
                            onMovieClick={handleMovieClick}
                            vertical={isWide}
                        />
                    </div>
                )}

                {/* Missing Column */}
                <div className={`rdr-body-col ${isWide ? 'rdr-body-col--missing' : ''}`}>
                    <div className="rdr-section-header">Missing</div>
                    <MissingList
                        movies={data.missingMovies}
                        integrationId={integrationId}
                        loading={data.missingLoading}
                        hasMore={data.missingHasMore}
                        onLoadMore={data.loadMoreMissing}
                        onMovieClick={handleMovieClick}
                        queueItems={data.queueItems}
                        autoFetch
                        fetchFirstPage={fetchFirstPage}
                    />
                </div>
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
    [key: string]: unknown;
}

export interface RadarrWidgetProps extends WidgetProps {
    // No additional props needed
}

const RadarrWidget = ({ widget, previewMode = false }: RadarrWidgetProps): React.JSX.Element => {
    // Preview mode: skip all data fetching and show mock data
    if (previewMode) {
        return <PreviewMode />;
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound
    const config = widget.config as RadarrConfig | undefined;
    const configuredIntegrationId = config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';
    const showStatsBar = config?.showStatsBar !== 'false';

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('radarr', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Data hook — manages all SSE subscriptions and fetching
    const data = useRadarrData({
        integrationId,
        enabled: isIntegrationBound,
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
            />
        );
    }

    // Everyone sees the same view — non-admins get read-only (no click actions)
    return <AdminView integrationId={integrationId!} data={data} viewMode={configViewMode} showStatsBar={showStatsBar} userIsAdmin={userIsAdmin} />;
};

export default RadarrWidget;
