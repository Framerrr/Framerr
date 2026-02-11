import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Star, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { useOverseerrServerMapping, getMatchedIntegrationIds } from '../../api/hooks/useOverseerrServerMapping';
import { useMultiInstanceQueue, findDownloadsForMedia, type QueueItem } from './hooks/useMultiInstanceQueue';
import RequestInfoModal from './modals/RequestInfoModal';
import type { WidgetProps, WidgetData } from '../types';
import './styles.css';

interface OverseerrWidgetProps extends WidgetProps {
    // No additional props needed
}

interface OverseerrIntegration {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
}

interface Media {
    tmdbId?: number;
    title?: string;
    status?: number;
    posterPath?: string | null;
    localPosterPath?: string | null;
    backdropPath?: string | null;
    overview?: string | null;
    releaseDate?: string | null;
    voteAverage?: number | null;
}

interface RequestedBy {
    displayName?: string;
}

interface MediaRequest {
    id: number;
    status: number;
    type: 'movie' | 'tv';
    media?: Media;
    requestedBy?: RequestedBy;
}

// Download info for a request - per-instance array (Phase 7)
interface InstanceDownload {
    integrationId: string;
    displayName: string;      // Framerr user-defined name for this instance
    progress: number;         // 0-100
    timeLeft?: string;        // e.g., "1:23:45"
    episodeCount?: number;    // For TV shows: how many episodes downloading
}

interface DownloadInfoMulti {
    isDownloading: boolean;
    downloads: InstanceDownload[];
}

interface OverseerrData {
    results?: MediaRequest[];
    _meta?: {
        perUserFiltering?: boolean;
        userMatched?: boolean;
        linkedUsername?: string;
    };
}

// Preview mode mock requests data with distinct poster gradient colors
const PREVIEW_REQUESTS = [
    { title: 'Dune: Part Two', status: 'Downloading', color: 'var(--info)', gradient: 'linear-gradient(135deg, #2d5a87 0%, #1a3b5c 100%)' },
    { title: 'Oppenheimer', status: 'Available', color: 'var(--success)', gradient: 'linear-gradient(135deg, #4a3728 0%, #2d2118 100%)' },
    { title: 'The Bear S4', status: 'Requested', color: 'var(--warning)', gradient: 'linear-gradient(135deg, #6b4423 0%, #3d2614 100%)' },
    { title: 'Barbie', status: 'Available', color: 'var(--success)', gradient: 'linear-gradient(135deg, #d35b8d 0%, #a33d6a 100%)' },
];

const OverseerrWidget: React.FC<OverseerrWidgetProps> = ({ widget, previewMode = false }) => {
    // Preview mode: render mock request cards without hooks
    if (previewMode) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center h-8 mb-3">
                    <span className="text-sm font-semibold text-theme-primary">Recent Requests</span>
                </div>
                <div className="flex gap-3 flex-1 overflow-hidden">
                    {PREVIEW_REQUESTS.map((req, i) => (
                        <div key={i} className="relative h-full flex-shrink-0 rounded-xl overflow-hidden shadow-medium" style={{ aspectRatio: '2/3' }}>
                            <div className="w-full h-full flex items-center justify-center" style={{ background: req.gradient }}>
                                <Film size={24} className="text-white opacity-40" />
                            </div>
                            <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase backdrop-blur-md"
                                style={{ background: 'rgba(0,0,0,0.8)', color: req.color }}>
                                {req.status}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 py-3 px-2 bg-gradient-to-t from-black/95 to-transparent">
                                <div className="font-semibold text-xs text-white text-center">{req.title}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound (new pattern: explicit integrationId in config)
    const config = widget.config as { integrationId?: string; viewMode?: 'auto' | 'carousel' | 'stacked' } | undefined;
    const configuredIntegrationId = config?.integrationId;
    const configViewMode = config?.viewMode ?? 'auto';

    // Wrapper ref for auto view mode dimension measurement
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (configViewMode !== 'auto' || !wrapperRef.current) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setContainerSize({ w: width, h: height });
        });
        ro.observe(wrapperRef.current);
        return () => ro.disconnect();
    }, [configViewMode]);

    // Resolve 'auto' based on container aspect ratio
    const viewMode = configViewMode === 'auto'
        ? (containerSize.h > containerSize.w * 1.2 ? 'stacked' : 'carousel')
        : configViewMode;

    // Use unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('overseerr', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Phase: Multi-instance queue correlation
    // Fetch server mapping to discover which Radarr/Sonarr are connected to this Overseerr
    const { data: serverMapping, isLoading: serverMappingLoading } = useOverseerrServerMapping(integrationId);

    // Extract matched integration IDs from server mapping
    const { radarrIds, sonarrIds } = useMemo(
        () => getMatchedIntegrationIds(serverMapping),
        [serverMapping]
    );

    // Build integrationId -> displayName lookup from serverMapping
    const integrationNameLookup = useMemo(() => {
        const lookup = new Map<string, string>();
        if (!serverMapping) return lookup;
        for (const s of serverMapping.radarrServers) {
            if (s.framerIntegrationId && s.framerIntegrationName) {
                lookup.set(s.framerIntegrationId, s.framerIntegrationName);
            }
        }
        for (const s of serverMapping.sonarrServers) {
            if (s.framerIntegrationId && s.framerIntegrationName) {
                lookup.set(s.framerIntegrationId, s.framerIntegrationName);
            }
        }
        return lookup;
    }, [serverMapping]);

    // Subscribe to queue SSE for all matched instances
    const { queues: multiInstanceQueues } = useMultiInstanceQueue(radarrIds, sonarrIds);

    // Legacy state for backwards compatibility with modal
    // Convert Map to arrays for modal prop (existing interface)
    const sonarrQueue = useMemo(() => {
        const items: QueueItem[] = [];
        for (const [_id, queue] of multiInstanceQueues) {
            items.push(...queue.filter(q => q.series)); // Sonarr items have series
        }
        return items;
    }, [multiInstanceQueues]);

    const radarrQueue = useMemo(() => {
        const items: QueueItem[] = [];
        for (const [_id, queue] of multiInstanceQueues) {
            items.push(...queue.filter(q => q.movie)); // Radarr items have movie
        }
        return items;
    }, [multiInstanceQueues]);


    // Scroll state
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
    const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

    // Modal state for selected request
    const [selectedRequest, setSelectedRequest] = useState<{ request: MediaRequest; downloadInfo: DownloadInfoMulti | null } | null>(null);

    // Expanded card state for touch/hover interaction
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    // 5-second auto-collapse for expanded cards
    useEffect(() => {
        if (expandedCardId === null) return;
        const timer = setTimeout(() => {
            setExpandedCardId(null);
        }, 5000);
        return () => clearTimeout(timer);
    }, [expandedCardId]);

    // Helper: Get download info for a request using multi-instance queue data
    // Returns array of downloads per instance with displayName (Phase 7 per plan)
    const getDownloadInfo = (request: MediaRequest): DownloadInfoMulti | null => {
        const tmdbId = request.media?.tmdbId;
        if (!tmdbId) return null;

        // Find all downloads for this media across all matched instances
        const downloads = findDownloadsForMedia(
            tmdbId,
            request.type,
            multiInstanceQueues
        );

        if (downloads.length === 0) return null;

        return {
            isDownloading: true,
            downloads: downloads.map(d => ({
                integrationId: d.integrationId,
                displayName: integrationNameLookup.get(d.integrationId) || d.integrationId,
                progress: d.progress,
                timeLeft: d.timeLeft,
                episodeCount: d.episodeCount
            }))
        };
    };

    // State for requests data from SSE
    const [requestsData, setRequestsData] = useState<OverseerrData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to requests SSE topic - server polls every 60s, pushes only on change
    // P9: Also get isConnected to prevent premature "no data" display
    const { loading, isConnected } = useIntegrationSSE<OverseerrData>({
        integrationType: 'overseerr',
        subtype: 'requests',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            setRequestsData(data);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load requests');
        }
    });

    // Scroll helper functions
    const scrollLeft = (): void => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth * 0.8;
            // Constrain to not scroll past start
            const newScrollLeft = Math.max(0, container.scrollLeft - scrollAmount);
            container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
        }
    };

    const scrollRight = (): void => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth * 0.8;
            const maxScroll = container.scrollWidth - container.clientWidth;
            // Constrain to not scroll past end
            const newScrollLeft = Math.min(maxScroll, container.scrollLeft + scrollAmount);
            container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
        }
    };

    // Update scroll button states based on scroll position
    const updateScrollButtons = (): void => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 1); // Small threshold for precision
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
        }
    };

    // Handle scroll - update buttons AND collapse expanded card
    const handleScroll = (): void => {
        updateScrollButtons();
        // Collapse any expanded card when scrolling
        if (expandedCardId !== null) {
            setExpandedCardId(null);
        }
    };

    // Set up scroll event listener and initial state (widget horizontal scroll)
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            updateScrollButtons();
            container.addEventListener('scroll', handleScroll);
            // Also update on resize
            const resizeObserver = new ResizeObserver(updateScrollButtons);
            resizeObserver.observe(container);
            return () => {
                container.removeEventListener('scroll', handleScroll);
                resizeObserver.disconnect();
            };
        }
        return undefined;
    }, [requestsData, expandedCardId]); // Re-run when data changes or expandedCardId changes

    // Collapse expanded card on page scroll
    useEffect(() => {
        if (expandedCardId === null) return;
        const handlePageScroll = () => setExpandedCardId(null);
        window.addEventListener('scroll', handlePageScroll, { passive: true });
        return () => window.removeEventListener('scroll', handlePageScroll);
    }, [expandedCardId]);

    // NOW we can have early returns (after all hooks have been called)

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="Overseerr"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="Overseerr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="Overseerr"
                isAdmin={userIsAdmin}
            />
        );
    }


    // P9: Show loading if SSE not connected OR waiting for first data
    // This prevents premature "No Pending Requests" while SSE is establishing
    if ((loading && !requestsData) || (!isConnected && !requestsData)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        // Use 'unavailable' variant for connection/service errors from backend
        const isServiceUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName="Overseerr"
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    const requests = requestsData?.results || [];
    const meta = requestsData?._meta;

    // Check if filtering is enabled but user couldn't be matched
    if (meta?.perUserFiltering && meta?.userMatched === false) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                <Star size={48} className="text-warning opacity-50" />
                <div>
                    <div className="text-theme-primary font-medium mb-1">Link Your Account</div>
                    <div className="text-theme-secondary text-sm">
                        Link your Overseerr account to see your personalized requests.
                    </div>
                </div>
                <a
                    href="/settings/linked-accounts"
                    className="text-sm text-accent hover:underline flex items-center gap-1"
                >
                    Go to Linked Accounts →
                </a>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Star}
                emptyTitle="No Pending Requests"
                emptySubtitle="All caught up!"
            />
        );
    }

    const headerHeight = 28;
    const headerGap = 6;

    // ========================================================================
    // STACKED MODE
    // ========================================================================
    if (viewMode === 'stacked') {
        return (
            <div ref={wrapperRef} className="flex flex-col h-full overflow-hidden">
                {/* Vertical scrollable list */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        overscrollBehaviorY: 'contain',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        borderRadius: '0.75rem',
                    }}
                    className="hide-scrollbar"
                >
                    <style>{`
                        .hide-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                    {requests.map((req, i) => {
                        const media = req.media;
                        const title = media?.title || 'Unknown';
                        const userName = req.requestedBy?.displayName || 'User';
                        const downloadInfo = getDownloadInfo(req);

                        // Status logic (same as carousel)
                        let status = 'Requested';
                        let statusColor = 'var(--warning)';
                        if (media?.status === 5) { status = 'Available'; statusColor = 'var(--success)'; }
                        else if (media?.status === 4) { status = 'Partial'; statusColor = 'var(--info)'; }
                        else if (media?.status === 6) { status = 'Deleted'; statusColor = 'var(--error)'; }
                        else if (downloadInfo?.isDownloading) { status = 'Downloading'; statusColor = 'var(--info)'; }
                        else if (req.status === 5) { status = 'Completed'; statusColor = 'var(--success)'; }
                        else if (req.status === 3) { status = 'Declined'; statusColor = 'var(--error)'; }
                        else if (req.status === 4) { status = 'Failed'; statusColor = 'var(--error)'; }
                        else if (req.status === 2) {
                            if (media?.status === 3) { status = 'Processing'; statusColor = 'var(--info)'; }
                            else { status = 'Approved'; statusColor = 'var(--success)'; }
                        }

                        // Backdrop for stacked mode, fall back to poster
                        const backdropUrl = media?.backdropPath
                            ? `https://image.tmdb.org/t/p/w780${media.backdropPath}`
                            : null;
                        const posterUrl = media?.localPosterPath
                            ? `/api/cache/images/${media.localPosterPath}`
                            : media?.posterPath
                                ? `https://image.tmdb.org/t/p/w342${media.posterPath}`
                                : null;
                        const imageUrl = backdropUrl || posterUrl;

                        return (
                            <div
                                key={`${req.id}-${i}`}
                                className="relative flex-shrink-0 rounded-xl overflow-hidden cursor-pointer"
                                style={{ aspectRatio: '16/7', width: '100%' }}
                                onClick={() => setSelectedRequest({ request: req, downloadInfo })}
                            >
                                {/* Backdrop/Poster Image */}
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-theme-tertiary flex items-center justify-center">
                                        <Film size={32} className="text-theme-secondary opacity-30" />
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div
                                    className="absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border"
                                    style={{
                                        background: 'rgba(0,0,0,0.8)',
                                        color: statusColor,
                                        borderColor: `${statusColor}40`
                                    }}
                                >
                                    {status}
                                </div>

                                {/* Download Progress (if downloading) */}
                                {downloadInfo?.isDownloading && downloadInfo.downloads.length > 0 && (
                                    <div className="absolute left-3 bottom-10 right-3">
                                        {downloadInfo.downloads.slice(0, 2).map((dl) => (
                                            <div key={dl.integrationId} className="flex items-center gap-2 mb-1">
                                                <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-accent"
                                                        style={{ width: `${dl.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-white/80 font-mono tabular-nums">{dl.progress}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Bottom Gradient with Title */}
                                <div className="absolute inset-x-0 bottom-0 pt-8 pb-2.5 px-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                    <div className="font-semibold text-sm text-white line-clamp-1 leading-tight">
                                        {title}
                                    </div>
                                    <div className="text-[11px] text-white/60 mt-0.5">
                                        {userName}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Request Info Modal */}
                {selectedRequest && (
                    <RequestInfoModal
                        request={selectedRequest.request}
                        downloadInfo={selectedRequest.downloadInfo}
                        integrationId={integrationId!}
                        sonarrQueue={sonarrQueue}
                        radarrQueue={radarrQueue}
                        onClose={() => setSelectedRequest(null)}
                    />
                )}
            </div>
        );
    }

    // ========================================================================
    // CAROUSEL MODE (default)
    // ========================================================================

    return (
        <div ref={wrapperRef} className="flex flex-col h-full overflow-hidden">
            {/* Header with Scroll Buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: `${headerHeight}px`,
                marginBottom: `${headerGap}px`,
                flexShrink: 0
            }}>
                <span className="text-sm font-semibold text-theme-primary">
                    Recent Requests
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={scrollLeft}
                        disabled={!canScrollLeft}
                        className={`w-7 h-7 flex items-center justify-center rounded-md border border-theme transition-colors ${canScrollLeft
                            ? 'bg-theme-tertiary hover:bg-theme-hover text-theme-secondary hover:text-theme-primary cursor-pointer'
                            : 'bg-theme-tertiary/50 text-theme-tertiary cursor-not-allowed'
                            }`}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={scrollRight}
                        disabled={!canScrollRight}
                        className={`w-7 h-7 flex items-center justify-center rounded-md border border-theme transition-colors ${canScrollRight
                            ? 'bg-theme-tertiary hover:bg-theme-hover text-theme-secondary hover:text-theme-primary cursor-pointer'
                            : 'bg-theme-tertiary/50 text-theme-tertiary cursor-not-allowed'
                            }`}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Horizontal Scrollable Carousel */}
            <div
                ref={scrollContainerRef}
                style={{
                    display: 'flex',
                    gap: '12px',
                    flex: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    overscrollBehaviorX: 'contain',
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    borderRadius: '0.75rem',
                }}
                className="hide-scrollbar"
            >
                <style>{`
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {requests.map((req, i) => {
                    const media = req.media;
                    // Use enriched title from backend (works for both TV and movies)
                    const title = media?.title || 'Unknown';
                    const userName = req.requestedBy?.displayName || 'User';

                    // Get download info for this request
                    const downloadInfo = getDownloadInfo(req);

                    // Overseerr Status Logic:
                    // MediaStatus (media.status): 1=Unknown, 2=Pending, 3=Processing, 4=Partially Available, 5=Available, 6=Deleted
                    // MediaRequestStatus (req.status): 1=Pending, 2=Approved, 3=Declined, 4=Failed, 5=Completed
                    let status = 'Requested';
                    let statusColor = 'var(--warning)'; // amber

                    // Priority 1: Check media availability status first
                    if (media?.status === 5) {
                        // Fully available
                        status = 'Available';
                        statusColor = 'var(--success)';
                    } else if (media?.status === 4) {
                        // Partially available (e.g., some seasons of a TV show)
                        status = 'Partial';
                        statusColor = 'var(--info)';
                    } else if (media?.status === 6) {
                        // Deleted from library
                        status = 'Deleted';
                        statusColor = 'var(--error)';
                    }
                    // Priority 2: Check if currently downloading (overrides Processing/Approved)
                    else if (downloadInfo?.isDownloading) {
                        status = 'Downloading';
                        statusColor = 'var(--info)';
                    }
                    // Priority 3: Check request-level statuses (determines workflow state)
                    else if (req.status === 5) {
                        // Completed (all episodes/movie fully available via request)
                        status = 'Completed';
                        statusColor = 'var(--success)';
                    } else if (req.status === 3) {
                        // Declined
                        status = 'Declined';
                        statusColor = 'var(--error)';
                    } else if (req.status === 4) {
                        // Failed
                        status = 'Failed';
                        statusColor = 'var(--error)';
                    } else if (req.status === 2) {
                        // Approved - check if actively processing
                        if (media?.status === 3) {
                            // Processing by Sonarr/Radarr (searching, queued, etc.)
                            status = 'Processing';
                            statusColor = 'var(--info)';
                        } else {
                            status = 'Approved';
                            statusColor = 'var(--success)';
                        }
                    }
                    // Default: req.status === 1 (Pending approval) - shows "Requested"

                    // Use local cached poster if available, otherwise fall back to TMDB CDN
                    const posterUrl = media?.localPosterPath
                        ? `/api/cache/images/${media.localPosterPath}`
                        : media?.posterPath
                            ? `https://image.tmdb.org/t/p/w342${media.posterPath}`
                            : null;

                    // Detect if touch device (for mobile vs desktop interaction)
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    const isExpanded = expandedCardId === req.id;

                    return (
                        <div
                            key={`${req.id}-${i}`}
                            className="group relative h-full flex-shrink-0 rounded-xl overflow-hidden cursor-pointer"
                            style={{
                                height: '100%',
                                aspectRatio: '2/3'
                            }}
                            // Desktop: hover anywhere to expand (if bars exist)
                            onMouseEnter={() => !isTouchDevice && setExpandedCardId(req.id)}
                            onMouseLeave={() => !isTouchDevice && setExpandedCardId(null)}
                            // Desktop: click anywhere opens modal
                            // Mobile non-shadow: click opens modal (shadow handled separately)
                            onClick={(e) => {
                                if (!isTouchDevice) {
                                    // Desktop: always open modal on click
                                    setSelectedRequest({ request: req, downloadInfo });
                                } else if (isExpanded) {
                                    // Mobile expanded: tap anywhere opens modal
                                    setSelectedRequest({ request: req, downloadInfo });
                                }
                                // Mobile non-expanded, non-shadow click: let it bubble to the top overlay
                            }}
                        >
                            {/* Poster Image */}
                            {posterUrl ? (
                                <img
                                    src={posterUrl}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-theme-tertiary flex items-center justify-center">
                                    <Film size={32} className="text-theme-secondary opacity-30" />
                                </div>
                            )}

                            {/* Status Badge */}
                            <div
                                className="absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border"
                                style={{
                                    background: 'rgba(0,0,0,0.8)',
                                    color: statusColor,
                                    borderColor: `${statusColor}40`
                                }}
                            >
                                {status}
                            </div>

                            {/* Top clickable area (non-shadow) - opens modal directly on mobile */}
                            <div
                                className="absolute inset-0 z-10"
                                style={{ bottom: '35%' }}
                                onClick={(e) => {
                                    if (isTouchDevice && !isExpanded) {
                                        // Mobile, not expanded, non-shadow tap: open modal directly
                                        setSelectedRequest({ request: req, downloadInfo });
                                        e.stopPropagation();
                                    }
                                }}
                            />

                            {/* Gradient Overlay with Text (SHADOW AREA) */}
                            <div
                                className="absolute inset-x-0 bottom-0 pt-12 pb-3 px-3 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-transparent"
                                onClick={(e) => {
                                    if (isTouchDevice && !isExpanded && downloadInfo?.isDownloading) {
                                        // Mobile, not expanded, shadow tap: expand bars only
                                        setExpandedCardId(req.id);
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                {/* Download Progress Bars - shows up to 3 bars when downloading (Phase 8) */}
                                {downloadInfo?.isDownloading && downloadInfo.downloads.length > 0 && (
                                    <div className={`overseerr-progress-stack mb-2 ${isExpanded ? 'expanded' : ''}`}>
                                        {downloadInfo.downloads.slice(0, 3).map((dl, idx) => (
                                            <div key={dl.integrationId} className="overseerr-progress group/progress">
                                                {/* Show label if multiple instances */}
                                                {downloadInfo.downloads.length > 1 && (
                                                    <div className="overseerr-progress__label">
                                                        {dl.displayName}
                                                    </div>
                                                )}
                                                <div className="overseerr-progress__bar">
                                                    <div
                                                        className="overseerr-progress__fill"
                                                        style={{ width: `${dl.progress}%` }}
                                                    />
                                                </div>
                                                <div className="overseerr-progress__details">
                                                    <span className="overseerr-progress__percent">{dl.progress}%</span>
                                                    {dl.timeLeft && (
                                                        <span className="overseerr-progress__time">{dl.timeLeft}</span>
                                                    )}
                                                    {dl.episodeCount && dl.episodeCount > 1 && (
                                                        <span className="overseerr-progress__episodes">{dl.episodeCount} eps</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {downloadInfo.downloads.length > 3 && (
                                            <div className="text-[9px] text-white/60 text-center">+{downloadInfo.downloads.length - 3} more</div>
                                        )}
                                    </div>
                                )}

                                <div
                                    className="font-semibold text-xs text-white text-center mb-1 line-clamp-2 leading-tight"
                                    title={title}
                                >
                                    {title}
                                </div>
                                <div className="text-[10px] text-white/70 text-center">
                                    {userName}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Request Info Modal */}
            {selectedRequest && (
                <RequestInfoModal
                    request={selectedRequest.request}
                    downloadInfo={selectedRequest.downloadInfo}
                    integrationId={integrationId!}
                    sonarrQueue={sonarrQueue}
                    radarrQueue={radarrQueue}
                    onClose={() => setSelectedRequest(null)}
                />
            )}
        </div>
    );
};

export default OverseerrWidget;
