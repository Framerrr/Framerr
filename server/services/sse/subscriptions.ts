/**
 * SSE Module - Subscription Management
 * 
 * Handles topic subscriptions, subscriber tracking, and cached data.
 * Processes grace period cleanup when connections expire.
 */

import { Operation } from 'fast-json-patch';
import logger from '../../utils/logger';
import type { Subscription } from './types';
import {
    clientConnections,
    GRACE_PERIOD_MS,
    pendingDisconnects,
    type ClientConnection,
    type PendingDisconnect
} from './connections';

// ============================================================================
// TYPES
// ============================================================================

/**
 * SSE Event payload type for real-time updates.
 */
export interface SSEEventPayload {
    type: 'full' | 'delta';
    data?: unknown;
    patches?: Operation[];
    timestamp: number;
}

// ============================================================================
// STATE
// ============================================================================

/**
 * Topic-based subscription registry.
 * Maps topic name to subscription info (subscribers, cached data, polling).
 */
export const subscriptions: Map<string, Subscription> = new Map();

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Send event to a specific connection by ID.
 * Internal helper to avoid circular import with transport.ts.
 */
function sendToConnection(connectionId: string, eventType: string, data: unknown): boolean {
    const connection = clientConnections.get(connectionId);
    if (!connection) return false;

    try {
        connection.res.write(`event: ${eventType}\n`);
        connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
    } catch (error) {
        logger.debug(`[SSE] Send failed: connection=${connectionId}`);
        return false;
    }
}

// ============================================================================
// GRACE PERIOD CLEANUP - Called by connections.ts
// ============================================================================

/**
 * Handle subscription cleanup when grace period expires.
 * Called by connections.ts when the 30s grace period timer fires.
 * 
 * @param pending - The pending disconnect record
 * @param connectionId - The original connection ID
 */
export function handleGracePeriodExpiry(pending: PendingDisconnect, connectionId: string): void {
    for (const topic of pending.subscriptions) {
        const sub = subscriptions.get(topic);
        if (sub) {
            sub.subscribers.delete(connectionId);
            // Check if this was the last subscriber
            if (sub.subscribers.size === 0) {
                if (sub.pollInterval) {
                    clearInterval(sub.pollInterval);
                    sub.pollInterval = null;
                }
                logger.debug(`[SSE] No subscribers: topic=${topic}`);
            }
        }
    }
    logger.debug(`[SSE] Grace expired: user=${pending.userId} subscriptions=${pending.subscriptions.size}`);
}

/**
 * Restore subscriptions for a reconnecting user.
 * Called by connections.ts when a user reconnects within grace period.
 * 
 * @param connection - The new connection
 * @param pending - The pending disconnect record with saved subscriptions
 */
export function restoreSubscriptions(connection: ClientConnection, pending: PendingDisconnect): void {
    for (const topic of pending.subscriptions) {
        connection.subscriptions.add(topic);
        const sub = subscriptions.get(topic);
        if (sub) {
            sub.subscribers.add(connection.id);
        }
    }
    logger.debug(`[SSE] Reconnected: user=${pending.userId} restored=${pending.subscriptions.size}`);
}

// ============================================================================
// EXPORTED FUNCTIONS - Subscription Management
// ============================================================================

/**
 * Callback for when polling should start on a topic.
 * Set by the main SSE module to hook into polling orchestration.
 */
let startPollerCallback: ((topic: string) => void) | null = null;

/**
 * Callback for when polling should stop on a topic.
 * Set by the main SSE module to hook into polling orchestration.
 */
let stopPollerCallback: ((topic: string) => void) | null = null;

/**
 * Callback for when realtime connection should start on a topic.
 * Set by the main SSE module to hook into RealtimeOrchestrator.
 */
let startRealtimeCallback: ((topic: string) => void) | null = null;

/**
 * Callback for when realtime connection should stop on a topic.
 * Set by the main SSE module to hook into RealtimeOrchestrator.
 */
let stopRealtimeCallback: ((topic: string) => void) | null = null;

/**
 * Callback for filtering cached data per-subscriber.
 * Used by the subscribe function to apply per-user filtering when returning cached data.
 * Returns filtered data for the given userId and topic.
 */
let topicFilterCallback: ((userId: string, data: unknown, topic: string) => unknown) | null = null;

/**
 * Check if a topic should use realtime (WebSocket) instead of polling.
 * Media integrations (Plex, Jellyfin, Emby) use realtime with automatic
 * fallback to polling if WebSocket connection fails.
 */
function isRealtimeTopic(topic: string): boolean {
    return topic.startsWith('plex:') ||
        topic.startsWith('jellyfin:') ||
        topic.startsWith('emby:');
}

/**
 * Register callbacks for poller lifecycle.
 * Called during SSE initialization to wire up polling.
 */
export function setPollerCallbacks(
    onStart: (topic: string) => void,
    onStop: (topic: string) => void
): void {
    startPollerCallback = onStart;
    stopPollerCallback = onStop;
}

/**
 * Register callbacks for realtime lifecycle.
 * Called during SSE initialization to wire up WebSocket connections.
 */
export function setRealtimeCallbacks(
    onStart: (topic: string) => void,
    onStop: (topic: string) => void
): void {
    startRealtimeCallback = onStart;
    stopRealtimeCallback = onStop;
}

/**
 * Register callback for topic-level data filtering.
 * Used to apply per-user filtering when sending cached data on subscribe.
 */
export function setTopicFilterCallback(
    filterFn: (userId: string, data: unknown, topic: string) => unknown
): void {
    topicFilterCallback = filterFn;
}

/**
 * Register callback for starting pollers.
 * @deprecated Use setPollerCallbacks() instead
 */
export function setStartPollerCallback(callback: (topic: string) => void): void {
    startPollerCallback = callback;
}

/**
 * Subscribe a connection to a topic.
 * Returns cached data immediately if available.
 * 
 * @param connectionId - The connection ID
 * @param topic - The topic to subscribe to
 * @returns Object indicating if cached data was available
 */
export function subscribe(connectionId: string, topic: string): { cached: boolean; data?: unknown } {
    const connection = clientConnections.get(connectionId);
    if (!connection) {
        logger.warn(`[SSE] Subscribe failed: connection not found topic=${topic}`);
        return { cached: false };
    }

    // Get or create subscription
    let sub = subscriptions.get(topic);
    if (!sub) {
        sub = {
            topic,
            subscribers: new Set(),
            pollInterval: null,
            cachedData: null,
            lastUpdated: 0
        };
        subscriptions.set(topic, sub);
        logger.debug(`[SSE] Created: topic=${topic}`);
    }

    // Check if this is the first subscriber (poller should start)
    const wasEmpty = sub.subscribers.size === 0;

    // Track subscription in both directions
    sub.subscribers.add(connectionId);
    connection.subscriptions.add(topic);

    logger.debug(`[SSE] Subscribed: topic=${topic} subscribers=${sub.subscribers.size}`);

    // Start data source on first subscriber
    if (wasEmpty) {
        if (isRealtimeTopic(topic) && startRealtimeCallback) {
            startRealtimeCallback(topic);
        } else if (startPollerCallback) {
            startPollerCallback(topic);
        }
    }

    // Return cached data if available
    if (sub.cachedData !== null) {
        // Apply per-user topic filter if registered (e.g., Overseerr per-user filtering)
        let dataToSend: unknown = sub.cachedData;
        if (topicFilterCallback) {
            dataToSend = topicFilterCallback(connection.userId, sub.cachedData, topic);
        }

        // Wrap in standard payload format so frontend can parse correctly
        const payload: SSEEventPayload = {
            type: 'full',
            data: dataToSend,
            timestamp: sub.lastUpdated
        };
        sendToConnection(connectionId, topic, payload);
        return { cached: true, data: dataToSend };
    }

    return { cached: false };
}

/**
 * Unsubscribe a connection from a topic.
 * Cleans up subscription if no more subscribers.
 * 
 * @param connectionId - The connection ID
 * @param topic - The topic to unsubscribe from
 */
export function unsubscribe(connectionId: string, topic: string): void {
    const connection = clientConnections.get(connectionId);
    if (connection) {
        connection.subscriptions.delete(topic);
    }

    const sub = subscriptions.get(topic);
    if (!sub) return;

    sub.subscribers.delete(connectionId);

    logger.debug(`[SSE] Unsubscribed: topic=${topic} remaining=${sub.subscribers.size}`);

    // Cleanup subscription if no more subscribers
    if (sub.subscribers.size === 0) {
        // Stop data source via callback (route to appropriate orchestrator)
        if (isRealtimeTopic(topic) && stopRealtimeCallback) {
            stopRealtimeCallback(topic);
        } else if (stopPollerCallback) {
            stopPollerCallback(topic);
        }
        // Also clear legacy pollInterval if exists
        if (sub.pollInterval) {
            clearInterval(sub.pollInterval);
            sub.pollInterval = null;
        }
        logger.debug(`[SSE] No subscribers: topic=${topic}`);
    }
}

/**
 * Get subscriber count for a topic.
 * 
 * @param topic - The topic name
 * @returns Number of subscribers
 */
export function getSubscriberCount(topic: string): number {
    return subscriptions.get(topic)?.subscribers.size ?? 0;
}

/**
 * Check if a topic has any subscribers.
 * 
 * @param topic - The topic name
 * @returns True if topic has at least one subscriber
 */
export function hasSubscribers(topic: string): boolean {
    const sub = subscriptions.get(topic);
    return sub ? sub.subscribers.size > 0 : false;
}

/**
 * Get all active topics (topics with at least one subscriber).
 * 
 * @returns Array of topic names
 */
export function getActiveTopics(): string[] {
    const active: string[] = [];
    for (const [topic, sub] of subscriptions) {
        if (sub.subscribers.size > 0) {
            active.push(topic);
        }
    }
    return active;
}
