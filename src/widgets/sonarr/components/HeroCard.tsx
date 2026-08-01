/**
 * HeroCard - Full-bleed hero treatment for the top-sorted upcoming episode
 *
 * See docs/private/widgets/WIDGET_REDESIGN_MEDIA.md §2.1. Mirrors radarr/components/HeroCard.tsx
 * structurally, with Sonarr-specific additions: premiere badge, network badge,
 * season progress bar.
 */

import React from 'react';
import { MonitorPlay } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { getEpisodePillProps, getPremiereType, getSeasonProgress } from '../hooks/sonarrDisplayState';
import type { CalendarEpisode, SonarrImage } from '../sonarr.types';

interface HeroCardProps {
    episode: CalendarEpisode;
    integrationId: string;
    onClick?: (episode: CalendarEpisode) => void;
    /** Shorter, width-scaled height instead of the 16:7 banner ratio — used in stacked mode. */
    compact?: boolean;
    showNetwork: boolean;
    highlightPremieres: boolean;
    showSeasonProgress: boolean;
}

/** Landscape backdrop only — never poster (cover-cropping a poster looks zoomed-in). */
function getFanartUrl(episode: CalendarEpisode, integrationId: string): string | null {
    const images = episode.series?.images;
    if (!images?.length) return null;

    const type = (img: SonarrImage) => (img.coverType || '').toLowerCase();
    const pick =
        images.find((img) => type(img) === 'fanart')
        || images.find((img) => type(img) === 'banner')
        || images.find((img) => /fanart/i.test(img.remoteUrl || img.url || ''));
    const imageUrl = pick?.remoteUrl || pick?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

const HeroCard: React.FC<HeroCardProps> = ({
    episode,
    integrationId,
    onClick,
    compact,
    showNetwork,
    highlightPremieres,
    showSeasonProgress,
}) => {
    const fanartUrl = getFanartUrl(episode, integrationId);
    const seriesTitle = episode.series?.title || episode.seriesTitle || 'Unknown Series';
    const epCode = episode.seasonNumber != null && episode.episodeNumber != null
        ? `S${episode.seasonNumber}E${episode.episodeNumber}`
        : '';
    const pill = getEpisodePillProps(episode);
    const premiereType = highlightPremieres ? getPremiereType(episode) : null;
    const network = showNetwork ? episode.series?.network : undefined;
    const seasonProgress = showSeasonProgress ? getSeasonProgress(episode.series?.statistics) : null;

    return (
        <div className={`snr-hero ${compact ? 'snr-hero--compact' : ''}`} onClick={() => onClick?.(episode)}>
            {fanartUrl ? (
                <img
                    src={fanartUrl}
                    alt={seriesTitle}
                    className="snr-hero-image"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
            ) : (
                <div className="media-artwork-fallback--tv snr-hero-fallback">
                    <MonitorPlay size={32} />
                </div>
            )}
            <div className="media-gradient-overlay" />
            {premiereType && (
                <span className="snr-premiere-badge">
                    {premiereType === 'series' ? 'SERIES PREMIERE' : 'PREMIERE'}
                </span>
            )}
            <div className="snr-hero-content">
                <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                <div className="snr-hero-title">{seriesTitle}</div>
                <div className="snr-hero-meta-row">
                    {epCode && <span className="snr-hero-meta">{epCode}{episode.title ? ` · ${episode.title}` : ''}</span>}
                    {network && (
                        <span className="snr-network-badge" title={network}>
                            {network}
                        </span>
                    )}
                </div>
                {seasonProgress && (
                    <div className="snr-hero-season-progress-wrap">
                        <div className="snr-hero-season-progress">
                            <div className="snr-hero-season-progress-fill" style={{ width: `${seasonProgress.fraction * 100}%` }} />
                        </div>
                        <span className="snr-hero-season-progress-text">
                            {seasonProgress.episodeFileCount} / {seasonProgress.episodeCount} episodes
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeroCard;
