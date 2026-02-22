/**
 * SessionCard Component
 *
 * Renders a single media session as a full-image card with gradient overlay.
 * Title, meta, and status are overlaid on the bottom of the image.
 * Handles hover/tap interactions for mobile and desktop.
 * Supports Plex, Jellyfin, and Emby through normalized MediaSession type.
 *
 * Uses useSessionCardData hook for data computation —
 * same data source as StackedCard, only the layout differs.
 */

import React, { useState } from 'react';
import { Film, Network, Info, ExternalLink, StopCircle, Play, Pause } from 'lucide-react';
import { useSessionCardData } from '../hooks/useSessionCardData';
import type { MediaSession } from '../adapters';

interface SessionCardProps {
    session: MediaSession;
    integrationId: string;
    machineId: string | null;
    serverUrl: string | null;
    lastUpdateTime: number;
    userIsAdmin: boolean;
    onShowPlaybackData: (session: MediaSession) => void;
    onShowMediaInfo: (session: MediaSession) => void;
    onConfirmStop?: (session: MediaSession) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
    session,
    integrationId,
    machineId,
    serverUrl,
    lastUpdateTime,
    userIsAdmin,
    onShowPlaybackData,
    onShowMediaInfo,
    onConfirmStop,
}) => {
    const [isActive, setIsActive] = useState(false);

    // Shared data computation
    const {
        displayTitle,
        subtitle,
        imageUrl,
        isPlaying,
        percent,
        playedStr,
        durationStr,
        deepLink,
        externalLinkTitle,
        userName,
    } = useSessionCardData({ session, integrationId, machineId, serverUrl, lastUpdateTime });

    // Toggle controls on tap (mobile), set on hover (desktop)
    const handleImageClick = () => {
        setIsActive(!isActive);
    };

    return (
        <div
            className="plex-card"
            onMouseEnter={() => setIsActive(true)}
            onMouseLeave={() => setIsActive(false)}
            onClick={handleImageClick}
        >
            {/* Full Image */}
            {imageUrl ? (
                <img src={imageUrl} alt={displayTitle} className="plex-card__image" />
            ) : (
                <div className="plex-card__placeholder">
                    <Film size={32} className="text-theme-secondary" style={{ opacity: 0.3 }} />
                </div>
            )}

            {/* Play/Pause Status Badge */}
            <div className="plex-card__badge">
                {isPlaying ? (
                    <Play size={10} style={{ color: 'var(--success)' }} />
                ) : (
                    <Pause size={10} style={{ color: 'var(--warning)' }} />
                )}
                <span>{userName}</span>
            </div>

            {/* Hover/Tap Controls Overlay */}
            <div
                className={`plex-card__controls no-drag ${isActive ? 'plex-card__controls--active' : ''}`}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowPlaybackData(session);
                    }}
                    className="w-9 h-9 rounded-lg bg-theme-hover border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-tertiary transition-colors"
                    title="Playback Data"
                >
                    <Network size={18} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowMediaInfo(session);
                    }}
                    className="w-9 h-9 rounded-lg bg-theme-hover border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-tertiary transition-colors"
                    title="Media Info"
                >
                    <Info size={18} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (deepLink) window.open(deepLink, '_blank');
                    }}
                    className="w-9 h-9 rounded-lg bg-theme-hover border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-tertiary transition-colors"
                    title={externalLinkTitle}
                >
                    <ExternalLink size={18} />
                </button>
                {/* Stop button - Admin only */}
                {userIsAdmin && onConfirmStop && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirmStop(session);
                        }}
                        className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors"
                        style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderColor: 'var(--error)',
                            color: 'var(--error)',
                        }}
                        title="Stop Playback"
                    >
                        <StopCircle size={18} />
                    </button>
                )}
            </div>

            {/* Bottom Gradient Overlay with Info */}
            <div className="plex-card__overlay">
                {/* Progress Bar - above title */}
                <div className="plex-card__progress">
                    <div className="plex-card__progress-fill" style={{ width: `${percent}%` }} />
                    <span className="plex-card__progress-text">{percent}%</span>
                </div>
                <div className="plex-card__title">{displayTitle}</div>
                <div className="plex-card__meta">
                    <span className="plex-card__meta-left">
                        {subtitle && <><span>{subtitle}</span><span>·</span></>}
                        <span>{percent}%</span>
                    </span>
                    <span className="plex-card__timer">{playedStr} / {durationStr}</span>
                </div>
            </div>
        </div>
    );
};

export default SessionCard;
