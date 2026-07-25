/**
 * Sonarr Widget
 * 
 * Redesigned TV show management widget with:
 * - Admin view: Consolidated summary bar + Hero/mini-scroll upcoming + Needs Attention
 * - User view: Upcoming poster grid
 * - Preview mode: Mock data display
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { CalendarDays, AlertTriangle, Circle, ArrowUpCircle, Download, MonitorPlay } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useRetryPoll } from '../../shared/widgets/hooks';
import { useAuth } from '../../context/useAuth';
import { isAdmin } from '../../utils/permissions';
import { useSonarrData } from './hooks/useSonarrData';
import { getPremiereType } from './hooks/sonarrDisplayState';
import { resolveQueueSeverity } from '../_shared/media/queueSeverity';
import HeroCard from './components/HeroCard';
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
            {/* Header chips mock */}
            <div className="snr-header-chips">
                <span className="snr-header-chip snr-header-chip--upcoming">
                    <CalendarDays size={11} /> 5 upcoming
                </span>
                <span className="snr-header-chip snr-header-chip--missing">
                    <AlertTriangle size={11} /> 3 missing
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
// ADMIN VIEW - Summary bar + Hero/mini-scroll + Needs Attention
// ============================================================================


interface AdminViewProps {
    integrationId: string;
    data: ReturnType<typeof useSonarrData>;
    viewMode: 'auto' | 'stacked' | 'column';
    showStatsBar: boolean;
    userIsAdmin: boolean;
    showNetwork: boolean;
    showSeasonProgress: boolean;
    highlightPremieres: boolean;
    showMissing: boolean;
    showUpgrades: boolean;
}

function AdminView({
    integrationId,
    data,
    viewMode: configViewMode,
    showStatsBar,
    userIsAdmin,
    showNetwork,
    showSeasonProgress,
    highlightPremieres,
    showMissing,
    showUpgrades,
}: AdminViewProps): React.JSX.Element {
    const [selectedEpisode, setSelectedEpisode] = useState<WantedEpisode | CalendarEpisode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleEpisodeClick = useCallback((episode: WantedEpisode | CalendarEpisode) => {
        setSelectedEpisode(episode);
        setModalOpen(true);
    }, []);

    const handleQuickSearch = useCallback((episodeId: number) => {
        return data.triggerAutoSearch([episodeId]);
    }, [data]);

    const fetchFirstPage = useCallback(() => {
        if (showMissing) data.refreshMissing();
        if (showUpgrades) data.refreshCutoff();
    }, [data, showMissing, showUpgrades]);

    const showNeedsAttention = showMissing || showUpgrades;

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
    const missingCount = showMissing ? (data.missingCounts?.missingCount ?? 0) : 0;
    const cutoffUnmetCount = showUpgrades ? (data.missingCounts?.cutoffUnmetCount ?? 0) : 0;
    const visibleMissingEpisodes = showMissing ? data.missingEpisodes : [];
    const visibleCutoffEpisodes = showUpgrades ? data.cutoffEpisodes : [];

    // Consolidated summary bar (matches Radarr's shipped `.rdr-header-chips`
    // pattern) — "upcoming" always shows (even at 0); the rest are urgency
    // signals that only appear once there's actually something to flag.
    const premiereCount = useMemo(() => {
        return data.upcoming.filter(ep => getPremiereType(ep) !== null).length;
    }, [data.upcoming]);

    const downloadingCount = useMemo(() => {
        return data.queueItems.filter(q => resolveQueueSeverity(q).severity === 'downloading').length;
    }, [data.queueItems]);

    const heroEpisode = data.upcoming[0];
    const restEpisodes = data.upcoming.slice(1);

    return (
        <div ref={wrapperRef} className="snr-widget">
            {/* Summary Bar — toggleable via config */}
            {showStatsBar && (
                <>
                    <div className="snr-header-chips">
                        <span className="snr-header-chip snr-header-chip--upcoming">
                            <CalendarDays size={11} /> {upcomingCount} upcoming
                        </span>
                        {premiereCount > 0 && (
                            <span className="snr-header-chip snr-header-chip--premiere">
                                <Circle size={9} fill="currentColor" /> {premiereCount} premiering
                            </span>
                        )}
                        {missingCount > 0 && (
                            <span className="snr-header-chip snr-header-chip--missing">
                                <AlertTriangle size={11} /> {missingCount} missing
                            </span>
                        )}
                        {cutoffUnmetCount > 0 && (
                            <span className="snr-header-chip snr-header-chip--upgrade">
                                <ArrowUpCircle size={11} /> {cutoffUnmetCount} upgrade
                            </span>
                        )}
                        {downloadingCount > 0 && (
                            <span className="snr-header-chip snr-header-chip--downloading">
                                <Download size={11} /> {downloadingCount} downloading
                            </span>
                        )}
                    </div>
                    <div className="snr-divider" />
                </>
            )}

            {/* Body — switches between vertical stack and two-column */}
            <div className={`snr-body ${isWide ? 'snr-body--wide' : ''}`}>
                {/* Upcoming Column — Hero card + mini poster scroll */}
                {data.upcoming.length > 0 && heroEpisode && (
                    <div className={`snr-body-col ${isWide ? 'snr-body-col--upcoming' : ''}`}>
                        <div className="snr-section-header">Upcoming</div>
                        <HeroCard
                            episode={heroEpisode}
                            integrationId={integrationId}
                            onClick={handleEpisodeClick}
                            compact={!isWide}
                            showNetwork={showNetwork}
                            highlightPremieres={highlightPremieres}
                            showSeasonProgress={showSeasonProgress}
                        />
                        <UpcomingCarousel
                            episodes={restEpisodes}
                            integrationId={integrationId}
                            onEpisodeClick={handleEpisodeClick}
                            vertical={isWide}
                            highlightPremieres={highlightPremieres}
                            showNetwork={showNetwork}
                        />
                    </div>
                )}

                {/* Needs Attention Column — optional via config (missing / upgrades) */}
                {showNeedsAttention && (
                    <div className={`snr-body-col ${isWide ? 'snr-body-col--missing' : ''}`}>
                        <div className="snr-section-header">Needs Attention</div>
                        <MissingList
                            missingEpisodes={visibleMissingEpisodes}
                            cutoffEpisodes={visibleCutoffEpisodes}
                            integrationId={integrationId}
                            missingLoading={showMissing && data.missingLoading}
                            cutoffLoading={showUpgrades && data.cutoffLoading}
                            missingHasMore={showMissing && data.missingHasMore}
                            cutoffHasMore={showUpgrades && data.cutoffHasMore}
                            onLoadMoreMissing={data.loadMoreMissing}
                            onLoadMoreCutoff={data.loadMoreCutoff}
                            onEpisodeClick={handleEpisodeClick}
                            onQuickSearch={handleQuickSearch}
                            queueItems={data.queueItems}
                            autoFetch
                            fetchFirstPage={fetchFirstPage}
                            showNetwork={showNetwork}
                            userIsAdmin={userIsAdmin}
                        />
                    </div>
                )}
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
    lookAheadDays?: string;
    showNetwork?: boolean;
    showSeasonProgress?: boolean;
    highlightPremieres?: boolean;
    showMissing?: boolean;
    showUpgrades?: boolean;
    [key: string]: unknown;
}

export type SonarrWidgetProps = WidgetProps;

const SonarrWidget = ({ widget, previewMode = false }: SonarrWidgetProps): React.JSX.Element => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound
    const config = widget.config as SonarrConfig | undefined;
    const configuredIntegrationId = config?.forceClearIntegration ? null : config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';
    const showStatsBar = config?.showStatsBar !== 'false';
    const lookAheadDaysRaw = config?.lookAheadDays ?? '30';
    const lookAheadDays = lookAheadDaysRaw === 'all' ? 'all' : Number(lookAheadDaysRaw) || 30;
    const showNetwork = config?.showNetwork !== false;
    const showSeasonProgress = config?.showSeasonProgress !== false;
    const highlightPremieres = config?.highlightPremieres !== false;
    const showMissing = config?.showMissing !== false;
    const showUpgrades = config?.showUpgrades !== false;

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('sonarr', configuredIntegrationId, previewMode ? undefined : widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const handleRetry = useRetryPoll(integrationId, 'sonarr');

    // Data hook — manages all SSE subscriptions and fetching
    const data = useSonarrData({
        integrationId: previewMode ? undefined : integrationId,
        enabled: !previewMode && isIntegrationBound,
        lookAheadDays,
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
            showNetwork={showNetwork}
            showSeasonProgress={showSeasonProgress}
            highlightPremieres={highlightPremieres}
            showMissing={showMissing}
            showUpgrades={showUpgrades}
        />
    );
};

export default SonarrWidget;
