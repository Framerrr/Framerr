import React from 'react';
import { Users } from 'lucide-react';
import { MediaSectionHeading } from './MediaSectionHeading';
import './styles.css';

export interface MediaCastMember {
    name: string;
    role?: string;
}

interface MediaCastProps {
    /** Objects with optional role, or plain name strings */
    members: Array<MediaCastMember | string>;
    max?: number;
}

export const MediaCast: React.FC<MediaCastProps> = ({ members, max = 12 }) => {
    if (!members.length) return null;

    const normalized: MediaCastMember[] = members.map((m) =>
        typeof m === 'string' ? { name: m } : m
    );
    const shown = normalized.slice(0, max);
    const remaining = normalized.length - shown.length;

    return (
        <div>
            <MediaSectionHeading icon={<Users size={14} />}>Cast</MediaSectionHeading>
            <div className="media-cast-grid">
                {shown.map((actor, idx) => (
                    <div key={`${actor.name}-${idx}`} className="media-cast-card">
                        <div className="media-cast-card__name">{actor.name}</div>
                        {actor.role ? (
                            <div className="media-cast-card__role">{actor.role}</div>
                        ) : null}
                    </div>
                ))}
            </div>
            {remaining > 0 && (
                <p className="media-cast-more">+{remaining} more cast members</p>
            )}
        </div>
    );
};
