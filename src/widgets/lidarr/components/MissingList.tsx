/**
 * MissingList - "Needs Attention" section (missing + cutoff-unmet albums)
 */

import React, { useEffect, useRef } from 'react';
import { Music, Loader2, Search, ArrowUpCircle, Check, X } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { resolveQueueSeverity } from '../../_shared/media/queueSeverity';
import { getAlbumCoverProxyUrl, getReleasePillProps } from '../hooks/lidarrDisplayState';
import { useAutoSearchState } from '../../radarr/hooks/useAutoSearchState';
import type { WantedAlbum, QueueItem } from '../lidarr.types';

type AttentionGroup = 'missing' | 'cutoff';

interface MissingListProps {
    missingAlbums: WantedAlbum[];
    cutoffAlbums: WantedAlbum[];
    integrationId: string;
    missingLoading: boolean;
    cutoffLoading: boolean;
    missingHasMore: boolean;
    cutoffHasMore: boolean;
    onLoadMoreMissing: () => void;
    onLoadMoreCutoff: () => void;
    onAlbumClick?: (album: WantedAlbum) => void;
    onQuickSearch?: (albumId: number) => Promise<boolean>;
    queueItems?: QueueItem[];
    autoFetch?: boolean;
    fetchFirstPage?: () => void;
    showAlbumType?: boolean;
    userIsAdmin: boolean;
}

function getArtistName(album: WantedAlbum): string {
    return album.artist?.artistName || 'Unknown Artist';
}

interface RowProps {
    album: WantedAlbum;
    group: AttentionGroup;
    integrationId: string;
    queueMatch?: QueueItem;
    onAlbumClick?: (album: WantedAlbum) => void;
    onQuickSearch?: (albumId: number) => Promise<boolean>;
    showAlbumType?: boolean;
    userIsAdmin: boolean;
}

const AttentionRow: React.FC<RowProps> = ({
    album,
    group,
    integrationId,
    queueMatch,
    onAlbumClick,
    onQuickSearch,
    showAlbumType,
    userIsAdmin,
}) => {
    const posterUrl = getAlbumCoverProxyUrl(album, integrationId);
    const artistName = getArtistName(album);
    const albumTitle = album.title || 'Unknown Album';
    const pill = getReleasePillProps(album);
    const albumType = showAlbumType ? album.albumType : undefined;
    const { state: searchState, trigger: triggerSearch } = useAutoSearchState();

    const queueInfo = queueMatch ? resolveQueueSeverity(queueMatch) : null;
    const severity = queueInfo?.severity ?? (group === 'missing' ? 'missing' : 'cutoff');
    const progress = queueInfo?.showProgress ? Math.max(0, Math.min(100, queueMatch?.progress ?? 0)) : null;

    return (
        <div
            key={`attn-${group}-${album.id}`}
            className={`ldr-attention-item ldr-attention-item--${severity}`}
            onClick={() => onAlbumClick?.(album)}
        >
            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt={artistName}
                    className="ldr-missing-poster"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
            ) : (
                <div className="ldr-missing-poster-placeholder">
                    <Music size={18} />
                </div>
            )}

            <div className="ldr-missing-info">
                <span className="ldr-missing-series">{albumTitle}</span>
                <div className="ldr-missing-meta">
                    <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                    {albumType && <span className="ldr-network-badge">{albumType.slice(0, 8)}</span>}
                    <span className="ldr-missing-episode">{artistName}</span>
                </div>
                {queueInfo && (
                    <span className="ldr-attention-queue-label" style={{ color: queueInfo.color }}>
                        {queueInfo.label}
                    </span>
                )}
                {progress !== null && (
                    <div className="media-progress-bar ldr-attention-progress">
                        <div className="media-progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>

            {progress !== null && (
                <span className="ldr-attention-progress-pct">{Math.round(progress)}%</span>
            )}
            {userIsAdmin && group === 'missing' && (
                <button
                    className={
                        'ldr-attention-action-btn' +
                        (searchState === 'searching' ? ' ldr-spin-icon' : '') +
                        (searchState === 'success' ? ' ldr-success-btn' : '') +
                        (searchState === 'error' ? ' ldr-error-btn' : '')
                    }
                    disabled={searchState === 'searching'}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!onQuickSearch) return;
                        triggerSearch(() => onQuickSearch(album.id));
                    }}
                    aria-label={`Search for ${artistName}`}
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
                    className="ldr-attention-action-btn"
                    onClick={(e) => { e.stopPropagation(); onAlbumClick?.(album); }}
                    aria-label={`Upgrade ${artistName}`}
                >
                    <ArrowUpCircle size={12} /> Upgrade
                </button>
            )}
        </div>
    );
};

const MissingList = ({
    missingAlbums,
    cutoffAlbums,
    integrationId,
    missingLoading,
    cutoffLoading,
    missingHasMore,
    cutoffHasMore,
    onLoadMoreMissing,
    onLoadMoreCutoff,
    onAlbumClick,
    onQuickSearch,
    queueItems = [],
    autoFetch,
    fetchFirstPage,
    showAlbumType,
    userIsAdmin,
}: MissingListProps): React.JSX.Element => {
    const queueByAlbumId = React.useMemo(() => {
        const map = new Map<number, QueueItem>();
        for (const q of queueItems) {
            if (q.albumId != null) map.set(q.albumId, q);
        }
        return map;
    }, [queueItems]);

    const hasFetchedRef = useRef(false);
    useEffect(() => {
        if (autoFetch && fetchFirstPage && !hasFetchedRef.current && missingAlbums.length === 0 && cutoffAlbums.length === 0) {
            hasFetchedRef.current = true;
            fetchFirstPage();
        }
    }, [autoFetch, fetchFirstPage, missingAlbums.length, cutoffAlbums.length]);

    const isEmpty = missingAlbums.length === 0 && cutoffAlbums.length === 0;
    const isLoading = missingLoading || cutoffLoading;

    if (isEmpty && !isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                Nothing needs attention
            </div>
        );
    }

    return (
        <div className="ldr-missing-list custom-scrollbar">
            {missingAlbums.map(album => (
                <AttentionRow
                    key={`attn-missing-${album.id}`}
                    album={album}
                    group="missing"
                    integrationId={integrationId}
                    queueMatch={queueByAlbumId.get(album.id)}
                    onAlbumClick={onAlbumClick}
                    onQuickSearch={onQuickSearch}
                    showAlbumType={showAlbumType}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {missingLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {missingHasMore && !missingLoading && (
                <button className="ldr-load-more" onClick={onLoadMoreMissing}>
                    Load More Missing
                </button>
            )}

            {cutoffAlbums.map(album => (
                <AttentionRow
                    key={`attn-cutoff-${album.id}`}
                    album={album}
                    group="cutoff"
                    integrationId={integrationId}
                    queueMatch={queueByAlbumId.get(album.id)}
                    onAlbumClick={onAlbumClick}
                    onQuickSearch={onQuickSearch}
                    showAlbumType={showAlbumType}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {cutoffLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {cutoffHasMore && !cutoffLoading && (
                <button className="ldr-load-more" onClick={onLoadMoreCutoff}>
                    Load More Cutoff Unmet
                </button>
            )}
        </div>
    );
};

export default MissingList;
