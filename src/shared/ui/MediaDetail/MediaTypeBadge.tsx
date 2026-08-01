import React from 'react';
import { Film, Tv } from 'lucide-react';
import './styles.css';

export type MediaTypeBadgeKind = 'movie' | 'tv' | 'show';

interface MediaTypeBadgeProps {
    type: MediaTypeBadgeKind;
}

export const MediaTypeBadge: React.FC<MediaTypeBadgeProps> = ({ type }) => {
    const isTv = type === 'tv' || type === 'show';
    return (
        <div className="media-type-badge">
            {isTv ? <Tv size={12} /> : <Film size={12} />}
            {isTv ? 'TV Show' : 'Movie'}
        </div>
    );
};
