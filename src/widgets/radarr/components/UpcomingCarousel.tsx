/**
 * UpcomingCarousel - Upcoming movie poster display
 * 
 * Two modes:
 * - Horizontal carousel (default): scrollable poster cards with chevron nav
 * - Vertical stack (vertical=true): landscape cards with fanart, stacked
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Film } from 'lucide-react';
import type { CalendarMovie, RadarrImage } from '../radarr.types';

interface UpcomingCarouselProps {
    movies: CalendarMovie[];
    integrationId: string;
    onMovieClick?: (movie: CalendarMovie) => void;
    /** When true, render as vertical stacked cards (landscape style) */
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

/** Get fanart (landscape backdrop) URL, falls back to poster */
function getFanartUrl(movie: CalendarMovie, integrationId: string): string | null {
    const images = movie.images;
    if (!images?.length) return null;

    const fanart = images.find((img: RadarrImage) => img.coverType === 'fanart');
    const imageUrl = fanart?.remoteUrl || fanart?.url;
    if (imageUrl) {
        return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
    }

    // Fall back to poster if no fanart available
    return getPosterUrl(movie, integrationId);
}

/** Format release date — primarydigitalRelease, fallback to inCinemas */
function formatReleaseDate(movie: CalendarMovie): string {
    const dateStr = movie.digitalRelease || movie.inCinemas;
    if (!dateStr) return 'TBA';

    const releaseDate = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}d`;

    return releaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const UpcomingCarousel = ({ movies, integrationId, onMovieClick, vertical = false }: UpcomingCarouselProps): React.JSX.Element | null => {
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
    }, [updateButtons, movies, vertical]);

    const scroll = (direction: 'left' | 'right') => {
        const el = trackRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.7;
        el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (movies.length === 0) return null;

    // ── Vertical stacked mode (landscape cards) ──
    if (vertical) {
        return (
            <div className="rdr-stack">
                {movies.map(movie => {
                    const fanartUrl = getFanartUrl(movie, integrationId);
                    const title = movie.title || 'Unknown';

                    return (
                        <div
                            key={`stack-${movie.id}`}
                            className="rdr-stack-card"
                            onClick={() => onMovieClick?.(movie)}
                        >
                            {fanartUrl ? (
                                <img
                                    src={fanartUrl}
                                    alt={title}
                                    className="rdr-stack-poster"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="rdr-stack-poster-placeholder">
                                    <Film size={24} />
                                </div>
                            )}
                            {/* Gradient overlay with title */}
                            <div className="rdr-stack-overlay">
                                <div className="rdr-stack-title">{title}</div>
                                <div className="rdr-stack-subtitle">
                                    {movie.year && `${movie.year} · `}{formatReleaseDate(movie)}
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
        <div className="rdr-carousel">
            <div ref={trackRef} className="rdr-carousel-track">
                {movies.map(movie => {
                    const posterUrl = getPosterUrl(movie, integrationId);
                    const title = movie.title || 'Unknown';

                    return (
                        <div
                            key={`cal-${movie.id}`}
                            className="rdr-carousel-card"
                            onClick={() => onMovieClick?.(movie)}
                        >
                            {posterUrl ? (
                                <img
                                    src={posterUrl}
                                    alt={title}
                                    className="rdr-carousel-poster"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="rdr-carousel-poster-placeholder">
                                    <Film size={20} />
                                </div>
                            )}
                            <div className="rdr-carousel-info">
                                <div className="rdr-carousel-title">{title}</div>
                                <div className="rdr-carousel-subtitle">
                                    {movie.year && `${movie.year} · `}{formatReleaseDate(movie)}
                                </div>
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
