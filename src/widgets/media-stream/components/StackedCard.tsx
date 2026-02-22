/**
 * StackedCard Component
 *
 * Renders a media session as a wide, landscape-oriented card with
 * gradient overlay. Used in stacked (vertical scroll) view mode.
 *
 * Uses useSessionCardData hook for data computation —
 * same data source as SessionCard, only the layout differs.
 */

import React, { useState } from 'react';
import { Film, Play, Pause, Network, Info, ExternalLink, StopCircle } from 'lucide-react';
import { useSessionCardData } from '../hooks/useSessionCardData';
import type { MediaSession } from '../adapters';

// ============================================================================
// TYPES
// ============================================================================

interface StackedCardProps {
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

// ============================================================================
// COMPONENT
// ============================================================================

export const StackedCard: React.FC<StackedCardProps> = ({
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
        timeStr,
        deepLink,
        externalLinkTitle,
        userName,
    } = useSessionCardData({ session, integrationId, machineId, serverUrl, lastUpdateTime });

    return (
        <div
            className="plex-stacked-card"
            onMouseEnter={() => setIsActive(true)}
            onMouseLeave={() => setIsActive(false)}
            onClick={() => setIsActive(!isActive)}
        >
            {/* Image */}
            {imageUrl ? (
                <img src={imageUrl} alt={displayTitle} className="plex-stacked-card__image" />
            ) : (
                <div className="plex-stacked-card__placeholder">
                    <Film size={32} className="text-theme-secondary" style={{ opacity: 0.3 }} />
                </div>
            )}

            {/* Play/Pause status badge */}
            <div className="plex-stacked-card__status">
                {isPlaying ? (
                    <Play size={10} style={{ color: 'var(--success)' }} />
                ) : (
                    <Pause size={10} style={{ color: 'var(--warning)' }} />
                )}
                <span>{userName}</span>
            </div>

            {/* Controls overlay */}
            <div className={`plex-stacked-card__controls no-drag ${isActive ? 'plex-stacked-card__controls--active' : ''}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onShowPlaybackData(session); }}
                    className="w-9 h-9 rounded-lg bg-theme-hover border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-tertiary transition-colors"
                    title="Playback Data"
                >
                    <Network size={18} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onShowMediaInfo(session); }}
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
                {userIsAdmin && onConfirmStop && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onConfirmStop(session); }}
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

            {/* Bottom gradient with title */}
            <div className={`plex-stacked-card__overlay ${isActive ? 'plex-stacked-card__overlay--hidden' : ''}`}>
                <div className="plex-stacked-card__title">{displayTitle}</div>
                <div className="plex-stacked-card__meta">
                    <span className="plex-stacked-card__meta-left">
                        {subtitle && <><span>{subtitle}</span><span>·</span></>}
                        <span>{percent}%</span>
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="plex-stacked-card__progress">
                <div className="plex-stacked-card__progress-fill" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

export default StackedCard;
