/**
 * Jellyfin Session Adapter
 *
 * Normalizes Jellyfin session data into the common MediaSession format.
 * Jellyfin uses "ticks" (100-nanosecond intervals) for time values.
 */

import type { MediaSession, SessionAdapter } from './types';
import { getJellyfinDeepLink } from '../../../shared/utils/mediaDeepLinks';

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
    RemoteEndPoint?: string;
    TranscodingInfo?: {
        IsVideoDirect?: boolean;
        IsAudioDirect?: boolean;
        VideoCodec?: string;
        AudioCodec?: string;
        Bitrate?: number;
        CompletionPercentage?: number;
        Width?: number;
        Height?: number;
    };
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
        const ti = session.TranscodingInfo;

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
            playbackInfo: {
                ipAddress: session.RemoteEndPoint,
                // Jellyfin doesn't provide LAN/WAN — omit location
                bandwidth: ti?.Bitrate ? Math.round(ti.Bitrate / 1000) : undefined,
                videoDecision: ti ? (ti.IsVideoDirect ? 'directplay' : 'transcode') : 'directplay',
                audioDecision: ti ? (ti.IsAudioDirect ? 'directplay' : 'transcode') : 'directplay',
                videoCodec: ti?.VideoCodec,
                audioCodec: ti?.AudioCodec,
                device: session.DeviceName,
                platform: session.Client,
                application: session.Client,
            },
            _raw: raw,
        };
    },

    getImageUrl(path: string, integrationId: string): string {
        // Jellyfin images are proxied through our API
        return `/api/integrations/${integrationId}/proxy${path}`;
    },

    getDeepLink(session: MediaSession, _machineId?: string, serverUrl?: string): string {
        const itemId = session.ratingKey;
        if (!itemId || !serverUrl) return '';
        return getJellyfinDeepLink(itemId, serverUrl);
    },

    getStopEndpoint(integrationId: string): string {
        return `/api/integrations/${integrationId}/proxy/stop`;
    },
};
