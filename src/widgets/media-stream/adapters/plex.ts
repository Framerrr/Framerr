/**
 * Plex Session Adapter
 *
 * Normalizes Plex session data into the common MediaSession format.
 */

import type { MediaSession, SessionAdapter } from './types';

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
    Media?: unknown;
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

// ============================================================================
// PLEX ADAPTER
// ============================================================================

export const plexAdapter: SessionAdapter = {
    normalize(raw: unknown, _integrationId: string): MediaSession {
        const session = raw as PlexRawSession;
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
        // Plex Web URL - works on desktop, mobile apps intercept via Universal Links
        const encodedKey = encodeURIComponent(`/library/metadata/${ratingKey}`);
        return `https://app.plex.tv/desktop#!/server/${machineId}/details?key=${encodedKey}`;
    },

    getStopEndpoint(integrationId: string): string {
        return `/api/integrations/${integrationId}/proxy/terminate`;
    },
};
