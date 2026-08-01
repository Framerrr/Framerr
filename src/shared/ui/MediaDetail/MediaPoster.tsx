import React from 'react';
import { Film } from 'lucide-react';
import { MediaStatusBadge } from './MediaStatusBadge';
import './styles.css';

interface MediaPosterProps {
    src?: string | null;
    alt: string;
    /** Lucide (or other) icon node for empty placeholder — defaults to Film */
    placeholderIcon?: React.ReactNode;
    statusLabel?: string;
    statusColor?: string;
    onImgError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const MediaPoster: React.FC<MediaPosterProps> = ({
    src,
    alt,
    placeholderIcon,
    statusLabel,
    statusColor,
    onImgError,
}) => (
    <div className="media-hero__poster">
        {src ? (
            <img
                src={src}
                alt={alt}
                className="media-hero__poster-img"
                onError={onImgError}
            />
        ) : (
            <div className="media-hero__poster-placeholder">
                {placeholderIcon ?? <Film size={48} />}
            </div>
        )}
        {statusLabel && statusColor ? (
            <MediaStatusBadge label={statusLabel} color={statusColor} overlay />
        ) : null}
    </div>
);
