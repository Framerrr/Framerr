import React from 'react';
import './styles.css';

interface MediaStatusBadgeProps {
    label: string;
    color: string;
    /** Poster corner overlay (default for detail heroes) */
    overlay?: boolean;
}

export const MediaStatusBadge: React.FC<MediaStatusBadgeProps> = ({
    label,
    color,
    overlay = false,
}) => (
    <div
        className={`media-status-badge${overlay ? ' media-status-badge--overlay' : ''}`}
        style={{ '--media-status-color': color } as React.CSSProperties}
    >
        <span className="media-status-badge__dot" aria-hidden="true" />
        {label}
    </div>
);
