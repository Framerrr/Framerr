/**
 * Lidarr Widget
 *
 * Redesigned music library management widget with:
 * - Admin view: Consolidated summary bar + 1:1 upcoming carousel + Needs Attention
 * - Preview mode: Mock data display
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { CalendarDays, AlertTriangle, ArrowUpCircle, Download, Music } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useRetryPoll } from '../../shared/widgets/hooks';
import { useAuth } from '../../context/useAuth';
import { isAdmin } from '../../utils/permissions';
import { useLidarrData } from './hooks/useLidarrData';
import { resolveQueueSeverity } from '../_shared/media/queueSeverity';
import UpcomingCarousel from './components/UpcomingCarousel';
import MissingList from './components/MissingList';
import AlbumDetailModal from './components/AlbumDetailModal';
import type { WidgetProps } from '../types';
import type { CalendarAlbum, WantedAlbum } from './lidarr.types';
import './styles.css';

// ============================================================================
// PREVIEW MODE
// ============================================================================

const PREVIEW_ALBUMS = [
    { id: 1, artistName: 'Taylor Swift', title: 'The Tortured Poets Department', albumType: 'Album', releaseDate: '2025-04-19' },
    { id: 2, artistName: 'Kendrick Lamar', title: 'Untitled', albumType: 'Album', releaseDate: '2025-06-15' },
    { id: 3, artistName: 'Radiohead', title: 'New Material', albumType: 'Album', releaseDate: '2025-06-22' },
    { id: 4, artistName: 'Björk', title: 'Cornucopia Live', albumType: 'Album', releaseDate: '2025-02-14' },
    { id: 5, artistName: 'Daft Punk', title: 'Archive', albumType: 'Album', releaseDate: '2025-08-01' },
];

function PreviewMode(): React.JSX.Element {
    return (
        <div className="ldr-widget">
            <div className="ldr-header-chips">
                <span className="ldr-header-chip ldr-header-chip--upcoming">
                    <CalendarDays size={11} /> 5 upcoming
                </span>
                <span className="ldr-header-chip ldr-header-chip--missing">
                    <AlertTriangle size={11} /> 3 missing
                </span>
            </div>

            <div className="ldr-section-header">Upcoming</div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {PREVIEW_ALBUMS.map(album => (
                    <div key={`preview-${album.id}`} className="ldr-missing-item" style={{ cursor: 'default' }}>
                        <div className="ldr-missing-poster-placeholder">
                            <Music size={14} />
                        </div>
                        <div className="ldr-missing-info">
                            <span className="ldr-missing-series">{album.title}</span>
                            <span className="ldr-missing-episode">
                                {album.artistName} · {album.releaseDate}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface AdminViewProps {
    integrationId: string;
    data: ReturnType<typeof useLidarrData>;
    viewMode: 'auto' | 'stacked' | 'column';
    showStatsBar: boolean;
    userIsAdmin: boolean;
    showAlbumType: boolean;
    showMissing: boolean;
    showUpgrades: boolean;
}

function AdminView({
    integrationId,
    data,
    viewMode: configViewMode,
    showStatsBar,
    userIsAdmin,
    showAlbumType,
    showMissing,
    showUpgrades,
}: AdminViewProps): React.JSX.Element {
    const [selectedAlbum, setSelectedAlbum] = useState<WantedAlbum | CalendarAlbum | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleAlbumClick = useCallback((album: WantedAlbum | CalendarAlbum) => {
        setSelectedAlbum(album);
        setModalOpen(true);
    }, []);

    const handleQuickSearch = useCallback((albumId: number) => {
        return data.triggerAutoSearch([albumId]);
    }, [data]);

    const fetchFirstPage = useCallback(() => {
        if (showMissing) data.refreshMissing();
        if (showUpgrades) data.refreshCutoff();
    }, [data, showMissing, showUpgrades]);

    const showNeedsAttention = showMissing || showUpgrades;

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

    const isWide = configViewMode === 'column'
        || (configViewMode === 'auto' && containerSize.w > containerSize.h && containerSize.w > 0);

    const upcomingCount = data.upcoming.length;
    const missingCount = showMissing ? (data.missingCounts?.missingCount ?? 0) : 0;
    const cutoffUnmetCount = showUpgrades ? (data.missingCounts?.cutoffUnmetCount ?? 0) : 0;
    const visibleMissingAlbums = showMissing ? data.missingAlbums : [];
    const visibleCutoffAlbums = showUpgrades ? data.cutoffAlbums : [];

    const downloadingCount = useMemo(() => {
        return data.queueItems.filter(q => resolveQueueSeverity(q).severity === 'downloading').length;
    }, [data.queueItems]);

    return (
        <div ref={wrapperRef} className="ldr-widget">
            {showStatsBar && (
                <>
                    <div className="ldr-header-chips">
                        <span className="ldr-header-chip ldr-header-chip--upcoming">
                            <CalendarDays size={11} /> {upcomingCount} upcoming
                        </span>
                        {missingCount > 0 && (
                            <span className="ldr-header-chip ldr-header-chip--missing">
                                <AlertTriangle size={11} /> {missingCount} missing
                            </span>
                        )}
                        {cutoffUnmetCount > 0 && (
                            <span className="ldr-header-chip ldr-header-chip--upgrade">
                                <ArrowUpCircle size={11} /> {cutoffUnmetCount} upgrade
                            </span>
                        )}
                        {downloadingCount > 0 && (
                            <span className="ldr-header-chip ldr-header-chip--downloading">
                                <Download size={11} /> {downloadingCount} downloading
                            </span>
                        )}
                    </div>
                    <div className="ldr-divider" />
                </>
            )}

            <div className={`ldr-body ${isWide ? 'ldr-body--wide' : ''}`}>
                {data.upcoming.length > 0 && (
                    <div className={`ldr-body-col ${isWide ? 'ldr-body-col--upcoming' : ''}`}>
                        <div className="ldr-section-header">Upcoming</div>
                        <UpcomingCarousel
                            albums={data.upcoming}
                            integrationId={integrationId}
                            onAlbumClick={handleAlbumClick}
                            vertical={isWide}
                            showAlbumType={showAlbumType}
                        />
                    </div>
                )}

                {showNeedsAttention && (
                    <div className={`ldr-body-col ${isWide ? 'ldr-body-col--missing' : ''}`}>
                        <div className="ldr-section-header">Needs Attention</div>
                        <MissingList
                            missingAlbums={visibleMissingAlbums}
                            cutoffAlbums={visibleCutoffAlbums}
                            integrationId={integrationId}
                            missingLoading={showMissing && data.missingLoading}
                            cutoffLoading={showUpgrades && data.cutoffLoading}
                            missingHasMore={showMissing && data.missingHasMore}
                            cutoffHasMore={showUpgrades && data.cutoffHasMore}
                            onLoadMoreMissing={data.loadMoreMissing}
                            onLoadMoreCutoff={data.loadMoreCutoff}
                            onAlbumClick={handleAlbumClick}
                            onQuickSearch={handleQuickSearch}
                            queueItems={data.queueItems}
                            autoFetch
                            fetchFirstPage={fetchFirstPage}
                            showAlbumType={showAlbumType}
                            userIsAdmin={userIsAdmin}
                        />
                    </div>
                )}
            </div>

            <AlbumDetailModal
                album={selectedAlbum}
                integrationId={integrationId}
                open={modalOpen}
                onOpenChange={setModalOpen}
                upcomingAlbums={data.upcoming}
                triggerAutoSearch={data.triggerAutoSearch}
                searchReleases={data.searchReleases}
                grabRelease={data.grabRelease}
                userIsAdmin={userIsAdmin}
            />
        </div>
    );
}

interface LidarrConfig {
    integrationId?: string;
    viewMode?: 'auto' | 'stacked' | 'column';
    showStatsBar?: string;
    lookAheadDays?: string;
    showAlbumType?: boolean;
    showMissing?: boolean;
    showUpgrades?: boolean;
    [key: string]: unknown;
}

export type LidarrWidgetProps = WidgetProps;

const LidarrWidget = ({ widget, previewMode = false }: LidarrWidgetProps): React.JSX.Element => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const config = widget.config as LidarrConfig | undefined;
    const configuredIntegrationId = config?.forceClearIntegration ? null : config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';
    const showStatsBar = config?.showStatsBar !== 'false';
    const lookAheadDaysRaw = config?.lookAheadDays ?? '30';
    const lookAheadDays = lookAheadDaysRaw === 'all' ? 'all' : Number(lookAheadDaysRaw) || 30;
    const showAlbumType = config?.showAlbumType !== false;
    const showMissing = config?.showMissing !== false;
    const showUpgrades = config?.showUpgrades !== false;

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('lidarr', configuredIntegrationId, previewMode ? undefined : widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const handleRetry = useRetryPoll(integrationId, 'lidarr');

    const data = useLidarrData({
        integrationId: previewMode ? undefined : integrationId,
        enabled: !previewMode && isIntegrationBound,
        lookAheadDays,
    });

    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Lidarr" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Lidarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Lidarr" isAdmin={userIsAdmin} />;
    }

    if ((data.calendarLoading && data.upcoming.length === 0) || (!data.calendarConnected && data.upcoming.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (data.error) {
        const isUnavailable = data.error.includes('unavailable') || data.error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isUnavailable ? 'unavailable' : 'error'}
                serviceName="Lidarr"
                instanceName={isUnavailable ? effectiveDisplayName : undefined}
                message={isUnavailable ? undefined : data.error}
                onRetry={isUnavailable ? handleRetry : undefined}
            />
        );
    }

    return (
        <AdminView
            integrationId={integrationId!}
            data={data}
            viewMode={configViewMode}
            showStatsBar={showStatsBar}
            userIsAdmin={userIsAdmin}
            showAlbumType={showAlbumType}
            showMissing={showMissing}
            showUpgrades={showUpgrades}
        />
    );
};

export default LidarrWidget;
