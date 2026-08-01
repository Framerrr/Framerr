import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/client';
import { Star, Calendar, Clock, User, Check, XCircle } from 'lucide-react';
import {
    Modal,
    Button,
    MediaPoster,
    MediaHeroCol,
    MediaTypeBadge,
    MediaSectionHeading,
    MediaSynopsis,
    MediaGenres,
    MediaPeople,
    MediaCast,
} from '../../../shared/ui';
import { useMediaServerMeta } from '../../../shared/hooks/useMediaServerMeta';
import { openMediaInApp } from '../../../shared/utils/mediaDeepLinks';
import { getIconComponent } from '../../../utils/iconUtils';
import { ExternalMediaLinks } from '../../../shared/ui/ExternalMediaLinks';
import { useAuth } from '../../../context/useAuth';
import { isAdmin } from '../../../utils/permissions';
import logger from '../../../utils/logger';
import type { MediaRequest, InstanceDownload, DownloadInfoMulti, QueueItem } from '../types';

interface RequestInfoModalProps {
    request: MediaRequest;
    downloadInfo: DownloadInfoMulti | null;
    integrationId: string;
    /** Queue data passed from parent widget for live download progress */
    sonarrQueue?: QueueItem[];
    radarrQueue?: QueueItem[];
    onClose: () => void;
}

// API response types
interface RequestDetails {
    request: {
        id: number;
        status: number;
        type: 'movie' | 'tv';
        createdAt?: string;
        requestedBy?: {
            id: number;
            displayName?: string;
            avatar?: string;
        };
        mediaStatus?: number;
        seasons?: Array<{
            seasonNumber: number;
            status: number;
        }>;
        media?: {
            ratingKey?: string;
            jellyfinMediaId?: string;
        };
    };
    tmdb: {
        title?: string;
        posterPath?: string;
        backdropPath?: string;
        overview?: string;
        releaseDate?: string;
        rating?: number;
        genres?: string[];
        runtime?: number;
        status?: string;
        tagline?: string;
        numberOfSeasons?: number;
        imdbId?: string | null;
        directors?: string[];
        cast?: Array<{ name: string; character?: string; profilePath?: string }>;
        productionCompanies?: string[];
        networks?: string[];
    } | null;
    // All seasons merged across ALL requests for this media (from backend enrichment)
    allSeasons?: Array<{
        seasonNumber: number;
        status: number;
    }>;
    mediaServer?: { type: 'plex' | 'jellyfin'; integrationId: string } | null;
}

const RequestInfoModal: React.FC<RequestInfoModalProps> = ({
    request,
    downloadInfo: initialDownloadInfo,
    integrationId,
    sonarrQueue = [],
    radarrQueue = [],
    onClose
}) => {
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Phase 24: Queue data passed from parent widget (no direct SSE subscription)

    const [details, setDetails] = useState<RequestDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Compute live download info from WebSocket queue data (Phase 9: multi-instance)
    // Prefer initialDownloadInfo (has displayNames) over legacy queue computation
    const downloadInfo = useMemo((): DownloadInfoMulti | null => {
        // If we have initialDownloadInfo from parent widget (with displayNames), use it
        if (initialDownloadInfo && initialDownloadInfo.downloads.length > 0) {
            return initialDownloadInfo;
        }

        // Legacy fallback: compute from queue props (doesn't have displayNames)
        const tmdbId = request.media?.tmdbId;
        if (!tmdbId) return null;

        const downloads: InstanceDownload[] = [];

        if (request.type === 'movie') {
            // Check all radarr queue items for this tmdbId
            for (const item of radarrQueue) {
                if (item.movie?.tmdbId === tmdbId) {
                    downloads.push({
                        integrationId: 'radarr',
                        displayName: 'Radarr', // Fallback display name
                        progress: item.progress || 0,
                        timeLeft: item.timeleft
                    });
                }
            }
        } else if (request.type === 'tv') {
            // Aggregate by series
            const tvDownloads = sonarrQueue.filter(q => q.series?.tmdbId === tmdbId);
            if (tvDownloads.length > 0) {
                const totalSize = tvDownloads.reduce((sum, q) => sum + ((q as { size?: number }).size || 0), 0);
                const totalSizeLeft = tvDownloads.reduce((sum, q) => sum + ((q as { sizeleft?: number }).sizeleft || 0), 0);
                const combinedProgress = totalSize > 0 ? Math.round(((totalSize - totalSizeLeft) / totalSize) * 100) : 0;
                const longestTimeLeft = tvDownloads.reduce((max, q) => q.timeleft && q.timeleft > max ? q.timeleft : max, '');

                downloads.push({
                    integrationId: 'sonarr',
                    displayName: 'Sonarr', // Fallback display name
                    progress: combinedProgress,
                    timeLeft: longestTimeLeft || undefined,
                    episodeCount: tvDownloads.length
                });
            }
        }

        if (downloads.length > 0) {
            return { isDownloading: true, downloads };
        }

        return null;
    }, [request.media?.tmdbId, request.type, radarrQueue, sonarrQueue, initialDownloadInfo]);

    const mediaServerInfo = details?.mediaServer;
    const { machineIds, serverUrls, serverIds } = useMediaServerMeta(
        mediaServerInfo ? [mediaServerInfo.integrationId] : [],
        'overseerr-request-info'
    );

    // Fetch detailed request info
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const data = await api.get<RequestDetails>(
                    `/api/integrations/${integrationId}/proxy/request/${request.id}/details`,
                    { headers: { 'X-Widget-Type': 'overseerr-request-info' } }
                );
                setDetails(data);
                setError(null);
            } catch (err) {
                logger.error('Failed to fetch request details', { error: err });
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [request.id, integrationId]);

    // Handle approve/decline
    const handleAction = async (action: 'approve' | 'decline') => {
        setActionLoading(true);
        try {
            // Call the action endpoint on the integration
            await api.post(`/api/integrations/${integrationId}/actions/${action}/${request.id}`);

            // Close modal on success
            onClose();
        } catch (err) {
            logger.error(`Failed to ${action} request`, { error: err });
            setError(`Failed to ${action} request: ${(err as Error).message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Status helpers - handle all Overseerr status codes
    // MediaStatus: 1=Unknown, 2=Pending, 3=Processing, 4=Partially Available, 5=Available, 6=Deleted
    // MediaRequestStatus: 1=Pending, 2=Approved, 3=Declined, 4=Failed, 5=Completed
    const getStatusInfo = (requestStatus: number, mediaStatus?: number): { label: string; color: string } => {
        // Priority 1: Check media availability status first
        if (mediaStatus === 5) {
            return { label: 'Available', color: 'var(--success)' };
        }
        if (mediaStatus === 4) {
            return { label: 'Partial', color: 'var(--info)' };
        }
        if (mediaStatus === 6) {
            return { label: 'Deleted', color: 'var(--error)' };
        }
        // Priority 2: Check if downloading
        if (downloadInfo?.isDownloading) {
            return { label: 'Downloading', color: 'var(--info)' };
        }
        // Priority 3: Check if processing
        if (mediaStatus === 3) {
            return { label: 'Processing', color: 'var(--info)' };
        }
        // Priority 4: Fall back to request status
        switch (requestStatus) {
            case 1: return { label: 'Pending Approval', color: 'var(--warning)' };
            case 2: return { label: 'Approved', color: 'var(--success)' };
            case 3: return { label: 'Declined', color: 'var(--error)' };
            case 4: return { label: 'Failed', color: 'var(--error)' };
            case 5: return { label: 'Completed', color: 'var(--success)' };
            default: return { label: 'Unknown', color: 'var(--text-secondary)' };
        }
    };

    // Use fetched details if available, otherwise fall back to props
    const effectiveRequestStatus = details?.request?.status ?? request.status;
    const effectiveMediaStatus = details?.request?.mediaStatus ?? request.media?.status;
    const statusInfo = getStatusInfo(effectiveRequestStatus, effectiveMediaStatus);
    const isPending = effectiveRequestStatus === 1;
    const showActions = userIsAdmin && isPending;

    // Use fetched data or fall back to props
    const title = details?.tmdb?.title || request.media?.title || 'Unknown Title';
    // Prefer local cached poster, then API details, then request props
    // Primary: local cache path (fetched with credentials)
    const localCacheSrc = request.media?.localPosterPath
        ? `/api/cache/images/${request.media.localPosterPath}`
        : null;
    // Fallback: TMDB CDN (public, no auth needed)
    const cdnFallbackSrc = details?.tmdb?.posterPath
        ? `https://image.tmdb.org/t/p/w342${details.tmdb.posterPath}`
        : request.media?.posterPath
            ? `https://image.tmdb.org/t/p/w342${request.media.posterPath}`
            : null;
    const hasPoster = !!(localCacheSrc || cdnFallbackSrc);

    const mediaItemId = mediaServerInfo?.type === 'plex'
        ? details?.request?.media?.ratingKey
        : mediaServerInfo?.type === 'jellyfin'
            ? details?.request?.media?.jellyfinMediaId
            : undefined;
    const canOpenInMediaServer = !!(mediaServerInfo && mediaItemId);
    const MEDIA_SERVER_COLORS: Record<'plex' | 'jellyfin', string> = { plex: '#E5A00D', jellyfin: '#9B59B6' };
    const handleOpenInMediaServer = (): void => {
        if (!mediaServerInfo || !mediaItemId) return;
        openMediaInApp(mediaServerInfo.type, mediaItemId, {
            machineId: machineIds[mediaServerInfo.integrationId],
            serverUrl: serverUrls[mediaServerInfo.integrationId],
            serverId: serverIds[mediaServerInfo.integrationId],
        });
    };

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg" fixedHeight>
            <Modal.Header title="Request Info" />
            <Modal.Body>
                {/* Loading indicator */}
                {loading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                        <div className="w-10 h-10 border-3 border-theme border-t-accent rounded-full animate-spin" />
                        <span className="text-theme-secondary">Loading request info...</span>
                    </div>
                )}

                {/* Main content */}
                {!loading && (
                    <div className="space-y-6">
                        {/* Poster and Basic Info */}
                        <div className="media-hero">
                            <MediaPoster
                                src={hasPoster ? (localCacheSrc || cdnFallbackSrc) : null}
                                alt={title}
                                statusLabel={statusInfo.label}
                                statusColor={statusInfo.color}
                                onImgError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    if (cdnFallbackSrc && img.src !== cdnFallbackSrc) {
                                        img.src = cdnFallbackSrc;
                                    } else {
                                        img.style.display = 'none';
                                    }
                                }}
                            />

                            <MediaHeroCol>
                                <h2 className="media-hero__title">{title}</h2>

                                <MediaTypeBadge type={request.type} />

                                <div className="media-hero__meta">
                                    {details?.tmdb?.releaseDate && new Date(details.tmdb.releaseDate).getFullYear() > 0 && (
                                        <div className="media-hero__meta-item">
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{new Date(details.tmdb.releaseDate).getFullYear()}</span>
                                        </div>
                                    )}
                                    {(typeof details?.tmdb?.rating === 'number' && details.tmdb.rating > 0) ? (
                                        <div className="media-hero__meta-item">
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{details.tmdb.rating.toFixed(1)}/10</span>
                                        </div>
                                    ) : null}
                                    {(details?.tmdb?.runtime && details.tmdb.runtime > 0 && request.type === 'movie') ? (
                                        <div className="media-hero__meta-item">
                                            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{Math.floor(details.tmdb.runtime / 60)}h {details.tmdb.runtime % 60}m</span>
                                        </div>
                                    ) : null}
                                </div>

                                <ExternalMediaLinks
                                    tmdbId={request.media?.tmdbId}
                                    imdbId={details?.tmdb?.imdbId}
                                    title={title}
                                    year={
                                        details?.tmdb?.releaseDate
                                            ? new Date(details.tmdb.releaseDate).getFullYear()
                                            : undefined
                                    }
                                    mediaType={request.type}
                                />

                                {canOpenInMediaServer && (
                                    <div>
                                        <Button
                                            size="md"
                                            textSize="sm"
                                            icon={getIconComponent(`system:${mediaServerInfo!.type}`)}
                                            onClick={handleOpenInMediaServer}
                                            customColor={{ background: MEDIA_SERVER_COLORS[mediaServerInfo!.type], text: '#000' }}
                                        >
                                            Open in {mediaServerInfo!.type === 'plex' ? 'Plex' : 'Jellyfin'}
                                        </Button>
                                    </div>
                                )}

                                {/* Season Availability Visualization (for TV shows) */}
                                {request.type === 'tv' && details?.tmdb?.numberOfSeasons && details.tmdb.numberOfSeasons > 0 && (
                                    <div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary)',
                                            marginBottom: '0.5rem',
                                            fontWeight: 500
                                        }}>
                                            Season Availability
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            gap: '6px',
                                            flexWrap: 'wrap'
                                        }}>
                                            {Array.from({ length: details.tmdb.numberOfSeasons }, (_, i) => i + 1).map((seasonNum) => {
                                                // Prefer allSeasons (merged from ALL requests) over single request's seasons
                                                const seasonsSource = details?.allSeasons || details?.request?.seasons;
                                                const requestedSeason = seasonsSource?.find(
                                                    s => s.seasonNumber === seasonNum
                                                );

                                                let circleColor = 'var(--error)'; // Not requested = red
                                                let titleText = `Season ${seasonNum}: Not Requested`;

                                                if (requestedSeason) {
                                                    // Season status: same as MediaStatus
                                                    // 1=Unknown, 2=Pending, 3=Processing, 4=Partially Available, 5=Available, 6=Deleted
                                                    if (requestedSeason.status === 5) {
                                                        circleColor = 'var(--success)';
                                                        titleText = `Season ${seasonNum}: Available`;
                                                    } else if (requestedSeason.status === 4) {
                                                        circleColor = 'var(--info)';
                                                        titleText = `Season ${seasonNum}: Partial`;
                                                    } else if (requestedSeason.status === 3) {
                                                        circleColor = 'var(--warning)';
                                                        titleText = `Season ${seasonNum}: Processing`;
                                                    } else if (requestedSeason.status === 2) {
                                                        circleColor = 'var(--warning)';
                                                        titleText = `Season ${seasonNum}: Pending`;
                                                    } else if (requestedSeason.status === 6) {
                                                        circleColor = 'var(--error)';
                                                        titleText = `Season ${seasonNum}: Deleted`;
                                                    } else {
                                                        circleColor = 'var(--text-tertiary)';
                                                        titleText = `Season ${seasonNum}: Unknown`;
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={seasonNum}
                                                        title={titleText}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: circleColor,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            color: 'white',
                                                            cursor: 'default',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        {seasonNum}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </MediaHeroCol>
                        </div>

                        {/* Request Info — first body section under hero */}
                        <div>
                            <MediaSectionHeading>Request Info</MediaSectionHeading>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                    <User size={14} style={{ color: 'var(--text-secondary)' }} />
                                    <span>Requested by: <strong>{details?.request?.requestedBy?.displayName || request.requestedBy?.displayName || 'Unknown'}</strong></span>
                                </div>
                                {details?.request?.createdAt && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                        <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span>Requested on: {new Date(details.request.createdAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Shared media body: tagline → synopsis → genres → directors → cast */}
                        {details?.tmdb?.tagline && (
                            <div style={{
                                fontStyle: 'italic',
                                color: 'var(--text-secondary)',
                                fontSize: '1rem',
                                borderLeft: '3px solid var(--accent)',
                                paddingLeft: '1rem'
                            }}>
                                "{details.tmdb.tagline}"
                            </div>
                        )}

                        {details?.tmdb?.overview && (
                            <MediaSynopsis text={details.tmdb.overview} />
                        )}

                        {details?.tmdb?.genres && details.tmdb.genres.length > 0 && (
                            <MediaGenres genres={details.tmdb.genres} />
                        )}

                        {details?.tmdb?.directors && details.tmdb.directors.length > 0 && (
                            <MediaPeople label="Director" names={details.tmdb.directors} />
                        )}

                        {details?.tmdb?.cast && details.tmdb.cast.length > 0 && (
                            <MediaCast
                                members={details.tmdb.cast.map((actor) => ({
                                    name: actor.name,
                                    role: actor.character,
                                }))}
                            />
                        )}

                        {/* Domain: download / admin */}
                        {downloadInfo?.isDownloading && downloadInfo.downloads.length > 0 && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-hover)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <MediaSectionHeading>Download Progress</MediaSectionHeading>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {downloadInfo.downloads.slice(0, 5).map((dl) => (
                                        <div key={dl.integrationId}>
                                            {downloadInfo.downloads.length > 1 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                    {dl.displayName || dl.integrationId}
                                                </div>
                                            )}
                                            <div style={{
                                                width: '100%',
                                                height: '8px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                                marginBottom: '0.25rem'
                                            }}>
                                                <div style={{
                                                    width: `${dl.progress}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, var(--info), var(--accent))',
                                                    borderRadius: '4px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.8rem',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                <span>{dl.progress}%</span>
                                                {dl.timeLeft && <span>{dl.timeLeft} remaining</span>}
                                                {dl.episodeCount && dl.episodeCount > 1 && (
                                                    <span>{dl.episodeCount} episodes</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {downloadInfo.downloads.length > 5 && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                            +{downloadInfo.downloads.length - 5} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {showActions && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-hover)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <MediaSectionHeading>Admin Actions</MediaSectionHeading>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => handleAction('approve')}
                                        disabled={actionLoading}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            background: 'var(--success)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                            opacity: actionLoading ? 0.7 : 1,
                                            transition: 'opacity 0.2s'
                                        }}
                                    >
                                        <Check size={16} />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleAction('decline')}
                                        disabled={actionLoading}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            background: 'var(--error)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                            opacity: actionLoading ? 0.7 : 1,
                                            transition: 'opacity 0.2s'
                                        }}
                                    >
                                        <XCircle size={16} />
                                        Decline
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--error)20',
                                border: '1px solid var(--error)40',
                                borderRadius: '8px',
                                color: 'var(--error)',
                                fontSize: '0.9rem'
                            }}>
                                {error}
                            </div>
                        )}
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default RequestInfoModal;
