/**
 * SSE Module - Connection Management
 * 
 * Handles SSE client connections, grace period for reconnection,
 * and connection tracking.
 */

import { Response } from 'express';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a connected SSE client with unique ID.
 */
export interface ClientConnection {
    id: string;
    res: Response;
    subscriptions: Set<string>;  // topic names
    userId: string;
    pushEndpoint: string | null;  // linked push subscription endpoint
}

/**
 * Pending disconnect tracking for grace period.
 * When a client disconnects, we hold their subscriptions for GRACE_PERIOD_MS.
 * If they reconnect within that time, we restore their subscriptions.
 */
export interface PendingDisconnect {
    timer: NodeJS.Timeout;
    subscriptions: Set<string>;  // topic names
    userId: string;
    connectionId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Grace period in milliseconds.
 * Subscriptions are held for 30s after disconnect to allow quick reconnect.
 */
export const GRACE_PERIOD_MS = 30000;

// ============================================================================
// STATE - Module-level state for connection tracking
// ============================================================================

/** Client connections by ID */
export const clientConnections: Map<string, ClientConnection> = new Map();

/** Reverse lookup: Response -> connectionId */
export const responseToConnectionId: Map<Response, string> = new Map();

/** Pending disconnects during grace period, keyed by userId */
export const pendingDisconnects: Map<string, PendingDisconnect> = new Map();

/** Legacy: Connected clients (for backwards compatibility) */
export const clients: Set<Response> = new Set();

/** Connection ID counter */
let connectionCounter = 0;

// ============================================================================
// SUBSCRIPTION HANDLERS - Set by subscriptions.ts to break circular import
// ============================================================================

let handleGracePeriodExpiryFn: ((pending: PendingDisconnect, connectionId: string) => void) | null = null;
let restoreSubscriptionsFn: ((connection: ClientConnection, pending: PendingDisconnect) => void) | null = null;

/**
 * Register subscription handlers (called by subscriptions.ts or index.ts during init).
 */
export function registerSubscriptionHandlers(
    onGracePeriodExpiry: (pending: PendingDisconnect, connectionId: string) => void,
    onRestoreSubscriptions: (connection: ClientConnection, pending: PendingDisconnect) => void
): void {
    handleGracePeriodExpiryFn = onGracePeriodExpiry;
    restoreSubscriptionsFn = onRestoreSubscriptions;
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
    return `conn_${Date.now()}_${++connectionCounter}`;
}

/**
 * Send event to a specific client (internal helper)
 */
function sendToClient(res: Response, eventType: string, data: unknown): void {
    try {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
        logger.debug('[SSE] Send failed, removing client');
        removeClient(res);
    }
}

// ============================================================================
// EXPORTED FUNCTIONS - Connection Management
// ============================================================================

/**
 * Add SSE client connection (legacy)
 */
export function addClient(res: Response): void {
    clients.add(res);
    logger.debug(`[SSE] Connected: clients=${clients.size}`);

    // Send connected acknowledgment
    sendToClient(res, 'connected', {
        message: 'Connected to Framerr real-time updates'
    });
}

/**
 * Remove SSE client connection (legacy)
 */
export function removeClient(res: Response): void {
    clients.delete(res);
    logger.debug(`[SSE] Disconnected: clients=${clients.size}`);
}

/**
 * Send event to a specific connection by ID.
 */
export function sendToConnection(connectionId: string, eventType: string, data: unknown): boolean {
    const connection = clientConnections.get(connectionId);
    if (!connection) return false;

    try {
        connection.res.write(`event: ${eventType}\n`);
        connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
    } catch (error) {
        logger.debug(`[SSE] Send failed: connection=${connectionId}`);
        removeClientConnection(connection.res);
        return false;
    }
}

/**
 * Add a new client connection with unique ID.
 * Called when SSE connection is established.
 * 
 * @param res - Express Response object
 * @param userId - User ID for this connection
 * @returns The generated connection ID
 */
export function addClientConnection(res: Response, userId: string): string {
    const connectionId = generateConnectionId();

    const connection: ClientConnection = {
        id: connectionId,
        res,
        subscriptions: new Set(),
        userId,
        pushEndpoint: null
    };

    clientConnections.set(connectionId, connection);
    responseToConnectionId.set(res, connectionId);

    // Check for pending disconnect for this user (grace period restoration)
    const pending = pendingDisconnects.get(userId);
    if (pending && restoreSubscriptionsFn) {
        clearTimeout(pending.timer);
        pendingDisconnects.delete(userId);

        // Restore subscriptions via the callback
        restoreSubscriptionsFn(connection, pending);
    } else {
        logger.debug(`[SSE] Connected: user=${userId} clients=${clientConnections.size}`);
    }

    // Send connection acknowledgment with connectionId
    sendToConnection(connectionId, 'connected', {
        connectionId,
        message: 'Connected to Framerr real-time updates'
    });

    return connectionId;
}

/**
 * Remove client connection and start grace period.
 * Called when SSE connection closes.
 * 
 * @param res - Express Response object
 */
export function removeClientConnection(res: Response): void {
    const connectionId = responseToConnectionId.get(res);
    if (!connectionId) return;

    const connection = clientConnections.get(connectionId);
    if (connection) {
        const userId = connection.userId;
        const subscriptionsCopy = new Set(connection.subscriptions);

        // Instead of immediate cleanup, start grace period
        // This allows the client to reconnect within 30s and restore subscriptions
        if (subscriptionsCopy.size > 0 && handleGracePeriodExpiryFn) {
            // Clear any existing pending disconnect for this user
            const existingPending = pendingDisconnects.get(userId);
            if (existingPending) {
                clearTimeout(existingPending.timer);
            }

            // Capture callback reference for closure
            const gracePeriodHandler = handleGracePeriodExpiryFn;

            const timer = setTimeout(() => {
                // Grace period expired - call subscriptions module to clean up
                const pending = pendingDisconnects.get(userId);
                if (pending && pending.connectionId === connectionId) {
                    gracePeriodHandler(pending, connectionId);
                    pendingDisconnects.delete(userId);
                }
            }, GRACE_PERIOD_MS);

            pendingDisconnects.set(userId, {
                timer,
                subscriptions: subscriptionsCopy,
                userId,
                connectionId
            });

            logger.debug(`[SSE] Disconnected: user=${userId} grace=${GRACE_PERIOD_MS}ms`);
        } else {
            logger.debug(`[SSE] Disconnected: clients=${clientConnections.size - 1}`);
        }

        clientConnections.delete(connectionId);
        responseToConnectionId.delete(res);
    }
}

/**
 * Check if a user has at least one active SSE connection.
 * Used by notificationEmitter to determine SSE vs Web Push routing.
 */
export function hasUserConnection(userId: string): boolean {
    for (const connection of clientConnections.values()) {
        if (connection.userId === userId) {
            return true;
        }
    }
    return false;
}

/**
 * Get total number of connected clients.
 */
export function getClientCount(): number {
    return clientConnections.size;
}

/**
 * Link a push subscription endpoint to an SSE connection.
 * Called when a client reports its push endpoint after connecting.
 */
export function setPushEndpoint(connectionId: string, endpoint: string): boolean {
    const connection = clientConnections.get(connectionId);
    if (!connection) return false;

    connection.pushEndpoint = endpoint;
    logger.debug(`[SSE] Push endpoint linked: connection=${connectionId} endpoint=${endpoint.slice(-30)}`);
    return true;
}

/**
 * Get all push endpoints with active SSE connections for a user.
 * Used by notificationEmitter to skip push to devices that have the app open.
 */
export function getActiveEndpointsForUser(userId: string): Set<string> {
    const endpoints = new Set<string>();
    for (const connection of clientConnections.values()) {
        if (connection.userId === userId && connection.pushEndpoint) {
            endpoints.add(connection.pushEndpoint);
        }
    }
    return endpoints;
}
