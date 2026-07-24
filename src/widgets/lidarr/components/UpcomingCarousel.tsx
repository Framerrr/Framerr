/**
 * UpcomingCarousel - 1:1 album-cover scroll for upcoming releases.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { ReleasePill } from '../../_shared/media';
import { getAlbumCoverProxyUrl, getReleasePillProps } from '../hooks/lidarrDisplayState';
import type { CalendarAlbum } from '../lidarr.types';

interface UpcomingCarouselProps {
    albums: CalendarAlbum[];
    integrationId: string;
    onAlbumClick?: (album: CalendarAlbum) => void;
    vertical?: boolean;
    showAlbumType?: boolean;
}

function getArtistName(album: CalendarAlbum): string {
    return album.artist?.artistName || album.artistName || 'Unknown Artist';
}

function getAlbumTitle(album: CalendarAlbum): string {
    return album.title || 'Unknown Album';
}

const UpcomingCarousel = ({
    albums,
    integrationId,
    onAlbumClick,
    vertical,
    showAlbumType = true,
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
        if (vertical) return;
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
    }, [updateButtons, albums, vertical]);

    const scroll = (direction: 'left' | 'right') => {
        const el = trackRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.7;
        el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (albums.length === 0) return null;

    if (vertical) {
        return (
            <div className="ldr-carousel-list custom-scrollbar">
                {albums.map(album => {
                    const coverUrl = getAlbumCoverProxyUrl(album, integrationId);
                    const albumTitle = getAlbumTitle(album);
                    const artistName = getArtistName(album);
                    const pill = getReleasePillProps(album);
                    const albumType = showAlbumType ? album.albumType : undefined;

                    return (
                        <div
                            key={`cal-row-${album.artistId}-${album.id}`}
                            className="ldr-carousel-row"
                            onClick={() => onAlbumClick?.(album)}
                        >
                            <div className="ldr-carousel-row-poster-wrap">
                                {coverUrl ? (
                                    <img
                                        src={coverUrl}
                                        alt={albumTitle}
                                        className="ldr-carousel-row-poster"
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="ldr-carousel-row-poster-placeholder">
                                        <Music size={18} />
                                    </div>
                                )}
                            </div>
                            <div className="ldr-carousel-row-info">
                                <span className="ldr-carousel-row-title">{albumTitle}</span>
                                <span className="ldr-carousel-row-subtitle">{artistName}</span>
                                <div className="ldr-carousel-row-meta">
                                    <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                                    {albumType && (
                                        <span className="ldr-network-badge">{albumType.slice(0, 8)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="ldr-carousel">
            <div ref={trackRef} className="ldr-carousel-track">
                {albums.map(album => {
                    const coverUrl = getAlbumCoverProxyUrl(album, integrationId);
                    const albumTitle = getAlbumTitle(album);
                    const artistName = getArtistName(album);
                    const pill = getReleasePillProps(album);

                    return (
                        <div
                            key={`cal-${album.artistId}-${album.id}`}
                            className="ldr-carousel-card"
                            title={`${albumTitle} — ${artistName}`}
                            onClick={() => onAlbumClick?.(album)}
                        >
                            {coverUrl ? (
                                <img
                                    src={coverUrl}
                                    alt={albumTitle}
                                    className="ldr-carousel-poster"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="media-artwork-fallback--music ldr-carousel-poster-placeholder">
                                    <Music size={20} />
                                </div>
                            )}
                            <div className="media-gradient-overlay" />
                            <div className="ldr-carousel-card-content">
                                <ReleasePill type={pill.type} date={pill.date} dimmed={pill.dimmed} />
                                <div className="ldr-carousel-title">{albumTitle}</div>
                                <div className="ldr-carousel-subtitle">{artistName}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showLeft && (
                <button
                    className="ldr-carousel-btn ldr-carousel-btn--left"
                    onClick={() => scroll('left')}
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={14} />
                </button>
            )}
            {showRight && (
                <button
                    className="ldr-carousel-btn ldr-carousel-btn--right"
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
