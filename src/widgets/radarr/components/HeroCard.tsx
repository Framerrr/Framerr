/**
 * HeroCard - Full-bleed hero treatment for the top-sorted upcoming movie
 *
 * See docs/WIDGET_REDESIGN_MEDIA.md §1.5.
 */

import React from 'react';
import { Film } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { getPillDisplayProps } from '../hooks/radarrDisplayState';
import type { CalendarMovie, MovieDisplayInfo, RadarrImage } from '../radarr.types';

interface HeroCardProps {
    movie: CalendarMovie;
    integrationId: string;
    /** Pre-computed display info for `movie` (from `useRadarrData`'s `upcomingDisplay` map). Null when the movie has no dated milestone to show (rare). */
    display: MovieDisplayInfo | null;
    onClick?: (movie: CalendarMovie) => void;
    /** Shorter, width-scaled height instead of the 16:7 banner ratio — used in stacked mode, where full widget width made 16:7 too tall. */
    compact?: boolean;
}

function getFanartUrl(movie: CalendarMovie, integrationId: string): string | null {
    const images = movie.images;
    if (!images?.length) return null;

    const fanart = images.find((img: RadarrImage) => img.coverType === 'fanart');
    const imageUrl = fanart?.remoteUrl || fanart?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

const HeroCard: React.FC<HeroCardProps> = ({ movie, integrationId, display, onClick, compact }) => {
    const fanartUrl = getFanartUrl(movie, integrationId);
    const title = movie.title || 'Unknown';
    const pill = getPillDisplayProps(display);

    return (
        <div className={`rdr-hero ${compact ? 'rdr-hero--compact' : ''}`} onClick={() => onClick?.(movie)}>
            {fanartUrl ? (
                <img
                    src={fanartUrl}
                    alt={title}
                    className="rdr-hero-image"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
            ) : (
                <div className="media-artwork-fallback--movie rdr-hero-fallback">
                    <Film size={32} />
                </div>
            )}
            <div className="media-gradient-overlay" />
            <div className="rdr-hero-content">
                {pill && <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />}
                <div className="rdr-hero-title">{title}</div>
                {movie.year && <div className="rdr-hero-meta">{movie.year}</div>}
            </div>
        </div>
    );
};

export default HeroCard;
