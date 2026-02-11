import React, { useState, useEffect, useMemo } from 'react';
import { Star, Calendar, Clock, User, Check, XCircle, Film, Tv } from 'lucide-react';
import { Modal } from '../../../shared/ui';
import AuthImage from '../../../shared/ui/AuthImage';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { isAdmin } from '../../../utils/permissions';
import { widgetFetch } from '../../../utils/widgetFetch';
import logger from '../../../utils/logger';

// Props from OverseerrWidget
interface MediaRequest {
    id: number;
    status: number;
    type: 'movie' | 'tv';
    media?: {
        tmdbId?: number;
        title?: string;
        status?: number;
        posterPath?: string | null;
        localPosterPath?: string | null;
        overview?: string | null;
        releaseDate?: string | null;
        voteAverage?: number | null;
    };
    requestedBy?: {
        displayName?: string;
    };
}

// Per-instance download info (Phase 7)
interface InstanceDownload {
    integrationId: string;
    displayName?: string;     // Framerr user-defined name
    progress: number;
    timeLeft?: string;
    episodeCount?: number;
}

// Multi-instance download info (Phase 9)
interface DownloadInfoMulti {
    isDownloading: boolean;
    downloads: InstanceDownload[];
}

interface RequestInfoModalProps {
    request: MediaRequest;
    downloadInfo: DownloadInfoMulti | null;
    integrationId: string;
    /** Queue data passed from parent widget for live download progress */
    sonarrQueue?: Array<{ id?: number; progress?: number; timeleft?: string; movie?: { tmdbId?: number }; series?: { tmdbId?: number }; size?: number; sizeleft?: number }>;
    radarrQueue?: Array<{ id?: number; progress?: number; timeleft?: string; movie?: { tmdbId?: number }; series?: { tmdbId?: number }; size?: number; sizeleft?: number }>;
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
        directors?: string[];
        cast?: Array<{ name: string; character?: string; profilePath?: string }>;
        productionCompanies?: string[];
        networks?: string[];
    } | null;
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
    const { handleRequestAction } = useNotifications();
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

    // Fetch detailed request info
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const response = await widgetFetch(
                    `/api/integrations/${integrationId}/proxy/request/${request.id}/details`,
                    'overseerr-request-info'
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
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
    }, [request.id]);

    // Handle approve/decline
    const handleAction = async (action: 'approve' | 'decline') => {
        setActionLoading(true);
        try {
            // Call the action endpoint on the integration
            const response = await fetch(`/api/integrations/${integrationId}/actions/${action}/${request.id}`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Action failed: ${response.status}`);
            }

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

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg">
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
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {/* Poster */}
                            {hasPoster ? (
                                <div style={{
                                    width: '150px',
                                    height: '225px',
                                    minHeight: '225px',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                    <AuthImage
                                        src={localCacheSrc}
                                        fallbackSrc={cdnFallbackSrc}
                                        alt={title}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            ) : (
                                <div style={{
                                    width: '150px',
                                    height: '225px',
                                    flexShrink: 0,
                                    borderRadius: '8px',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Film size={48} style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            )}

                            {/* Title and Metadata */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
                                }}>
                                    {title}
                                </h2>

                                {/* Type Badge */}
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'var(--bg-hover)',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    {request.type === 'movie' ? <Film size={12} /> : <Tv size={12} />}
                                    {request.type === 'movie' ? 'Movie' : 'TV Show'}
                                </div>

                                {/* Metadata Row */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {details?.tmdb?.releaseDate && new Date(details.tmdb.releaseDate).getFullYear() > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{new Date(details.tmdb.releaseDate).getFullYear()}</span>
                                        </div>
                                    )}
                                    {(typeof details?.tmdb?.rating === 'number' && details.tmdb.rating > 0) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{details.tmdb.rating.toFixed(1)}/10</span>
                                        </div>
                                    ) : null}
                                    {(details?.tmdb?.runtime && details.tmdb.runtime > 0 && request.type === 'movie') ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{Math.floor(details.tmdb.runtime / 60)}h {details.tmdb.runtime % 60}m</span>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Status Badge */}
                                <div style={{
                                    display: 'inline-block',
                                    marginTop: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    background: `${statusInfo.color}20`,
                                    border: `1px solid ${statusInfo.color}40`,
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: statusInfo.color
                                }}>
                                    {statusInfo.label}
                                </div>

                                {/* Season Availability Visualization (for TV shows) */}
                                {request.type === 'tv' && details?.tmdb?.numberOfSeasons && details.tmdb.numberOfSeasons > 0 && (
                                    <div style={{ marginTop: '0.75rem' }}>
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
                                                // Find if this season is in the request
                                                const requestedSeason = details?.request?.seasons?.find(
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
                            </div>
                        </div>

                        {/* Tagline */}
                        {(details?.tmdb?.tagline || request.media?.overview) && details?.tmdb?.tagline && (
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

                        {/* Download Progress (Phase 9: Multi-bar, max 5) */}
                        {downloadInfo?.isDownloading && downloadInfo.downloads.length > 0 && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-hover)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 0.75rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Download Progress
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {downloadInfo.downloads.slice(0, 5).map((dl) => (
                                        <div key={dl.integrationId}>
                                            {/* Show label if multiple instances */}
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

                        {/* Request Info */}
                        <div>
                            <h4 style={{
                                margin: '0 0 0.5rem 0',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-secondary)'
                            }}>
                                Request Info
                            </h4>
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

                        {/* Admin Actions */}
                        {showActions && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-hover)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 0.75rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Admin Actions
                                </h4>
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

                        {/* Synopsis */}
                        {details?.tmdb?.overview && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Synopsis
                                </h4>
                                <p style={{
                                    margin: 0,
                                    lineHeight: 1.6,
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem'
                                }}>
                                    {details.tmdb.overview}
                                </p>
                            </div>
                        )}

                        {/* Genres */}
                        {details?.tmdb?.genres && details.tmdb.genres.length > 0 && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Genres
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {details.tmdb.genres.map((genre, idx) => (
                                        <span
                                            key={idx}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                background: 'var(--bg-hover)',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Directors */}
                        {details?.tmdb?.directors && details.tmdb.directors.length > 0 && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {details.tmdb.directors.length > 1 ? 'Directors' : 'Director'}
                                </h4>
                                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    {details.tmdb.directors.join(', ')}
                                </div>
                            </div>
                        )}

                        {/* Cast */}
                        {details?.tmdb?.cast && details.tmdb.cast.length > 0 && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Cast
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {details.tmdb.cast.map((actor, idx) => (
                                        <span
                                            key={idx}
                                            title={actor.character ? `as ${actor.character}` : undefined}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                background: 'var(--bg-hover)',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-primary)',
                                                cursor: actor.character ? 'default' : undefined
                                            }}
                                        >
                                            {actor.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
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
