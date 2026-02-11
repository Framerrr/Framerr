/**
 * SSE Module - Transport Layer
 * 
 * Handles broadcasting SSE events to clients.
 * Includes topic-based delta updates and user-targeted messaging.
 */

import { compare, Operation } from 'fast-json-patch';
import logger from '../../utils/logger';
import type { Subscription, QueueItem, PlexSession } from './types';
import type { SSEEventPayload } from './subscriptions';
import {
    clientConnections,
    clients,
    removeClient,
    removeClientConnection,
} from './connections';
import { subscriptions } from './subscriptions';

// ============================================================================
// LEGACY CACHED STATE (for backwards compatibility)
// ============================================================================

/** Cached Plex sessions for new client sync */
let cachedPlexSessions: PlexSession[] = [];

/** Cached Sonarr queue for new client sync */
let cachedSonarrQueue: QueueItem[] = [];

/** Cached Radarr queue for new client sync */
let cachedRadarrQueue: QueueItem[] = [];

// ============================================================================
// EXPORTED FUNCTIONS - Broadcasting
// ============================================================================

/**
 * Broadcast event to all subscribers of a topic.
 * Uses JSON Patch (RFC 6902) for delta updates.
 * 
 * For realtime topics (Plex WS, etc.), always sends full payloads to avoid
 * race conditions where concurrent fetchSessions calls skip broadcasts
 * due to the shared cache dedup.
 * 
 * @param topic - The topic name
 * @param data - The data to broadcast
 * @param options - Optional broadcast options
 * @param options.forceFullPayload - Always send full payload (skip delta dedup)
 */
export function broadcastToTopic(
    topic: string,
    data: unknown,
    options?: { forceFullPayload?: boolean }
): void {
    const sub = subscriptions.get(topic);
    if (!sub) {
        return;
    }

    const timestamp = Date.now();
    let payload: SSEEventPayload;

    if (options?.forceFullPayload) {
        // Realtime topics: always send full payload to avoid dedup races
        payload = {
            type: 'full',
            data,
            timestamp
        };
    } else {
        // Compare with cached data to generate patches
        const previousData = sub.cachedData;

        if (previousData === null) {
            // First update - send full payload
            payload = {
                type: 'full',
                data,
                timestamp
            };
        } else {
            // Generate patches
            const patches = compare(
                previousData as object,
                data as object
            );

            if (patches.length === 0) {
                // No changes - skip broadcast
                return;
            }

            // Heuristic: Send full payload if patches are too complex
            // This prevents OPERATION_PATH_UNRESOLVABLE errors when client cache differs
            const shouldSendFull = patches.length > 10 || patches.some(p =>
                (p.op === 'add' || p.op === 'replace') &&
                (p.path.split('/').length > 3) // Deep path like /sessions/0/Session
            );

            if (shouldSendFull) {
                payload = {
                    type: 'full',
                    data,
                    timestamp
                };
            } else {
                payload = {
                    type: 'delta',
                    patches,
                    timestamp
                };
            }
        }
    }

    // Update cache
    sub.cachedData = data;
    sub.lastUpdated = timestamp;

    // Broadcast to all subscribers
    const eventStr = `event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`;
    let sent = 0;

    for (const connectionId of sub.subscribers) {
        const connection = clientConnections.get(connectionId);
        if (connection) {
            try {
                connection.res.write(eventStr);
                sent++;
            } catch (error) {
                removeClientConnection(connection.res);
            }
        }
    }

    logger.debug(`[SSE] Broadcast: topic=${topic} type=${payload.type} subscribers=${sent}/${sub.subscribers.size}`);
}

/**
 * Broadcast an event to all connections for a specific user.
 * Used for user-targeted notifications via the unified SSE.
 * 
 * @param userId - The user ID to target
 * @param eventType - The SSE event type (e.g., 'notification')
 * @param data - The data payload to send
 */
export function broadcastToUser(userId: string, eventType: string, data: unknown): void {
    const eventStr = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    let sent = 0;

    for (const connection of clientConnections.values()) {
        if (connection.userId === userId) {
            try {
                connection.res.write(eventStr);
                sent++;
            } catch {
                removeClientConnection(connection.res);
            }
        }
    }

    if (sent > 0) {
        logger.debug(`[SSE] Sent to user: user=${userId} event=${eventType} connections=${sent}`);
    }
}

/**
 * Broadcast an event to ALL connected clients.
 * Used for system-wide settings (e.g., server name, icon) that affect all users.
 * 
 * @param eventType - The SSE event type (e.g., 'settings:invalidate')
 * @param data - The data payload to send
 */
export function broadcastToAllUsers(eventType: string, data: unknown): void {
    const eventStr = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    let sent = 0;

    for (const connection of clientConnections.values()) {
        try {
            connection.res.write(eventStr);
            sent++;
        } catch {
            removeClientConnection(connection.res);
        }
    }

    if (sent > 0) {
        logger.debug(`[SSE] Broadcast: event=${eventType} connections=${sent}`);
    }
}

/**
 * Legacy broadcast to all connected clients (legacy Set-based).
 * Used by servicePoller, backupScheduler, backup for backwards compatibility.
 * 
 * @param eventType - The SSE event type
 * @param data - The data payload to send
 */
export function broadcast(eventType: string, data: unknown): void {
    // Cache the data for new client sync
    if (eventType === 'plex:sessions') {
        cachedPlexSessions = data as PlexSession[];
    } else if (eventType === 'sonarr:queue') {
        cachedSonarrQueue = data as QueueItem[];
    } else if (eventType === 'radarr:queue') {
        cachedRadarrQueue = data as QueueItem[];
    }

    // Broadcast to all clients (legacy Set)
    const eventStr = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

    clients.forEach((client) => {
        try {
            client.write(eventStr);
        } catch (error) {
            removeClient(client);
        }
    });
    // Note: Per-broadcast debug log removed - too noisy (fires every 5s per queue)
}

// ============================================================================
// CACHE ACCESS (for new client sync in legacy mode)
// ============================================================================

/**
 * Get cached Plex sessions.
 */
export function getCachedPlexSessions(): PlexSession[] {
    return cachedPlexSessions;
}

/**
 * Get cached Sonarr queue.
 */
export function getCachedSonarrQueue(): QueueItem[] {
    return cachedSonarrQueue;
}

/**
 * Get cached Radarr queue.
 */
export function getCachedRadarrQueue(): QueueItem[] {
    return cachedRadarrQueue;
}
