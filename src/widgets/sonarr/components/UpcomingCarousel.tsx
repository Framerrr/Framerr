/**
 * UpcomingCarousel - Mini poster scroll for upcoming episodes (everything
 * after the hero item).
 *
 * Two layouts, mirroring radarr/components/UpcomingCarousel.tsx's final
 * structure:
 * - Horizontal (default): compact poster strip. Used in stacked mode.
 * - Vertical (`vertical` prop): scrollable row list. Used in column/wide mode.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MonitorPlay } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { getEpisodePillProps, getPremiereType } from '../hooks/sonarrDisplayState';
import type { CalendarEpisode, SonarrImage } from '../sonarr.types';

interface UpcomingCarouselProps {
    episodes: CalendarEpisode[];
    integrationId: string;
    onEpisodeClick?: (episode: CalendarEpisode) => void;
    /** Render as a scrollable vertical row list instead of a horizontal strip. */
    vertical?: boolean;
    highlightPremieres: boolean;
    showNetwork: boolean;
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

const UpcomingCarousel = ({
    episodes,
    integrationId,
    onEpisodeClick,
    vertical,
    highlightPremieres,
    showNetwork,
}: UpcomingCarouselProps): React.JSX.Element | null => {
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

    if (vertical) {
        return (
            <div className="snr-carousel-list custom-scrollbar">
                {episodes.map(ep => {
                    const posterUrl = getPosterUrl(ep, integrationId);
                    const seriesTitle = ep.series?.title || ep.seriesTitle || 'Unknown';
                    const pill = getEpisodePillProps(ep);
                    const premiereType = highlightPremieres ? getPremiereType(ep) : null;
                    const network = showNetwork ? ep.series?.network : undefined;

                    return (
                        <div
                            key={`cal-row-${ep.seriesId}-${ep.id}`}
                            className="snr-carousel-row"
                            onClick={() => onEpisodeClick?.(ep)}
                        >
                            <div className="snr-carousel-row-poster-wrap">
                                {posterUrl ? (
                                    <img
                                        src={posterUrl}
                                        alt={seriesTitle}
                                        className="snr-carousel-row-poster"
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="snr-carousel-row-poster-placeholder">
                                        <MonitorPlay size={14} />
                                    </div>
                                )}
                                {premiereType && (
                                    <span className="snr-premiere-badge snr-premiere-badge--sm">
                                        {premiereType === 'series' ? 'SERIES' : 'PREMIERE'}
                                    </span>
                                )}
                            </div>
                            <div className="snr-carousel-row-info">
                                <span className="snr-carousel-row-title">{seriesTitle}</span>
                                <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                            </div>
                            {network && <span className="snr-network-badge">{network.slice(0, 8)}</span>}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="snr-carousel">
            <div ref={trackRef} className="snr-carousel-track">
                {episodes.map(ep => {
                    const posterUrl = getPosterUrl(ep, integrationId);
                    const seriesTitle = ep.series?.title || ep.seriesTitle || 'Unknown';
                    const pill = getEpisodePillProps(ep);
                    const premiereType = highlightPremieres ? getPremiereType(ep) : null;

                    return (
                        <div
                            key={`cal-${ep.seriesId}-${ep.id}`}
                            className="snr-carousel-card"
                            title={seriesTitle}
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
                                <div className="media-artwork-fallback--tv snr-carousel-poster-placeholder">
                                    <MonitorPlay size={20} />
                                </div>
                            )}
                            <div className="media-gradient-overlay" />
                            {premiereType && (
                                <span className="snr-premiere-badge snr-premiere-badge--sm">
                                    {premiereType === 'series' ? 'SERIES' : 'PREMIERE'}
                                </span>
                            )}
                            <div className="snr-carousel-card-content">
                                <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                                <div className="snr-carousel-title">{seriesTitle}</div>
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
