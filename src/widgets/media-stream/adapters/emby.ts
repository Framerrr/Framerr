/**
 * Emby Session Adapter
 *
 * Normalizes Emby session data into the common MediaSession format.
 * Emby is a fork of Jellyfin (or rather, Jellyfin forked from Emby),
 * so the API is nearly identical.
 */

import type { MediaSession, SessionAdapter } from './types';
import { getEmbyDeepLink } from '../../../shared/utils/mediaDeepLinks';

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
    RemoteEndPoint?: string;
    TranscodingInfo?: {
        IsVideoDirect?: boolean;
        IsAudioDirect?: boolean;
        VideoCodec?: string;
        AudioCodec?: string;
        Bitrate?: number;
    };
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
        const ti = session.TranscodingInfo;

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
            playbackInfo: {
                ipAddress: session.RemoteEndPoint,
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
        return `/api/integrations/${integrationId}/proxy${path}`;
    },

    getDeepLink(session: MediaSession, _machineId?: string, serverUrl?: string): string {
        const itemId = session.ratingKey;
        if (!itemId || !serverUrl) return '';
        return getEmbyDeepLink(itemId, serverUrl);
    },

    getStopEndpoint(integrationId: string): string {
        return `/api/integrations/${integrationId}/proxy/stop`;
    },
};
