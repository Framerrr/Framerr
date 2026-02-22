/**
 * MissingList - Vertical scrollable list of missing/cutoff-unmet episodes
 * 
 * Each row shows a poster thumbnail, series/episode title, S#E# code,
 * and a status badge. Tapping opens the detail modal.
 * Includes a "Load More" button for pagination.
 * 
 * Queue cross-reference: if a missing episode is also in the Sonarr download
 * queue, the badge shows the pipeline state (Downloading, Importing, Warning, Error)
 * instead of just "Missing".
 */

import React, { useEffect } from 'react';
import { MonitorPlay, Loader2 } from 'lucide-react';
import type { WantedEpisode, SonarrImage, QueueItem } from '../sonarr.types';

interface MissingListProps {
    episodes: WantedEpisode[];
    integrationId: string;
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onEpisodeClick?: (episode: WantedEpisode) => void;
    /** Queue items from SSE for download state enrichment */
    queueItems?: QueueItem[];
    /** If true, auto-fetch first page on mount */
    autoFetch?: boolean;
    fetchFirstPage?: () => void;
}

/** Get series poster URL, proxied through backend */
function getPosterUrl(episode: WantedEpisode, integrationId: string): string | null {
    const images = episode.series?.images;
    if (!images?.length) return null;

    const poster = images.find((img: SonarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

/** Format episode code */
function formatEpCode(ep: WantedEpisode): string {
    if (ep.seasonNumber == null || ep.episodeNumber == null) return '';
    return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`;
}

/** Format air date */
function formatDate(ep: WantedEpisode): string {
    const dateStr = ep.airDateUtc || ep.airDate;
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Determine badge label and CSS class from queue item state */
function getQueueBadge(q: QueueItem): { label: string; className: string } {
    // Error / failed
    if (q.trackedDownloadStatus === 'error' || q.status === 'failed') {
        return { label: 'Error', className: 'snr-badge--error' };
    }
    // Warning (e.g. can't import — zip file, sample only)
    if (q.trackedDownloadStatus === 'warning') {
        return { label: 'Warning', className: 'snr-badge--warning' };
    }
    // Importing / import pending
    if (q.trackedDownloadState === 'importing' || q.trackedDownloadState === 'importPending') {
        return { label: 'Importing', className: 'snr-badge--importing' };
    }
    // Actively downloading
    if (q.status === 'downloading') {
        return { label: 'Downloading', className: 'snr-badge--downloading' };
    }
    // Delay / queued in download client
    if (q.status === 'delay' || q.status === 'queued') {
        return { label: 'Queued', className: 'snr-badge--queued' };
    }
    // Fallback — something is happening
    return { label: 'In Queue', className: 'snr-badge--queued' };
}

const MissingList = ({
    episodes,
    integrationId,
    loading,
    hasMore,
    onLoadMore,
    onEpisodeClick,
    queueItems = [],
    autoFetch,
    fetchFirstPage,
}: MissingListProps): React.JSX.Element => {
    // Build lookup map: episodeId → QueueItem (O(1) lookups)
    const queueByEpisodeId = React.useMemo(() => {
        const map = new Map<number, QueueItem>();
        for (const q of queueItems) {
            if (q.episodeId != null) map.set(q.episodeId, q);
        }
        return map;
    }, [queueItems]);

    // Auto-fetch first page when component mounts
    useEffect(() => {
        if (autoFetch && fetchFirstPage && episodes.length === 0) {
            fetchFirstPage();
        }
    }, [autoFetch, fetchFirstPage, episodes.length]);

    if (episodes.length === 0 && !loading) {
        return (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                No missing episodes
            </div>
        );
    }

    return (
        <div className="snr-missing-list custom-scrollbar">
            {episodes.map(ep => {
                const posterUrl = getPosterUrl(ep, integrationId);
                const seriesTitle = ep.series?.title || 'Unknown Series';
                const epTitle = ep.title || 'TBA';
                const epCode = formatEpCode(ep);
                const date = formatDate(ep);
                const isMissing = !ep.hasFile;

                // Check if this episode is in the download queue
                const queueMatch = queueByEpisodeId.get(ep.id);
                const badge = queueMatch
                    ? getQueueBadge(queueMatch)
                    : { label: isMissing ? 'Missing' : 'Cutoff', className: isMissing ? 'snr-badge--missing' : 'snr-badge--cutoff' };

                return (
                    <div
                        key={`miss-${ep.seriesId}-${ep.id}`}
                        className="snr-missing-item"
                        onClick={() => onEpisodeClick?.(ep)}
                    >
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={seriesTitle}
                                className="snr-missing-poster"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div className="snr-missing-poster-placeholder">
                                <MonitorPlay size={14} />
                            </div>
                        )}

                        <div className="snr-missing-info">
                            <span className="snr-missing-series">{seriesTitle}</span>
                            <span className="snr-missing-episode">
                                {epCode && `${epCode} · `}{epTitle}
                            </span>
                            <div className="snr-missing-meta">
                                <span className={`snr-badge ${badge.className}`}>
                                    {badge.label}
                                </span>
                                {date && <span>{date}</span>}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Load More / Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}

            {hasMore && !loading && (
                <button className="snr-load-more" onClick={onLoadMore}>
                    Load More
                </button>
            )}
        </div>
    );
};

export default MissingList;
