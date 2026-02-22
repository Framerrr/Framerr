/**
 * UpcomingCarousel - Upcoming episode poster display
 * 
 * Two modes:
 * - Horizontal carousel (default): scrollable poster cards with chevron nav
 * - Vertical stack (vertical=true): Overseerr-style landscape cards, stacked
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MonitorPlay } from 'lucide-react';
import type { CalendarEpisode, SonarrImage } from '../sonarr.types';

interface UpcomingCarouselProps {
    episodes: CalendarEpisode[];
    integrationId: string;
    onEpisodeClick?: (episode: CalendarEpisode) => void;
    /** When true, render as vertical stacked cards (Overseerr stacked style) */
    vertical?: boolean;
}

/** Get series poster URL, proxied through backend */
function getPosterUrl(episode: CalendarEpisode, integrationId: string): string | null {
    const images = episode.series?.images;
    if (!images?.length) return null;

    const poster = images.find((img: SonarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

/** Get fanart (landscape backdrop) URL, falls back to poster */
function getFanartUrl(episode: CalendarEpisode, integrationId: string): string | null {
    const images = episode.series?.images;
    if (!images?.length) return null;

    const fanart = images.find((img: SonarrImage) => img.coverType === 'fanart');
    const imageUrl = fanart?.remoteUrl || fanart?.url;
    if (imageUrl) {
        return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
    }

    // Fall back to poster if no fanart available
    return getPosterUrl(episode, integrationId);
}

/** Format air date as relative or short date */
function formatAirDate(episode: CalendarEpisode): string {
    const dateStr = episode.airDateUtc || episode.airDate;
    if (!dateStr) return 'TBA';

    const airDate = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((airDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}d`;

    return airDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const UpcomingCarousel = ({ episodes, integrationId, onEpisodeClick, vertical = false }: UpcomingCarouselProps): React.JSX.Element | null => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(false);

    const updateButtons = useCallback(() => {
        const el = trackRef.current;
        if (!el) return;
        setShowLeft(el.scrollLeft > 10);
        setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    }, []);

    useEffect(() => {
        if (vertical) return; // No scroll buttons in vertical mode
        const el = trackRef.current;
        if (!el) return;
        updateButtons();
        el.addEventListener('scroll', updateButtons, { passive: true });
        const ro = new ResizeObserver(updateButtons);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', updateButtons);
            ro.disconnect();
        };
    }, [updateButtons, episodes, vertical]);

    const scroll = (direction: 'left' | 'right') => {
        const el = trackRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.7;
        el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (episodes.length === 0) return null;

    // ── Vertical stacked mode (Overseerr-style landscape cards) ──
    if (vertical) {
        return (
            <div className="snr-stack">
                {episodes.map(ep => {
                    const fanartUrl = getFanartUrl(ep, integrationId);
                    const seriesTitle = ep.series?.title || ep.seriesTitle || 'Unknown';
                    const epCode = ep.seasonNumber != null && ep.episodeNumber != null
                        ? `S${ep.seasonNumber}E${ep.episodeNumber}`
                        : '';

                    return (
                        <div
                            key={`stack-${ep.seriesId}-${ep.id}`}
                            className="snr-stack-card"
                            onClick={() => onEpisodeClick?.(ep)}
                        >
                            {fanartUrl ? (
                                <img
                                    src={fanartUrl}
                                    alt={seriesTitle}
                                    className="snr-stack-poster"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="snr-stack-poster-placeholder">
                                    <MonitorPlay size={24} />
                                </div>
                            )}
                            {/* Gradient overlay with title */}
                            <div className="snr-stack-overlay">
                                <div className="snr-stack-title">{seriesTitle}</div>
                                <div className="snr-stack-subtitle">
                                    {epCode && `${epCode} · `}{formatAirDate(ep)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ── Horizontal carousel mode (default) ──
    return (
        <div className="snr-carousel">
            <div ref={trackRef} className="snr-carousel-track">
                {episodes.map(ep => {
                    const posterUrl = getPosterUrl(ep, integrationId);
                    const seriesTitle = ep.series?.title || ep.seriesTitle || 'Unknown';
                    const epCode = ep.seasonNumber != null && ep.episodeNumber != null
                        ? `S${ep.seasonNumber}E${ep.episodeNumber}`
                        : '';

                    return (
                        <div
                            key={`cal-${ep.seriesId}-${ep.id}`}
                            className="snr-carousel-card"
                            onClick={() => onEpisodeClick?.(ep)}
                        >
                            {posterUrl ? (
                                <img
                                    src={posterUrl}
                                    alt={seriesTitle}
                                    className="snr-carousel-poster"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="snr-carousel-poster-placeholder">
                                    <MonitorPlay size={20} />
                                </div>
                            )}
                            <div className="snr-carousel-info">
                                <div className="snr-carousel-title">{seriesTitle}</div>
                                <div className="snr-carousel-subtitle">
                                    {epCode && `${epCode} · `}{formatAirDate(ep)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showLeft && (
                <button
                    className="snr-carousel-btn snr-carousel-btn--left"
                    onClick={() => scroll('left')}
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={14} />
                </button>
            )}
            {showRight && (
                <button
                    className="snr-carousel-btn snr-carousel-btn--right"
                    onClick={() => scroll('right')}
                    aria-label="Scroll right"
                >
                    <ChevronRight size={14} />
                </button>
            )}
        </div>
    );
};

export default UpcomingCarousel;
