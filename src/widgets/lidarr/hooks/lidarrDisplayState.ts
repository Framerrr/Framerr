/**
 * lidarrDisplayState - pure display-logic helpers for the Lidarr widget.
 *
 * Lidarr albums have a single releaseDate field (unlike Radarr's three release-date
 * types), so this module is intentionally simpler than radarrDisplayState.ts.
 */

import { formatDisplayDate } from '../../_shared/media/format';
import type { LidarrImage } from '../lidarr.types';

export interface ReleasePillDisplayProps {
    type: 'music';
    date: string;
    dimmed: boolean;
}

/** ReleasePill props for an album's single releaseDate field. */
export function getReleasePillProps(album: { releaseDate?: string }): ReleasePillDisplayProps {
    const dateStr = album.releaseDate;
    return { type: 'music', date: dateStr ? formatDisplayDate(dateStr) : 'TBA', dimmed: !dateStr };
}

/**
 * Prefer album cover art, then artist poster/cover, then any remaining image.
 * Returns a proxied Framerr URL, or null when nothing usable is present.
 */
export function getAlbumCoverProxyUrl(
    album: { images?: LidarrImage[]; artist?: { images?: LidarrImage[] } },
    integrationId: string,
): string | null {
    const images = album.images?.length ? album.images : album.artist?.images;
    if (!images?.length) return null;

    const pick =
        images.find((img) => img.coverType === 'cover')
        || images.find((img) => img.coverType === 'poster')
        || images[0];
    const imageUrl = pick?.remoteUrl || pick?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

export interface AlbumProgress {
    /** 0-1, capped. */
    fraction: number;
    trackFileCount: number;
    trackCount: number;
}

/**
 * Null when statistics are absent/zero/malformed — callers must render nothing.
 * Subfields are validated as finite numbers rather than trusted at their declared
 * TypeScript type.
 */
export function getAlbumProgress(
    statistics: { trackCount?: number; trackFileCount?: number } | undefined
): AlbumProgress | null {
    const trackCount = statistics?.trackCount;
    const trackFileCount = statistics?.trackFileCount;
    if (!Number.isFinite(trackCount) || (trackCount as number) <= 0) return null;
    if (!Number.isFinite(trackFileCount)) return null;
    return {
        fraction: Math.max(0, Math.min(1, (trackFileCount as number) / (trackCount as number))),
        trackFileCount: trackFileCount as number,
        trackCount: trackCount as number,
    };
}
