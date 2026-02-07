/**
 * Plex Poller
 * 
 * Polls active Plex sessions for real-time widget updates.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

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
    Player?: unknown;
    user?: unknown;
}

/**
 * Poll Plex for active sessions.
 */
export async function poll(instance: PluginInstance): Promise<PlexSession[]> {
    if (!instance.config.url || !instance.config.token) {
        return [];
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const token = instance.config.token as string;

    try {
        const response = await axios.get(`${url}/status/sessions`, {
            headers: {
                'X-Plex-Token': token,
                'Accept': 'application/json'
            },
            httpsAgent,
            timeout: 10000
        });

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
                Player: session.Player,
                user: session.User
            })) as PlexSession[];
    } catch {
        return [];
    }
}
