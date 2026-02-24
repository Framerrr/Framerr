/**
 * Sonarr Widget
 * 
 * Redesigned TV show management widget with:
 * - Admin view: Stats bar + upcoming carousel + missing list
 * - User view: Upcoming poster grid
 * - Preview mode: Mock data display
 */

import React, { useState, useCallback, useRef } from 'react';
import { CalendarDays, AlertTriangle, MonitorPlay } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { useSonarrData } from './hooks/useSonarrData';
import UpcomingCarousel from './components/UpcomingCarousel';
import MissingList from './components/MissingList';
import EpisodeDetailModal from './components/EpisodeDetailModal';
import type { WidgetProps } from '../types';
import type { CalendarEpisode, WantedEpisode } from './sonarr.types';
import './styles.css';

// ============================================================================
// PREVIEW MODE
// ============================================================================

const PREVIEW_EPISODES = [
    { id: 1, seriesTitle: 'The Last of Us', title: 'TBA', seasonNumber: 2, episodeNumber: 3, airDate: '2025-01-19' },
    { id: 2, seriesTitle: 'House of Dragon', title: 'TBA', seasonNumber: 3, episodeNumber: 1, airDate: '2025-06-15' },
    { id: 3, seriesTitle: 'The Bear', title: 'TBA', seasonNumber: 4, episodeNumber: 1, airDate: '2025-06-22' },
    { id: 4, seriesTitle: 'Severance', title: 'TBA', seasonNumber: 2, episodeNumber: 6, airDate: '2025-02-14' },
    { id: 5, seriesTitle: 'Wednesday', title: 'TBA', seasonNumber: 2, episodeNumber: 1, airDate: '2025-08-01' },
];

function PreviewMode(): React.JSX.Element {
    return (
        <div className="snr-widget">
            {/* Stats bar mock */}
            <div className="snr-stats-bar">
                <span className="snr-stats-item">
                    <CalendarDays size={14} className="snr-stats-icon" style={{ color: 'var(--accent)' }} />
                    <span className="snr-stats-value">5</span> upcoming
                </span>
                <span className="snr-stats-item">
                    <AlertTriangle size={14} className="snr-stats-icon" style={{ color: 'var(--warning)' }} />
                    <span className="snr-stats-value">3</span> missing
                </span>
            </div>

            {/* Preview list */}
            <div className="snr-section-header">Upcoming</div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {PREVIEW_EPISODES.map(ep => (
                    <div key={`preview-${ep.id}`} className="snr-missing-item" style={{ cursor: 'default' }}>
                        <div className="snr-missing-poster-placeholder">
                            <MonitorPlay size={14} />
                        </div>
                        <div className="snr-missing-info">
                            <span className="snr-missing-series">{ep.seriesTitle}</span>
                            <span className="snr-missing-episode">
                                S{ep.seasonNumber}E{ep.episodeNumber} · {ep.airDate}
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
    data: ReturnType<typeof useSonarrData>;
    viewMode: 'auto' | 'stacked' | 'column';
    showStatsBar: boolean;
    userIsAdmin: boolean;
}

function AdminView({ integrationId, data, viewMode: configViewMode, showStatsBar, userIsAdmin }: AdminViewProps): React.JSX.Element {
    const [selectedEpisode, setSelectedEpisode] = useState<WantedEpisode | CalendarEpisode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleEpisodeClick = useCallback((episode: WantedEpisode | CalendarEpisode) => {
        setSelectedEpisode(episode);
        setModalOpen(true);
    }, []);

    const fetchFirstPage = useCallback(() => {
        // Reset to page 1 (not append to current page)
        data.refreshMissing();
    }, [data.refreshMissing]);

    // ResizeObserver for auto layout detection (same pattern as Overseerr)
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
        <div ref={wrapperRef} className="snr-widget">
            {/* Stats Bar — toggleable via config */}
            {showStatsBar && (
                <>
                    <div className="snr-stats-bar">
                        <span className="snr-stats-item">
                            <CalendarDays size={14} className="snr-stats-icon" style={{ color: 'var(--accent)' }} />
                            <span className="snr-stats-value">{upcomingCount}</span> upcoming
                        </span>
                        {missingCount > 0 && (
                            <span className="snr-stats-item">
                                <AlertTriangle size={14} className="snr-stats-icon" style={{ color: 'var(--warning)' }} />
                                <span className="snr-stats-value">{missingCount}</span> missing
                            </span>
                        )}
                    </div>
                    <div className="snr-divider" />
                </>
            )}

            {/* Body — switches between vertical stack and two-column */}
            <div className={`snr-body ${isWide ? 'snr-body--wide' : ''}`}>
                {/* Upcoming Column */}
                {data.upcoming.length > 0 && (
                    <div className={`snr-body-col ${isWide ? 'snr-body-col--upcoming' : ''}`}>
                        <div className="snr-section-header">Upcoming</div>
                        <UpcomingCarousel
                            episodes={data.upcoming}
                            integrationId={integrationId}
                            onEpisodeClick={handleEpisodeClick}
                            vertical={isWide}
                        />
                    </div>
                )}

                {/* Missing Column */}
                <div className={`snr-body-col ${isWide ? 'snr-body-col--missing' : ''}`}>
                    <div className="snr-section-header">Missing</div>
                    <MissingList
                        episodes={data.missingEpisodes}
                        integrationId={integrationId}
                        loading={data.missingLoading}
                        hasMore={data.missingHasMore}
                        onLoadMore={data.loadMoreMissing}
                        onEpisodeClick={handleEpisodeClick}
                        queueItems={data.queueItems}
                        autoFetch
                        fetchFirstPage={fetchFirstPage}
                    />
                </div>
            </div>

            {/* Episode Detail Modal */}
            <EpisodeDetailModal
                episode={selectedEpisode}
                integrationId={integrationId}
                open={modalOpen}
                onOpenChange={setModalOpen}
                upcomingEpisodes={data.upcoming}
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

interface SonarrConfig {
    integrationId?: string;
    viewMode?: 'auto' | 'stacked' | 'column';
    showStatsBar?: string;
    [key: string]: unknown;
}

export interface SonarrWidgetProps extends WidgetProps {
    // No additional props needed
}

const SonarrWidget = ({ widget, previewMode = false }: SonarrWidgetProps): React.JSX.Element => {
    // Preview mode: skip all data fetching and show mock data
    if (previewMode) {
        return <PreviewMode />;
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound
    const config = widget.config as SonarrConfig | undefined;
    const configuredIntegrationId = config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';
    const showStatsBar = config?.showStatsBar !== 'false';

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('sonarr', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Data hook — manages all SSE subscriptions and fetching
    const data = useSonarrData({
        integrationId,
        enabled: isIntegrationBound,
    });

    // Handle access states
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Sonarr" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Sonarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Sonarr" isAdmin={userIsAdmin} />;
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
                serviceName="Sonarr"
                instanceName={isUnavailable ? effectiveDisplayName : undefined}
                message={isUnavailable ? undefined : data.error}
            />
        );
    }

    // Everyone sees the same view — non-admins get read-only (no click actions)
    return <AdminView integrationId={integrationId!} data={data} viewMode={configViewMode} showStatsBar={showStatsBar} userIsAdmin={userIsAdmin} />;
};

export default SonarrWidget;
