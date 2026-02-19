/**
 * Downloads Widget - Download Card
 *
 * Shared card component for rendering download items.
 * Used for both qBittorrent torrents and SABnzbd downloads.
 *
 * Two variants:
 * - 'active': Shows progress bar, speed, ETA (for active queue items)
 * - 'history': No progress bar, shows completion time + duration (for SABnzbd history)
 */

import React from 'react';
import {
    formatBytes, formatSpeed, formatEta, formatTimeAgo, formatDuration,
    getQbtStateClass, getSabStateClass,
} from './utils';
import type { ClientType } from './utils';

// ============================================================================
// TYPES
// ============================================================================

export interface DownloadCardProps {
    /** Unique ID for this item */
    id: string;
    /** Display name */
    name: string;
    /** Raw status string from the client */
    status: string;
    /** 0.0 - 1.0, only relevant for 'active' variant */
    progress: number;
    /** Total size in bytes */
    size: number;
    /** Download speed in bytes/sec */
    dlspeed: number;
    /** Upload speed in bytes/sec (qBittorrent only) */
    upspeed: number;
    /** ETA in seconds (active only) */
    eta: number;
    /** Ratio (qBittorrent seeding only) */
    ratio: number;
    /** Which client this item is from */
    clientType: ClientType;
    /** 'active' = progress bar + speeds; 'history' = completion info */
    variant: 'active' | 'history';
    /** Unix timestamp when completed (history only) */
    completedAt?: number;
    /** Time to download in seconds (history only) */
    downloadTime?: number;
    /** Category (history only) */
    category?: string;
    /** Whether clicking opens the detail modal */
    onClick?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const DownloadCard: React.FC<DownloadCardProps> = ({
    name,
    status,
    progress,
    size,
    dlspeed,
    upspeed,
    eta,
    ratio,
    clientType,
    variant,
    completedAt,
    downloadTime,
    category,
    onClick,
}) => {
    const isQbt = clientType === 'qbittorrent';
    const stateClass = isQbt ? getQbtStateClass(status) : getSabStateClass(status);
    const isDownloading = stateClass === 'downloading' || stateClass === 'stalled';
    const isSeeding = stateClass === 'seeding' || stateClass === 'completed';
    const isHistory = variant === 'history';

    const pct = progress * 100;

    return (
        <div
            className="qbt-torrent-card"
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            {/* Header: status dot + name + speed */}
            <div className="qbt-torrent-header">
                <div className="qbt-status-badge">
                    <div className={`qbt-status-dot ${stateClass}`} />
                </div>
                <span className="qbt-torrent-name">{name}</span>

                {/* Speed — only for active items */}
                {!isHistory && (
                    <div className="qbt-torrent-speed">
                        {isDownloading && dlspeed > 0 && (
                            <span className="qbt-speed-down">↓ {formatSpeed(dlspeed)}</span>
                        )}
                        {/* Upload speed — qBittorrent only */}
                        {isQbt && (isSeeding || upspeed > 0) && (
                            <span className="qbt-speed-up">↑ {formatSpeed(upspeed)}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Footer: progress bar + meta (active) OR text meta (history) */}
            <div className="qbt-torrent-footer">
                {isHistory ? (
                    /* History variant: text-only meta line */
                    <span className="qbt-torrent-meta">
                        {formatBytes(size)}
                        {completedAt ? <> · {formatTimeAgo(completedAt)}</> : null}
                        {downloadTime && downloadTime > 0
                            ? <> · {formatDuration(downloadTime)}</>
                            : stateClass === 'error' ? <> · Failed</> : null
                        }
                        {category ? <> · {category}</> : null}
                    </span>
                ) : (
                    /* Active variant: progress bar + meta */
                    <>
                        <div className="qbt-progress-bar">
                            <div
                                className={`qbt-progress-fill ${stateClass}`}
                                style={{ width: `${pct.toFixed(1)}%` }}
                            />
                        </div>
                        <span className="qbt-torrent-meta">
                            {pct < 100 ? `${pct.toFixed(1)}%` : '100%'}
                            {' · '}
                            {formatBytes(size)}
                            {isDownloading && eta > 0 && eta < 8640000 && (
                                <> · {formatEta(eta)}</>
                            )}
                            {/* Ratio — qBittorrent seeding only */}
                            {isQbt && isSeeding && ratio > 0 && (
                                <> · ×{ratio.toFixed(2)}</>
                            )}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default DownloadCard;
