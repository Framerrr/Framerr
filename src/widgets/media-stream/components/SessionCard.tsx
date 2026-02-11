/**
 * SessionCard Component
 *
 * Renders a single media session as a full-image card with gradient overlay.
 * Title, meta, and status are overlaid on the bottom of the image.
 * Handles hover/tap interactions for mobile and desktop.
 * Supports Plex, Jellyfin, and Emby through normalized MediaSession type.
 */

import React, { useState } from 'react';
import { Film, Network, Info, ExternalLink, StopCircle, Play, Pause } from 'lucide-react';
import { getAdapter, type MediaSession } from '../adapters';

interface SessionCardProps {
    session: MediaSession;
    integrationId: string;
    machineId: string | null;
    userIsAdmin: boolean;
    lastUpdateTime: number;
    onShowPlaybackData: (session: MediaSession) => void;
    onShowMediaInfo: (session: MediaSession) => void;
    onConfirmStop: (session: MediaSession) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
    session,
    integrationId,
    machineId,
    userIsAdmin,
    lastUpdateTime,
    onShowPlaybackData,
    onShowMediaInfo,
    onConfirmStop,
}) => {
    const [isActive, setIsActive] = useState(false);

    // Get adapter for this session's integration type
    const adapter = getAdapter(session.integrationType);

    const userName = session.userName;
    const grandparent = session.grandparentTitle || '';
    const title = session.title || 'Unknown';
    const displayTitle = grandparent || title;
    const duration = session.duration || 0;

    // Play state
    const isPlaying = session.playerState === 'playing';

    // Calculate current position with local time interpolation
    const baseOffset = session.viewOffset || 0;
    const elapsed = isPlaying ? Date.now() - lastUpdateTime : 0;
    const viewOffset = Math.min(baseOffset + elapsed, duration);
    const percent = duration > 0 ? Math.round((viewOffset / duration) * 100) : 0;

    // Calculate current position (time played)
    const playedMin = Math.floor(viewOffset / 60000);
    const playedSec = Math.floor((viewOffset % 60000) / 1000);
    const playedStr = `${playedMin}:${playedSec.toString().padStart(2, '0')}`;

    // Format total duration
    const durationMin = Math.floor(duration / 60000);
    const durationSec = Math.floor((duration % 60000) / 1000);
    const durationStr = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    // Episode/subtitle info
    let subtitle = '';
    if (session.type === 'episode' && session.parentIndex && session.index) {
        subtitle = `S${session.parentIndex} · E${session.index}`;
    } else if (session.type === 'movie') {
        subtitle = 'Movie';
    } else if (session.type === 'track') {
        subtitle = 'Music';
    }

    // Use adapter for image URL generation
    const imageUrl = session.art
        ? adapter.getImageUrl(session.art, integrationId)
        : session.thumb
            ? adapter.getImageUrl(session.thumb, integrationId)
            : null;

    // Use adapter for deep link generation
    const getDeepLink = (): string => {
        return adapter.getDeepLink(session, machineId || undefined);
    };

    // Toggle controls on tap (mobile), set on hover (desktop)
    const handleImageClick = () => {
        setIsActive(!isActive);
    };

    // Title for external link button based on integration type
    const externalLinkTitle =
        session.integrationType === 'plex'
            ? 'Open in Plex'
            : session.integrationType === 'jellyfin'
                ? 'Open in Jellyfin'
                : 'Open in Emby';

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
                        const link = getDeepLink();
                        if (link) window.open(link, '_blank');
                    }}
                    className="w-9 h-9 rounded-lg bg-theme-hover border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-tertiary transition-colors"
                    title={externalLinkTitle}
                >
                    <ExternalLink size={18} />
                </button>
                {/* Stop button - Admin only */}
                {userIsAdmin && (
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
