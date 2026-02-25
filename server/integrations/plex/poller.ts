/**
 * Plex Poller
 * 
 * Polls active Plex sessions for real-time widget updates.
 */

import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// PLEX POLLER
// ============================================================================

/** Polling interval in milliseconds (30 seconds) */
export const intervalMs = 30000;

/** Plex session shape for SSE */
export interface PlexSession {
    sessionKey?: string;
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
    Player?: unknown;
    Session?: unknown;
    TranscodeSession?: unknown;
    Media?: unknown;
    user?: unknown;
}

/**
 * Poll Plex for active sessions.
 */
export async function poll(instance: PluginInstance, adapter?: PluginAdapter): Promise<PlexSession[]> {
    if (!adapter?.get) {
        throw new Error('Adapter required for Plex polling');
    }

    const response = await adapter.get(instance, '/status/sessions', { timeout: 10000 });

    // Parse sessions
    const sessions = Array.isArray(response.data)
        ? response.data
        : response.data?.MediaContainer?.Metadata || [];

    // Format sessions
    return sessions
        .filter((s: { Player?: { state?: string } }) => s.Player?.state !== 'stopped')
        .map((session: Record<string, unknown>) => ({
            sessionKey: session.sessionKey || session.key,
            type: session.type,
            title: session.title,
            grandparentTitle: session.grandparentTitle,
            parentIndex: session.parentIndex,
            index: session.index,
            duration: parseInt(String(session.duration)) || 0,
            viewOffset: parseInt(String(session.viewOffset)) || 0,
            art: session.art,
            thumb: session.thumb,
            ratingKey: session.ratingKey,
            Player: session.Player,
            Session: session.Session,
            TranscodeSession: session.TranscodeSession,
            Media: session.Media,
            user: session.User
        })) as PlexSession[];
}
