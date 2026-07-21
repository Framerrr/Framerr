/**
 * RemainderList — compact ranked rows under the featured band.
 * Handles posters (media) and avatars (users) in one list.
 */

import React from 'react';
import { Film, Tv, User } from 'lucide-react';

export interface RemainderListItem {
    key: string;
    title: string;
    subtitle?: string;
    meta: string;
    imageUrl: string | null;
    variant: 'poster' | 'avatar';
    mediaType?: string;
}

interface RemainderListProps {
    items: RemainderListItem[];
    /** Rank offset — use featured.length so ranks continue after the band */
    startRank?: number;
}

const RemainderList = ({ items, startRank = 0 }: RemainderListProps): React.JSX.Element | null => {
    if (items.length === 0) return null;

    return (
        <div className="tautulli-list-items">
            {items.map((item, idx) => {
                const rank = startRank + idx + 1;
                const isEpisode = item.mediaType === 'episode';
                const PlaceholderIcon = item.variant === 'avatar' ? User : isEpisode ? Tv : Film;

                return (
                    <div
                        key={item.key}
                        className={`tautulli-card ${item.variant === 'avatar' ? 'tautulli-user-card' : ''}`}
                    >
                        {item.variant === 'avatar' ? (
                            <div className="tautulli-user-avatar">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <User size={14} />
                                )}
                                <span className="tautulli-card-rank">{rank}</span>
                            </div>
                        ) : (
                            <div className="tautulli-card-poster">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="tautulli-card-poster-placeholder">
                                        <PlaceholderIcon size={16} />
                                    </div>
                                )}
                                <span className="tautulli-card-rank">{rank}</span>
                            </div>
                        )}

                        <div className="tautulli-card-info">
                            <span className="tautulli-card-title text-theme-primary">{item.title}</span>
                            {item.subtitle && (
                                <span className="tautulli-card-subtitle text-theme-tertiary">{item.subtitle}</span>
                            )}
                        </div>

                        <span className="tautulli-card-plays text-accent">{item.meta}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default RemainderList;
