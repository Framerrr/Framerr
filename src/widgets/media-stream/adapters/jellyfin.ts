/**
 * Jellyfin Session Adapter
 *
 * Normalizes Jellyfin session data into the common MediaSession format.
 * Jellyfin uses "ticks" (100-nanosecond intervals) for time values.
 */

import type { MediaSession, SessionAdapter } from './types';

// ============================================================================
// JELLYFIN RAW TYPES
// ============================================================================

interface JellyfinRawSession {
    Id?: string;
    NowPlayingItem?: {
        Id?: string;
        Name?: string;
        SeriesName?: string;
        ParentIndexNumber?: number;
        IndexNumber?: number;
        RunTimeTicks?: number;
        Type?: string;
        ImageTags?: { Primary?: string; Thumb?: string };
        BackdropImageTags?: string[];
    };
    PlayState?: {
        PositionTicks?: number;
        IsPaused?: boolean;
    };
    UserName?: string;
    DeviceName?: string;
    Client?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert Jellyfin ticks (100-nanosecond intervals) to milliseconds.
 */
function ticksToMs(ticks?: number): number {
    return ticks ? Math.floor(ticks / 10000) : 0;
}

function mapJellyfinType(type?: string): MediaSession['type'] {
    switch (type) {
        case 'Movie':
            return 'movie';
        case 'Episode':
            return 'episode';
        case 'Audio':
            return 'track';
        default:
            return 'unknown';
    }
}

// ============================================================================
// JELLYFIN ADAPTER
// ============================================================================

export const jellyfinAdapter: SessionAdapter = {
    normalize(raw: unknown, _integrationId: string): MediaSession {
        const session = raw as JellyfinRawSession;
        const item = session.NowPlayingItem;

        return {
            sessionKey: session.Id || '',
            integrationType: 'jellyfin',
            type: mapJellyfinType(item?.Type),
            title: item?.Name || 'Unknown',
            grandparentTitle: item?.SeriesName,
            parentIndex: item?.ParentIndexNumber,
            index: item?.IndexNumber,
            ratingKey: item?.Id,
            duration: ticksToMs(item?.RunTimeTicks),
            viewOffset: ticksToMs(session.PlayState?.PositionTicks),
            // Jellyfin image paths are relative to Items endpoint
            art: item?.BackdropImageTags?.[0]
                ? `/Items/${item.Id}/Images/Backdrop`
                : undefined,
            thumb: item?.ImageTags?.Primary
                ? `/Items/${item.Id}/Images/Primary`
                : item?.ImageTags?.Thumb
                    ? `/Items/${item.Id}/Images/Thumb`
                    : undefined,
            playerState: session.PlayState?.IsPaused ? 'paused' : 'playing',
            userName: session.UserName || 'Unknown',
            _raw: raw,
        };
    },

    getImageUrl(path: string, integrationId: string): string {
        // Jellyfin images are proxied through our API
        return `/api/integrations/${integrationId}/proxy${path}`;
    },

    getDeepLink(session: MediaSession): string {
        const itemId = session.ratingKey;
        if (!itemId) return '';
        // Jellyfin web URL - server URL would need to be known
        // For now, return a relative path that could be appended to server URL
        return `#!/details?id=${itemId}`;
    },

    getStopEndpoint(integrationId: string): string {
        // Jellyfin uses session-based stop command
        return `/api/integrations/${integrationId}/proxy/Sessions`;
    },
};
