/**
 * Emby Session Adapter
 *
 * Normalizes Emby session data into the common MediaSession format.
 * Emby is a fork of Jellyfin (or rather, Jellyfin forked from Emby),
 * so the API is nearly identical.
 */

import type { MediaSession, SessionAdapter } from './types';

// ============================================================================
// EMBY RAW TYPES (identical to Jellyfin)
// ============================================================================

interface EmbyRawSession {
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

function ticksToMs(ticks?: number): number {
    return ticks ? Math.floor(ticks / 10000) : 0;
}

function mapEmbyType(type?: string): MediaSession['type'] {
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
// EMBY ADAPTER
// ============================================================================

export const embyAdapter: SessionAdapter = {
    normalize(raw: unknown, _integrationId: string): MediaSession {
        const session = raw as EmbyRawSession;
        const item = session.NowPlayingItem;

        return {
            sessionKey: session.Id || '',
            integrationType: 'emby',
            type: mapEmbyType(item?.Type),
            title: item?.Name || 'Unknown',
            grandparentTitle: item?.SeriesName,
            parentIndex: item?.ParentIndexNumber,
            index: item?.IndexNumber,
            ratingKey: item?.Id,
            duration: ticksToMs(item?.RunTimeTicks),
            viewOffset: ticksToMs(session.PlayState?.PositionTicks),
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
        return `/api/integrations/${integrationId}/proxy${path}`;
    },

    getDeepLink(session: MediaSession): string {
        const itemId = session.ratingKey;
        if (!itemId) return '';
        return `#!/details?id=${itemId}`;
    },

    getStopEndpoint(integrationId: string): string {
        return `/api/integrations/${integrationId}/proxy/Sessions`;
    },
};
