/**
 * UpcomingCarousel - Mini poster scroll for upcoming movies (everything
 * after the hero item).
 *
 * Two layouts, chosen by the parent based on the widget's current
 * column/stacked mode (fine-tune iteration on top of spec §1.6):
 * - Horizontal (default): compact poster strip. Used in stacked mode, where
 *   the Upcoming section should stay short and leave room for Needs Attention.
 * - Vertical (`vertical` prop): scrollable row list. Used in column/wide
 *   mode, where the Upcoming column is narrow but full-height — a horizontal
 *   strip would leave most of that height empty.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { getPillDisplayProps } from '../hooks/radarrDisplayState';
import type { CalendarMovie, MovieDisplayInfo, RadarrImage } from '../radarr.types';

interface UpcomingCarouselProps {
    movies: CalendarMovie[];
    /** Pre-computed display info per movie id, from `useRadarrData`'s `upcomingDisplay` map — never recompute locally, it must match how `movies` was filtered/sorted. */
    displayMap: Map<number, MovieDisplayInfo>;
    integrationId: string;
    onMovieClick?: (movie: CalendarMovie) => void;
    /** Render as a scrollable vertical row list instead of a horizontal strip. */
    vertical?: boolean;
}

/** Get movie poster URL, proxied through backend */
function getPosterUrl(movie: CalendarMovie, integrationId: string): string | null {
    const images = movie.images;
    if (!images?.length) return null;

    const poster = images.find((img: RadarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

const UpcomingCarousel = ({ movies, displayMap, integrationId, onMovieClick, vertical }: UpcomingCarouselProps): React.JSX.Element | null => {
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
    }, [updateButtons, movies]);

    const scroll = (direction: 'left' | 'right') => {
        const el = trackRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.7;
        el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (movies.length === 0) return null;

    if (vertical) {
        return (
            <div className="rdr-carousel-list custom-scrollbar">
                {movies.map(movie => {
                    const posterUrl = getPosterUrl(movie, integrationId);
                    const title = movie.title || 'Unknown';
                    const pill = getPillDisplayProps(displayMap.get(movie.id) ?? null, { compact: true });

                    return (
                        <div
                            key={`cal-row-${movie.id}`}
                            className="rdr-carousel-row"
                            onClick={() => onMovieClick?.(movie)}
                        >
                            {posterUrl ? (
                                <img
                                    src={posterUrl}
                                    alt={title}
                                    className="rdr-carousel-row-poster"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="rdr-carousel-row-poster-placeholder">
                                    <Film size={14} />
                                </div>
                            )}
                            <div className="rdr-carousel-row-info">
                                <span className="rdr-carousel-row-title">{title}</span>
                                {pill && <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="rdr-carousel">
            <div ref={trackRef} className="rdr-carousel-track">
                {movies.map(movie => {
                    const posterUrl = getPosterUrl(movie, integrationId);
                    const title = movie.title || 'Unknown';
                    const pill = getPillDisplayProps(displayMap.get(movie.id) ?? null, { compact: true });

                    return (
                        <div
                            key={`cal-${movie.id}`}
                            className="rdr-carousel-card"
                            title={title}
                            onClick={() => onMovieClick?.(movie)}
                        >
                            {posterUrl ? (
                                <img
                                    src={posterUrl}
                                    alt={title}
                                    className="rdr-carousel-poster"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="media-artwork-fallback--movie rdr-carousel-poster-placeholder">
                                    <Film size={20} />
                                </div>
                            )}
                            <div className="media-gradient-overlay" />
                            <div className="rdr-carousel-card-content">
                                {pill && <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />}
                                <div className="rdr-carousel-title">{title}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showLeft && (
                <button
                    className="rdr-carousel-btn rdr-carousel-btn--left"
                    onClick={() => scroll('left')}
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={14} />
                </button>
            )}
            {showRight && (
                <button
                    className="rdr-carousel-btn rdr-carousel-btn--right"
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
