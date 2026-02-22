/**
 * Plex Session Adapter
 *
 * Normalizes Plex session data into the common MediaSession format.
 */

import type { MediaSession, SessionAdapter } from './types';
import { getPlexDeepLink } from '../../../shared/utils/mediaDeepLinks';

// ============================================================================
// PLEX RAW TYPES
// ============================================================================

interface PlexRawSession {
    sessionKey: string;
    type?: string;
    title?: string;
    grandparentTitle?: string;
    parentIndex?: number;
    index?: number;
    duration?: number;
    viewOffset?: number;
    art?: string;
    thumb?: string;
    ratingKey?: string;
    Player?: {
        state?: string;
        machineIdentifier?: string;
        device?: string;
        platform?: string;
        product?: string;
        address?: string;
    };
    user?: { title?: string };
    Session?: { id?: string; location?: string; bandwidth?: number };
    TranscodeSession?: {
        key?: string;
        videoDecision?: string;
        audioDecision?: string;
        videoCodec?: string;
        audioCodec?: string;
    };
    Media?: Array<{
        videoCodec?: string;
        audioCodec?: string;
    }>;
}

// ============================================================================
// TYPE MAPPER
// ============================================================================

function mapPlexType(type?: string): MediaSession['type'] {
    switch (type) {
        case 'movie':
            return 'movie';
        case 'episode':
            return 'episode';
        case 'track':
            return 'track';
        default:
            return 'unknown';
    }
}

function mapDecision(decision?: string): 'directplay' | 'copy' | 'transcode' | undefined {
    if (!decision) return undefined;
    if (decision === 'directplay' || decision === 'copy' || decision === 'transcode') return decision;
    return undefined;
}

// ============================================================================
// PLEX ADAPTER
// ============================================================================

export const plexAdapter: SessionAdapter = {
    normalize(raw: unknown, _integrationId: string): MediaSession {
        const session = raw as PlexRawSession;
        const media = session.Media?.[0];
        return {
            sessionKey: session.sessionKey || '',
            integrationType: 'plex',
            type: mapPlexType(session.type),
            title: session.title || 'Unknown',
            grandparentTitle: session.grandparentTitle,
            parentIndex: session.parentIndex,
            index: session.index,
            ratingKey: session.ratingKey,
            duration: session.duration || 0,
            viewOffset: session.viewOffset || 0,
            art: session.art,
            thumb: session.thumb,
            playerState: session.Player?.state === 'paused' ? 'paused' : 'playing',
            userName: session.user?.title || 'Unknown',
            playbackInfo: {
                ipAddress: session.Player?.address,
                location: session.Session?.location === 'lan' ? 'lan' : session.Session?.location ? 'wan' : undefined,
                bandwidth: session.Session?.bandwidth,
                videoDecision: mapDecision(session.TranscodeSession?.videoDecision),
                audioDecision: mapDecision(session.TranscodeSession?.audioDecision),
                videoCodec: session.TranscodeSession?.videoCodec || media?.videoCodec,
                audioCodec: session.TranscodeSession?.audioCodec || media?.audioCodec,
                device: session.Player?.device,
                platform: session.Player?.platform,
                application: session.Player?.product,
            },
            _raw: raw,
        };
    },

    getImageUrl(path: string, integrationId: string): string {
        // Plex images are proxied through our API
        return `/api/integrations/${integrationId}/proxy${path}`;
    },

    getDeepLink(session: MediaSession, machineId?: string): string {
        const ratingKey = session.ratingKey;
        if (!ratingKey || !machineId) return '';
        return getPlexDeepLink(ratingKey, machineId);
    },

    getStopEndpoint(integrationId: string): string {
        return `/api/integrations/${integrationId}/proxy/terminate`;
    },
};
