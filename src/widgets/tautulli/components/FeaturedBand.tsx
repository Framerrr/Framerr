/**
 * FeaturedBand — non-scrolling row of 16:9 cards that evenly share width.
 * Used as the "hero strip" above the remainder list in each Tautulli tab.
 */

import React from 'react';
import { Film, Tv, User } from 'lucide-react';
import '../../_shared/media/media.css';

export interface FeaturedBandItem {
    key: string;
    title: string;
    meta: string;
    /** Backdrop / poster URL for content cards */
    imageUrl: string | null;
    /** Poster URL if backdrop fails (stats often lack real art) */
    fallbackImageUrl?: string | null;
    variant: 'content' | 'user';
    /** Avatar URL for user cards (shown over soft gradient) */
    avatarUrl?: string | null;
    mediaType?: string;
}

interface FeaturedBandProps {
    items: FeaturedBandItem[];
}

const FeaturedBand = ({ items }: FeaturedBandProps): React.JSX.Element | null => {
    if (items.length === 0) return null;

    return (
        <div
            className="tautulli-featured"
            style={{ '--featured-count': items.length } as React.CSSProperties}
        >
            {items.map((item, idx) => {
                const rank = idx + 1;
                const isEpisode = item.mediaType === 'episode';
                const PlaceholderIcon = item.variant === 'user' ? User : isEpisode ? Tv : Film;

                return (
                    <div
                        key={item.key}
                        className={`tautulli-featured-card ${item.variant === 'user' ? 'tautulli-featured-card--user' : ''}`}
                        title={item.title}
                    >
                        {item.variant === 'content' && item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="tautulli-featured-image"
                                loading="lazy"
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    const fallback = item.fallbackImageUrl;
                                    if (fallback && img.dataset.fallbackTried !== '1' && img.src !== fallback) {
                                        img.dataset.fallbackTried = '1';
                                        img.src = fallback;
                                        return;
                                    }
                                    img.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div
                                className={`tautulli-featured-fallback ${
                                    item.variant === 'user'
                                        ? 'tautulli-featured-fallback--user'
                                        : `media-artwork-fallback--${isEpisode ? 'tv' : 'movie'}`
                                }`}
                            >
                                {item.variant === 'user' && item.avatarUrl ? (
                                    <img
                                        src={item.avatarUrl}
                                        alt={item.title}
                                        className="tautulli-featured-avatar"
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <PlaceholderIcon size={item.variant === 'user' ? 28 : 22} />
                                )}
                            </div>
                        )}
                        <div className="media-gradient-overlay" />
                        <span className="tautulli-card-rank tautulli-card-rank--featured">{rank}</span>
                        <div className="tautulli-featured-content">
                            <div className="tautulli-featured-title media-overlay-text">{item.title}</div>
                            {item.meta && (
                                <div className="tautulli-featured-meta media-overlay-text">{item.meta}</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FeaturedBand;
