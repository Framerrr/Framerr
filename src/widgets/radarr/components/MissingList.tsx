/**
 * MissingList - "Needs Attention" section (missing + cutoff-unmet movies)
 *
 * Renders two logical groups (missing, then cutoff-unmet) as one seamless
 * list. Left-border stripe encodes severity per
 * docs/WIDGET_REDESIGN_MEDIA.md §1.7:
 * - Red: missing entirely — [Search] quick action
 * - Blue: actively downloading (takes priority over red/amber) — progress bar
 * - Amber: on disk but cutoff-unmet — [Upgrade] action (opens the modal)
 *
 * Each group paginates independently ("Load More" shown per-group).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Film, Loader2, Search, ArrowUpCircle, Check, X } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { resolveQueueSeverity } from '../../_shared/media/queueSeverity';
import { getAttentionPillProps, sortByAttentionReferenceDate } from '../hooks/radarrDisplayState';
import { useAutoSearchState } from '../hooks/useAutoSearchState';
import type { WantedMovie, RadarrImage, QueueItem } from '../radarr.types';

type AttentionGroup = 'missing' | 'cutoff';

interface MissingListProps {
    missingMovies: WantedMovie[];
    cutoffMovies: WantedMovie[];
    integrationId: string;
    missingLoading: boolean;
    cutoffLoading: boolean;
    missingHasMore: boolean;
    cutoffHasMore: boolean;
    onLoadMoreMissing: () => void;
    onLoadMoreCutoff: () => void;
    onMovieClick?: (movie: WantedMovie) => void;
    /** Quick auto-search action for missing rows — does not open the modal. Resolves to whether the request was accepted. */
    onQuickSearch?: (movieId: number) => Promise<boolean>;
    /** Queue items from SSE for download state enrichment */
    queueItems?: QueueItem[];
    /** If true, auto-fetch first page of both groups on mount */
    autoFetch?: boolean;
    fetchFirstPage?: () => void;
    /** Gates the [Search]/[Upgrade] action buttons — the underlying API calls are
     * already admin-only server-side, but non-admins should never see a button that
     * silently no-ops for them. */
    userIsAdmin: boolean;
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

interface RowProps {
    movie: WantedMovie;
    group: AttentionGroup;
    integrationId: string;
    queueMatch?: QueueItem;
    onMovieClick?: (movie: WantedMovie) => void;
    onQuickSearch?: (movieId: number) => Promise<boolean>;
    userIsAdmin: boolean;
}

const AttentionRow: React.FC<RowProps> = ({ movie, group, integrationId, queueMatch, onMovieClick, onQuickSearch, userIsAdmin }) => {
    const posterUrl = getPosterUrl(movie, integrationId);
    const title = movie.title || 'Unknown Movie';
    const year = movie.year ? String(movie.year) : '';
    const pill = getAttentionPillProps(movie);
    const { state: searchState, trigger: triggerSearch } = useAutoSearchState();

    // Shared 5-state queue-severity resolver (also used by Sonarr's equivalent
    // row) — richer than the old binary downloading-or-not check, surfacing
    // error/warning/importing/queued states that were previously silently
    // collapsed to plain missing/cutoff severity.
    const queueInfo = queueMatch ? resolveQueueSeverity(queueMatch) : null;
    const severity = queueInfo?.severity ?? (group === 'missing' ? 'missing' : 'cutoff');
    const progress = queueInfo?.showProgress ? Math.max(0, Math.min(100, queueMatch?.progress ?? 0)) : null;

    return (
        <div
            key={`attn-${group}-${movie.id}`}
            className={`rdr-attention-item rdr-attention-item--${severity}`}
            onClick={() => onMovieClick?.(movie)}
        >
            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt={title}
                    className="rdr-missing-poster"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
            ) : (
                <div className="rdr-missing-poster-placeholder">
                    <Film size={18} />
                </div>
            )}

            <div className="rdr-missing-info">
                <span className="rdr-missing-series">{title}</span>
                <div className="rdr-missing-meta">
                    {pill && <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} showLabel />}
                    {year && <span className="rdr-missing-year">{year}</span>}
                </div>
                {queueInfo && (
                    <span className="rdr-attention-queue-label" style={{ color: queueInfo.color }}>
                        {queueInfo.label}
                    </span>
                )}
                {progress !== null && (
                    <div className="media-progress-bar rdr-attention-progress">
                        <div className="media-progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>

            {progress !== null && (
                <span className="rdr-attention-progress-pct">{Math.round(progress)}%</span>
            )}
            {userIsAdmin && group === 'missing' && (
                <button
                    className={
                        'rdr-attention-action-btn' +
                        (searchState === 'searching' ? ' rdr-spin-icon' : '') +
                        (searchState === 'success' ? ' rdr-success-btn' : '') +
                        (searchState === 'error' ? ' rdr-error-btn' : '')
                    }
                    disabled={searchState === 'searching'}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!onQuickSearch) return;
                        triggerSearch(() => onQuickSearch(movie.id));
                    }}
                    aria-label={`Search for ${title}`}
                >
                    {searchState === 'searching' ? <Loader2 size={12} /> :
                        searchState === 'success' ? <Check size={12} /> :
                            searchState === 'error' ? <X size={12} /> :
                                <Search size={12} />}
                    Search
                </button>
            )}
            {userIsAdmin && group === 'cutoff' && (
                <button
                    className="rdr-attention-action-btn"
                    onClick={(e) => { e.stopPropagation(); onMovieClick?.(movie); }}
                    aria-label={`Upgrade ${title}`}
                >
                    <ArrowUpCircle size={12} /> Upgrade
                </button>
            )}
        </div>
    );
};

const MissingList = ({
    missingMovies,
    cutoffMovies,
    integrationId,
    missingLoading,
    cutoffLoading,
    missingHasMore,
    cutoffHasMore,
    onLoadMoreMissing,
    onLoadMoreCutoff,
    onMovieClick,
    onQuickSearch,
    queueItems = [],
    autoFetch,
    fetchFirstPage,
    userIsAdmin,
}: MissingListProps): React.JSX.Element => {
    // Build lookup map: movieId → QueueItem (O(1) lookups)
    const queueByMovieId = React.useMemo(() => {
        const map = new Map<number, QueueItem>();
        for (const q of queueItems) {
            if (q.movieId != null) map.set(q.movieId, q);
        }
        return map;
    }, [queueItems]);

    // Re-sort each loaded page by a normalized reference date (see
    // getAttentionReferenceDate) — Radarr's own server-side sort compares
    // whichever date field each movie happens to have, which produces a
    // confusing interleaved order across cinema/digital/physical movies.
    const sortedMissing = useMemo(() => sortByAttentionReferenceDate(missingMovies), [missingMovies]);
    const sortedCutoff = useMemo(() => sortByAttentionReferenceDate(cutoffMovies), [cutoffMovies]);

    // Auto-fetch both groups' first page once on mount (fetchFirstPage refreshes both).
    const hasFetchedRef = useRef(false);
    useEffect(() => {
        if (autoFetch && fetchFirstPage && !hasFetchedRef.current && missingMovies.length === 0 && cutoffMovies.length === 0) {
            hasFetchedRef.current = true;
            fetchFirstPage();
        }
    }, [autoFetch, fetchFirstPage, missingMovies.length, cutoffMovies.length]);

    const isEmpty = missingMovies.length === 0 && cutoffMovies.length === 0;
    const isLoading = missingLoading || cutoffLoading;

    if (isEmpty && !isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                Nothing needs attention
            </div>
        );
    }

    return (
        <div className="rdr-missing-list custom-scrollbar">
            {sortedMissing.map(movie => (
                <AttentionRow
                    key={`attn-missing-${movie.id}`}
                    movie={movie}
                    group="missing"
                    integrationId={integrationId}
                    queueMatch={queueByMovieId.get(movie.id)}
                    onMovieClick={onMovieClick}
                    onQuickSearch={onQuickSearch}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {missingLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {missingHasMore && !missingLoading && (
                <button className="rdr-load-more" onClick={onLoadMoreMissing}>
                    Load More Missing
                </button>
            )}

            {sortedCutoff.map(movie => (
                <AttentionRow
                    key={`attn-cutoff-${movie.id}`}
                    movie={movie}
                    group="cutoff"
                    integrationId={integrationId}
                    queueMatch={queueByMovieId.get(movie.id)}
                    onMovieClick={onMovieClick}
                    onQuickSearch={onQuickSearch}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {cutoffLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {cutoffHasMore && !cutoffLoading && (
                <button className="rdr-load-more" onClick={onLoadMoreCutoff}>
                    Load More Cutoff Unmet
                </button>
            )}
        </div>
    );
};

export default MissingList;
