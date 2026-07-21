/**
 * MissingList - "Needs Attention" section (missing + cutoff-unmet episodes)
 *
 * Renders two logical groups (missing, then cutoff-unmet) as one seamless
 * list. Left-border stripe encodes severity per
 * docs/WIDGET_REDESIGN_MEDIA.md §2 — 7 possible values (5 from the shared
 * queue-severity resolver, plus plain 'missing'/'cutoff' when the episode
 * isn't currently in the download queue at all):
 * - Red: missing entirely — [Search] quick action
 * - Amber: on disk but cutoff-unmet — [Upgrade] action (opens the modal)
 * - Error/Warning/Importing/Downloading/Queued: driven by the shared
 *   `resolveQueueSeverity` resolver when the episode is in Sonarr's queue.
 *
 * The [Search]/[Upgrade] action is gated by `group` alone, never by
 * `severity` — an episode stuck in an error/warning/queued queue state is
 * exactly when a manual re-search/upgrade is most useful.
 *
 * Each group paginates independently ("Load More" shown per-group).
 */

import React, { useEffect, useRef } from 'react';
import { MonitorPlay, Loader2, Search, ArrowUpCircle, Check, X } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { resolveQueueSeverity } from '../../_shared/media/queueSeverity';
import { getEpisodePillProps } from '../hooks/sonarrDisplayState';
import { useAutoSearchState } from '../../radarr/hooks/useAutoSearchState';
import type { WantedEpisode, SonarrImage, QueueItem } from '../sonarr.types';

type AttentionGroup = 'missing' | 'cutoff';

interface MissingListProps {
    missingEpisodes: WantedEpisode[];
    cutoffEpisodes: WantedEpisode[];
    integrationId: string;
    missingLoading: boolean;
    cutoffLoading: boolean;
    missingHasMore: boolean;
    cutoffHasMore: boolean;
    onLoadMoreMissing: () => void;
    onLoadMoreCutoff: () => void;
    onEpisodeClick?: (episode: WantedEpisode) => void;
    /** Quick auto-search action for missing rows — does not open the modal. Resolves to whether the request was accepted. */
    onQuickSearch?: (episodeId: number) => Promise<boolean>;
    /** Queue items from SSE for download state enrichment */
    queueItems?: QueueItem[];
    /** If true, auto-fetch first page of both groups on mount */
    autoFetch?: boolean;
    fetchFirstPage?: () => void;
    /** Render the network badge (per Task Requirement's Verification Extensions: network badge must render on Needs Attention rows too, not just Hero/mini-scroll). */
    showNetwork?: boolean;
    /** Gates the [Search]/[Upgrade] action buttons — the underlying API calls are
     * already admin-only server-side, but non-admins should never see a button that
     * silently no-ops for them. */
    userIsAdmin: boolean;
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

function formatEpCode(ep: WantedEpisode): string {
    if (ep.seasonNumber == null || ep.episodeNumber == null) return '';
    return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`;
}

interface RowProps {
    episode: WantedEpisode;
    group: AttentionGroup;
    integrationId: string;
    queueMatch?: QueueItem;
    onEpisodeClick?: (episode: WantedEpisode) => void;
    onQuickSearch?: (episodeId: number) => Promise<boolean>;
    showNetwork?: boolean;
    userIsAdmin: boolean;
}

const AttentionRow: React.FC<RowProps> = ({ episode, group, integrationId, queueMatch, onEpisodeClick, onQuickSearch, showNetwork, userIsAdmin }) => {
    const posterUrl = getPosterUrl(episode, integrationId);
    const seriesTitle = episode.series?.title || 'Unknown Series';
    const epCode = formatEpCode(episode);
    const epTitle = episode.title || 'TBA';
    const pill = getEpisodePillProps(episode);
    const network = showNetwork ? episode.series?.network : undefined;
    const { state: searchState, trigger: triggerSearch } = useAutoSearchState();

    const queueInfo = queueMatch ? resolveQueueSeverity(queueMatch) : null;
    const severity = queueInfo?.severity ?? (group === 'missing' ? 'missing' : 'cutoff');
    const progress = queueInfo?.showProgress ? Math.max(0, Math.min(100, queueMatch?.progress ?? 0)) : null;

    return (
        <div
            key={`attn-${group}-${episode.id}`}
            className={`snr-attention-item snr-attention-item--${severity}`}
            onClick={() => onEpisodeClick?.(episode)}
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
                    <MonitorPlay size={18} />
                </div>
            )}

            <div className="snr-missing-info">
                <span className="snr-missing-series">{seriesTitle}</span>
                <div className="snr-missing-meta">
                    <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                    {network && <span className="snr-network-badge">{network.slice(0, 8)}</span>}
                    {epCode && <span className="snr-missing-episode">{epCode} · {epTitle}</span>}
                </div>
                {queueInfo && (
                    <span className="snr-attention-queue-label" style={{ color: queueInfo.color }}>
                        {queueInfo.label}
                    </span>
                )}
                {progress !== null && (
                    <div className="media-progress-bar snr-attention-progress">
                        <div className="media-progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>

            {progress !== null && (
                <span className="snr-attention-progress-pct">{Math.round(progress)}%</span>
            )}
            {userIsAdmin && group === 'missing' && (
                <button
                    className={
                        'snr-attention-action-btn' +
                        (searchState === 'searching' ? ' snr-spin-icon' : '') +
                        (searchState === 'success' ? ' snr-success-btn' : '') +
                        (searchState === 'error' ? ' snr-error-btn' : '')
                    }
                    disabled={searchState === 'searching'}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!onQuickSearch) return;
                        triggerSearch(() => onQuickSearch(episode.id));
                    }}
                    aria-label={`Search for ${seriesTitle}`}
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
                    className="snr-attention-action-btn"
                    onClick={(e) => { e.stopPropagation(); onEpisodeClick?.(episode); }}
                    aria-label={`Upgrade ${seriesTitle}`}
                >
                    <ArrowUpCircle size={12} /> Upgrade
                </button>
            )}
        </div>
    );
};

const MissingList = ({
    missingEpisodes,
    cutoffEpisodes,
    integrationId,
    missingLoading,
    cutoffLoading,
    missingHasMore,
    cutoffHasMore,
    onLoadMoreMissing,
    onLoadMoreCutoff,
    onEpisodeClick,
    onQuickSearch,
    queueItems = [],
    autoFetch,
    fetchFirstPage,
    showNetwork,
    userIsAdmin,
}: MissingListProps): React.JSX.Element => {
    // Build lookup map: episodeId → QueueItem (O(1) lookups)
    const queueByEpisodeId = React.useMemo(() => {
        const map = new Map<number, QueueItem>();
        for (const q of queueItems) {
            if (q.episodeId != null) map.set(q.episodeId, q);
        }
        return map;
    }, [queueItems]);

    // No client re-sort needed — /proxy/missing and /proxy/cutoff already
    // sort by airDateUtc descending server-side, and episodes have only one
    // date field, so there's no cross-date-type interleaving to normalize.

    // Auto-fetch both groups' first page once on mount (fetchFirstPage refreshes both).
    const hasFetchedRef = useRef(false);
    useEffect(() => {
        if (autoFetch && fetchFirstPage && !hasFetchedRef.current && missingEpisodes.length === 0 && cutoffEpisodes.length === 0) {
            hasFetchedRef.current = true;
            fetchFirstPage();
        }
    }, [autoFetch, fetchFirstPage, missingEpisodes.length, cutoffEpisodes.length]);

    const isEmpty = missingEpisodes.length === 0 && cutoffEpisodes.length === 0;
    const isLoading = missingLoading || cutoffLoading;

    if (isEmpty && !isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                Nothing needs attention
            </div>
        );
    }

    return (
        <div className="snr-missing-list custom-scrollbar">
            {missingEpisodes.map(episode => (
                <AttentionRow
                    key={`attn-missing-${episode.id}`}
                    episode={episode}
                    group="missing"
                    integrationId={integrationId}
                    queueMatch={queueByEpisodeId.get(episode.id)}
                    onEpisodeClick={onEpisodeClick}
                    onQuickSearch={onQuickSearch}
                    showNetwork={showNetwork}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {missingLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {missingHasMore && !missingLoading && (
                <button className="snr-load-more" onClick={onLoadMoreMissing}>
                    Load More Missing
                </button>
            )}

            {cutoffEpisodes.map(episode => (
                <AttentionRow
                    key={`attn-cutoff-${episode.id}`}
                    episode={episode}
                    group="cutoff"
                    integrationId={integrationId}
                    queueMatch={queueByEpisodeId.get(episode.id)}
                    onEpisodeClick={onEpisodeClick}
                    onQuickSearch={onQuickSearch}
                    showNetwork={showNetwork}
                    userIsAdmin={userIsAdmin}
                />
            ))}

            {cutoffLoading && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            )}
            {cutoffHasMore && !cutoffLoading && (
                <button className="snr-load-more" onClick={onLoadMoreCutoff}>
                    Load More Cutoff Unmet
                </button>
            )}
        </div>
    );
};

export default MissingList;
