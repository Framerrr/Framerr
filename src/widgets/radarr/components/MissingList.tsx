/**
 * MissingList - Vertical scrollable list of missing/cutoff-unmet movies
 * 
 * Each row shows a poster thumbnail, movie title, year,
 * and a status badge. Tapping opens the detail modal.
 * Includes a "Load More" button for pagination.
 * 
 * Queue cross-reference: if a missing movie is also in the Radarr download
 * queue, the badge shows the pipeline state (Downloading, Importing, Warning, Error)
 * instead of just "Missing".
 */

import React, { useEffect } from 'react';
import { Film, Loader2 } from 'lucide-react';
import type { WantedMovie, RadarrImage, QueueItem } from '../radarr.types';

interface MissingListProps {
    movies: WantedMovie[];
    integrationId: string;
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onMovieClick?: (movie: WantedMovie) => void;
    /** Queue items from SSE for download state enrichment */
    queueItems?: QueueItem[];
    /** If true, auto-fetch first page on mount */
    autoFetch?: boolean;
    fetchFirstPage?: () => void;
}

/** Get movie poster URL, proxied through backend */
function getPosterUrl(movie: WantedMovie, integrationId: string): string | null {
    const images = movie.images;
    if (!images?.length) return null;

    const poster = images.find((img: RadarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

/** Format release date — digital first, fallback to cinema */
function formatDate(movie: WantedMovie): string {
    const dateStr = movie.digitalRelease || movie.inCinemas;
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Determine badge label and CSS class from queue item state */
function getQueueBadge(q: QueueItem): { label: string; className: string } {
    if (q.trackedDownloadStatus === 'error' || q.status === 'failed') {
        return { label: 'Error', className: 'rdr-badge--error' };
    }
    if (q.trackedDownloadStatus === 'warning') {
        return { label: 'Warning', className: 'rdr-badge--warning' };
    }
    if (q.trackedDownloadState === 'importing' || q.trackedDownloadState === 'importPending') {
        return { label: 'Importing', className: 'rdr-badge--importing' };
    }
    if (q.status === 'downloading') {
        return { label: 'Downloading', className: 'rdr-badge--downloading' };
    }
    if (q.status === 'delay' || q.status === 'queued') {
        return { label: 'Queued', className: 'rdr-badge--queued' };
    }
    return { label: 'In Queue', className: 'rdr-badge--queued' };
}

const MissingList = ({
    movies,
    integrationId,
    loading,
    hasMore,
    onLoadMore,
    onMovieClick,
    queueItems = [],
    autoFetch,
    fetchFirstPage,
}: MissingListProps): React.JSX.Element => {
    // Build lookup map: movieId → QueueItem (O(1) lookups)
    const queueByMovieId = React.useMemo(() => {
        const map = new Map<number, QueueItem>();
        for (const q of queueItems) {
            if (q.movieId != null) map.set(q.movieId, q);
        }
        return map;
    }, [queueItems]);

    // Auto-fetch first page when component mounts
    useEffect(() => {
        if (autoFetch && fetchFirstPage && movies.length === 0) {
            fetchFirstPage();
        }
    }, [autoFetch, fetchFirstPage, movies.length]);

    if (movies.length === 0 && !loading) {
        return (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                No missing movies
            </div>
        );
    }

    return (
        <div className="rdr-missing-list custom-scrollbar">
            {movies.map(movie => {
                const posterUrl = getPosterUrl(movie, integrationId);
                const title = movie.title || 'Unknown Movie';
                const year = movie.year ? String(movie.year) : '';
                const date = formatDate(movie);
                const isMissing = !movie.hasFile;

                // Check if this movie is in the download queue
                const queueMatch = queueByMovieId.get(movie.id);
                const badge = queueMatch
                    ? getQueueBadge(queueMatch)
                    : { label: isMissing ? 'Missing' : 'Cutoff', className: isMissing ? 'rdr-badge--missing' : 'rdr-badge--cutoff' };

                return (
                    <div
                        key={`miss-${movie.id}`}
                        className="rdr-missing-item"
                        onClick={() => onMovieClick?.(movie)}
                    >
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={title}
                                className="rdr-missing-poster"
                                loading="lazy"
                            />
                        ) : (
                            <div className="rdr-missing-poster-placeholder">
                                <Film size={14} />
                            </div>
                        )}

                        <div className="rdr-missing-info">
                            <span className="rdr-missing-series">{title}</span>
                            <span className="rdr-missing-episode">
                                {year && `${year}`}{date && ` · ${date}`}
                            </span>
                            <div className="rdr-missing-meta">
                                <span className={`rdr-badge ${badge.className}`}>
                                    {badge.label}
                                </span>
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
                <button className="rdr-load-more" onClick={onLoadMore}>
                    Load More
                </button>
            )}
        </div>
    );
};

export default MissingList;

