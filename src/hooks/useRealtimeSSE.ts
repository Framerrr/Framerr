/**
 * useRealtimeSSE Hook
 * 
 * Connects to Framerr's unified SSE endpoint for real-time updates.
 * Uses a singleton pattern to share one connection across all components.
 * 
 * P1 Phase 4: Topic-based subscriptions with JSON Patch deltas.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { applyPatch, Operation } from 'fast-json-patch';
import logger from '../utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Plex session shape (for widgets that need it)
export interface PlexSession {
    sessionKey: string;
    type: string;
    title: string;
    grandparentTitle?: string;
    parentIndex?: number;
    index?: number;
    duration: number;
    viewOffset: number;
    art?: string;
    thumb?: string;
    Player?: {
        address?: string;
        device?: string;
        platform?: string;
        product?: string;
        state?: string;
        title?: string;
    };
    user?: {
        title?: string;
    };
}

// Queue item shape (for Sonarr/Radarr widgets)
export interface QueueItem {
    id: number;
    progress: number;
    timeleft?: string;
    status: string;
    movieId?: number;
    movie?: {
        title?: string;
        tmdbId?: number;
    };
    seriesId?: number;
    series?: {
        title?: string;
        tvdbId?: number;
        tmdbId?: number;
    };
    episode?: {
        seasonNumber?: number;
        episodeNumber?: number;
        title?: string;
    };
    size?: number;
    sizeleft?: number;
}

// Service status event shape
export interface ServiceStatusEvent {
    event: 'status-change' | 'maintenance-toggle';
    monitorId: string;
    oldStatus?: string;
    newStatus?: string;
    maintenance?: boolean;
    errorMessage?: string | null;
    responseTimeMs?: number | null;
    timestamp: number;
}

// Backup event shapes
export interface BackupStartedEvent {
    id: string;
    type: 'manual' | 'scheduled' | 'safety';
}

export interface BackupProgressEvent {
    id: string;
    step: string;
    percent: number;
}

export interface BackupCompleteEvent {
    id: string;
    filename: string;
    size: number;
}

export interface BackupErrorEvent {
    id: string;
    error: string;
}

export interface BackupScheduledFailedEvent {
    error: string;
    timestamp: string;
}

export type BackupEvent =
    | { type: 'started'; data: BackupStartedEvent }
    | { type: 'progress'; data: BackupProgressEvent }
    | { type: 'complete'; data: BackupCompleteEvent }
    | { type: 'error'; data: BackupErrorEvent }
    | { type: 'scheduled-failed'; data: BackupScheduledFailedEvent };

// SSE payload from server
interface SSEPayload {
    type: 'full' | 'delta';
    data?: unknown;
    patches?: Operation[];
    timestamp: number;
}

// ============================================================================
// SINGLETON STATE
// ============================================================================

interface RealtimeState {
    isConnected: boolean;
    connectionId: string | null;
    disconnectedAt: number | null;  // Phase 5: timestamp when disconnect started
}

/**
 * Phase 5: Connection status tiers for UI feedback.
 * - connected: SSE is open and working
 * - reconnecting-silent: <5s disconnect, no UI needed
 * - reconnecting-warning: 5-30s disconnect, show subtle indicator
 * - disconnected: >30s disconnect, show persistent toast
 */
export type ConnectionStatus = 'connected' | 'reconnecting-silent' | 'reconnecting-warning' | 'disconnected';

/**
 * P9: Connection lifecycle states for auth-aware SSE.
 * - idle: Not initialized (no user logged in)
 * - connecting: First connection attempt in progress
 * - connected: SSE stream is open and healthy
 * - reconnecting: Lost connection, attempting to restore
 * - failed: Max reconnection attempts exhausted
 */
export type SSEConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

// Module-level singleton
let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let connectionAttempts = 0;
let reconnectionStartedAt: number | null = null; // Track when reconnection sequence began
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10; // P9: After this many attempts, transition to 'failed' state
const MAX_RECONNECT_DURATION_MS = 120000; // 2 minutes max - failover in case connection timeouts are slow

// P9: Auth guard - SSE will not connect until explicitly initialized
let isSSEEnabled = false;

// State listeners for useSyncExternalStore
const stateListeners = new Set<() => void>();

// Topic-specific callbacks: topic -> Set of callbacks
const topicCallbacks = new Map<string, Set<(data: unknown) => void>>();

// Cached data per topic (for JSON Patch application)
const topicDataCache = new Map<string, unknown>();

// Active topic subscriptions (for cleanup)
const activeTopicListeners = new Map<string, (event: MessageEvent) => void>();

// Callback sets for special events
const serviceStatusCallbacks = new Set<(event: ServiceStatusEvent) => void>();
const backupCallbacks = new Set<(event: BackupEvent) => void>();

// Phase 7: Notification callbacks for unified SSE delivery
interface NotificationEvent {
    id?: string;
    type?: string;
    title?: string;
    message?: string;
    iconId?: string | null;
    iconIds?: string[];
    metadata?: Record<string, unknown>;
    action?: string;  // For sync events: 'markRead', 'delete', 'markAllRead', 'clearAll'
    notificationId?: string;  // For sync events: which notification was affected
}
const notificationCallbacks = new Set<(event: NotificationEvent) => void>();

// Global settings invalidation for real-time sync
export interface SettingsInvalidateEvent {
    entity: string;  // e.g., 'permissions', 'groups', 'tabs', 'templates'
}
const settingsInvalidateCallbacks = new Set<(event: SettingsInvalidateEvent) => void>();

// Settings SSE: Theme callbacks for real-time theme sync across tabs/devices
export interface ThemeEvent {
    action: 'updated' | 'reset';
    theme: {
        mode?: 'light' | 'dark' | 'system';
        primaryColor?: string;
        preset?: string;
        customColors?: Record<string, string>;
    };
}
const themeCallbacks = new Set<(event: ThemeEvent) => void>();

// Library sync progress for smooth progress bar updates
export interface LibrarySyncProgressEvent {
    integrationId: string;
    indexed: number;
    total: number;
    percent: number;
    phase?: 'fetching' | 'indexing';
    statusMessage?: string;
}
const librarySyncProgressCallbacks = new Set<(event: LibrarySyncProgressEvent) => void>();

let state: RealtimeState = {
    isConnected: false,
    connectionId: null,
    disconnectedAt: null
};

// P9: Connection state for toast system
let connectionState: SSEConnectionState = 'idle';
const connectionStateCallbacks = new Set<(newState: SSEConnectionState, oldState: SSEConnectionState) => void>();

function setConnectionState(newState: SSEConnectionState) {
    const oldState = connectionState;
    if (oldState !== newState) {
        connectionState = newState;
        logger.debug(`[SSE] Connection state: ${oldState} -> ${newState}`);
        connectionStateCallbacks.forEach(cb => {
            try {
                cb(newState, oldState);
            } catch (err) {
                logger.warn('[SSE] Connection state callback error', { error: err });
            }
        });
    }
}

/**
 * P9: Get current connection state.
 */
export function getSSEConnectionState(): SSEConnectionState {
    return connectionState;
}

/**
 * P9: Subscribe to connection state changes.
 * Returns unsubscribe function.
 */
export function onSSEConnectionStateChange(
    callback: (newState: SSEConnectionState, oldState: SSEConnectionState) => void
): () => void {
    connectionStateCallbacks.add(callback);
    return () => {
        connectionStateCallbacks.delete(callback);
    };
}

function notifyStateListeners() {
    stateListeners.forEach(listener => listener());
}

function setState(updates: Partial<RealtimeState>) {
    state = { ...state, ...updates };
    notifyStateListeners();
}

/**
 * Phase 5: Get tiered connection status for UI feedback.
 * Used by ConnectionStatusIndicator to determine what to show.
 */
export function getConnectionStatus(): ConnectionStatus {
    if (state.isConnected) return 'connected';

    const now = Date.now();
    const disconnectDuration = state.disconnectedAt ? now - state.disconnectedAt : 0;

    if (disconnectDuration < 5000) return 'reconnecting-silent';
    if (disconnectDuration < 30000) return 'reconnecting-warning';
    return 'disconnected';
}

/**
 * Phase 5: Get disconnect timestamp for components that need timing info.
 */
export function getDisconnectedAt(): number | null {
    return state.disconnectedAt;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

function setupVisibilityHandlers() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !state.isConnected && isSSEEnabled) {
            logger.debug('[SSE] Tab visible, reconnecting');
            // Only reset attempts if NOT already in a reconnection sequence
            // This prevents focus/visibility from indefinitely blocking 'failed' state
            if (connectionState !== 'reconnecting') {
                connectionAttempts = 0;
            }
            connect();
        }
    });

    window.addEventListener('focus', () => {
        if (!state.isConnected && isSSEEnabled) {
            logger.debug('[SSE] Window focused, reconnecting');
            // Only reset attempts if NOT already in a reconnection sequence
            if (connectionState !== 'reconnecting') {
                connectionAttempts = 0;
            }
            connect();
        }
    });
}

// Setup handlers immediately
setupVisibilityHandlers();

/**
 * Link this browser's push subscription endpoint to its SSE connection.
 * Called after SSE connects, so server knows which push subscription
 * belongs to which SSE connection (for cross-device push suppression).
 */
async function linkPushEndpoint(connectionId: string): Promise<void> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription?.endpoint) return;

        await fetch('/api/realtime/push-endpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Framerr-Client': '1'
            },
            credentials: 'include',
            body: JSON.stringify({
                connectionId,
                pushEndpoint: subscription.endpoint
            })
        });

        logger.debug('[SSE] Push endpoint linked to SSE connection');
    } catch (err) {
        // Non-critical: push suppression just won't work for this device
        logger.debug('[SSE] Failed to link push endpoint', { error: err });
    }
}

function connect() {
    // P9: Auth guard - don't connect if SSE is not enabled
    if (!isSSEEnabled) {
        logger.debug('[SSE] Connection skipped: not initialized');
        return;
    }

    if (eventSource?.readyState === EventSource.OPEN || eventSource?.readyState === EventSource.CONNECTING) {
        return;
    }

    try {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        // P9: Track connecting state
        if (connectionState !== 'reconnecting') {
            setConnectionState('connecting');
        }

        const sseUrl = '/api/realtime/stream';
        eventSource = new EventSource(sseUrl, { withCredentials: true });

        eventSource.onopen = () => {
            connectionAttempts = 0;
            reconnectionStartedAt = null; // Reset reconnection timer
            setState({ isConnected: true, disconnectedAt: null });
            setConnectionState('connected');
            logger.debug('[SSE] Connected');
        };

        // Capture connectionId from server
        eventSource.addEventListener('connected', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.connectionId) {
                    setState({ connectionId: data.connectionId });
                    logger.info('[SSE] Connected', { connectionId: data.connectionId });

                    // Link push subscription endpoint to this SSE connection
                    // so the server can skip sending push to devices with active SSE
                    linkPushEndpoint(data.connectionId);
                }
            } catch (err) {
                logger.warn('[SSE] Parse error connected event', { error: err });
            }
        });

        // Service status events
        eventSource.addEventListener('service-status', (event: MessageEvent) => {
            try {
                const statusEvent = JSON.parse(event.data) as ServiceStatusEvent;
                serviceStatusCallbacks.forEach(callback => {
                    try {
                        callback(statusEvent);
                    } catch (err) {
                        logger.warn('[SSE] Callback error service-status', { error: err });
                    }
                });
            } catch (err) {
                logger.warn('[SSE] Parse error service-status', { error: err });
            }
        });

        // Backup events
        const backupEventTypes = ['backup:started', 'backup:progress', 'backup:complete', 'backup:error', 'backup:scheduled-failed'];
        backupEventTypes.forEach(eventType => {
            eventSource!.addEventListener(eventType, (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    const type = eventType.replace('backup:', '') as BackupEvent['type'];
                    backupCallbacks.forEach(callback => {
                        try {
                            callback({ type, data } as BackupEvent);
                        } catch (err) {
                            logger.warn(`[SSE] Callback error ${eventType}`, { error: err });
                        }
                    });
                } catch (err) {
                    logger.warn(`[SSE] Parse error ${eventType}`, { error: err });
                }
            });
        });

        // Phase 7: Notification events from unified SSE
        eventSource.addEventListener('notification', (event: MessageEvent) => {
            try {
                const notificationEvent = JSON.parse(event.data) as NotificationEvent;
                logger.debug('[SSE] Notification event received', {
                    id: notificationEvent.id,
                    type: notificationEvent.type,
                    title: notificationEvent.title
                });
                notificationCallbacks.forEach(callback => {
                    try {
                        callback(notificationEvent);
                    } catch (err) {
                        logger.warn('[SSE] Callback error notification', { error: err });
                    }
                });
            } catch (err) {
                logger.warn('[SSE] Parse error notification', { error: err });
            }
        });

        // Global settings invalidation for real-time sync across tabs/devices
        eventSource.addEventListener('settings:invalidate', (event: MessageEvent) => {
            try {
                const invalidateEvent = JSON.parse(event.data) as SettingsInvalidateEvent;
                logger.debug('[SSE] Settings invalidate event received', {
                    entity: invalidateEvent.entity
                });
                settingsInvalidateCallbacks.forEach(callback => {
                    try {
                        callback(invalidateEvent);
                    } catch (err) {
                        logger.warn('[SSE] Callback error settings:invalidate', { error: err });
                    }
                });
            } catch (err) {
                logger.warn('[SSE] Parse error settings:invalidate', { error: err });
            }
        });

        // Settings SSE: Theme events for real-time theme sync
        eventSource.addEventListener('settings:theme', (event: MessageEvent) => {
            try {
                const themeEvent = JSON.parse(event.data) as ThemeEvent;
                logger.debug('[SSE] Theme event received', {
                    action: themeEvent.action,
                    preset: themeEvent.theme?.preset
                });
                themeCallbacks.forEach(callback => {
                    try {
                        callback(themeEvent);
                    } catch (err) {
                        logger.warn('[SSE] Callback error theme', { error: err });
                    }
                });
            } catch (err) {
                logger.warn('[SSE] Parse error theme', { error: err });
            }
        });

        // Library sync progress for smooth progress bar updates
        eventSource.addEventListener('library_sync_progress', (event: MessageEvent) => {
            try {
                const progressEvent = JSON.parse(event.data) as LibrarySyncProgressEvent;
                librarySyncProgressCallbacks.forEach(callback => {
                    try {
                        callback(progressEvent);
                    } catch (err) {
                        logger.warn('[SSE] Callback error library_sync_progress', { error: err });
                    }
                });
            } catch (err) {
                logger.warn('[SSE] Parse error library_sync_progress', { error: err });
            }
        });

        eventSource.onerror = () => {
            // Track disconnect time for tiered UI response (Phase 5)
            const disconnectedAt = state.disconnectedAt || Date.now();
            setState({ isConnected: false, connectionId: null, disconnectedAt });

            // P9: Transition to reconnecting if was connected or connecting
            if (connectionState === 'connected' || connectionState === 'connecting') {
                setConnectionState('reconnecting');
            }

            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }

            // Clear topic listeners on disconnect
            activeTopicListeners.clear();

            scheduleReconnect();
        };

    } catch (err) {
        logger.error('[SSE] Connection failed', { error: err });
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    // P9: Don't schedule if SSE is disabled
    if (!isSSEEnabled) {
        return;
    }

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }

    connectionAttempts++;

    // Track when reconnection sequence started
    if (!reconnectionStartedAt) {
        reconnectionStartedAt = Date.now();
    }

    // P9: Check if max attempts OR max duration exceeded
    const reconnectDuration = Date.now() - reconnectionStartedAt;
    if (connectionAttempts > MAX_RECONNECT_ATTEMPTS || reconnectDuration > MAX_RECONNECT_DURATION_MS) {
        const reason = connectionAttempts > MAX_RECONNECT_ATTEMPTS
            ? `max attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`
            : `max duration (${MAX_RECONNECT_DURATION_MS / 1000}s) exceeded`;
        logger.warn(`[SSE] Reconnection failed: ${reason}`);
        reconnectionStartedAt = null; // Reset for next time
        setConnectionState('failed');
        return;
    }

    const delay = Math.min(1000 * Math.pow(2, connectionAttempts - 1), MAX_RECONNECT_DELAY);

    logger.debug(`[SSE] Reconnecting in ${delay / 1000}s (attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeout = setTimeout(() => {
        connect();
    }, delay);
}

// ============================================================================
// TOPIC SUBSCRIPTION API
// ============================================================================

/**
 * Subscribe to a topic for real-time updates.
 * Returns an unsubscribe function.
 */
async function subscribeToTopicInternal(
    topic: string,
    callback: (data: unknown) => void
): Promise<() => void> {
    // Wait for connection if not connected
    if (!state.connectionId) {
        logger.warn('[SSE] subscribeToTopic called without connectionId, waiting...');
        // Simple retry - in production might want more sophisticated waiting
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!state.connectionId) {
            logger.error('[SSE] No connectionId after wait, subscription failed');
            return () => { };
        }
    }

    // Add callback to set
    if (!topicCallbacks.has(topic)) {
        topicCallbacks.set(topic, new Set());
    }
    topicCallbacks.get(topic)!.add(callback);

    // Setup event listener for this topic if not already done
    if (!activeTopicListeners.has(topic) && eventSource) {
        const listener = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data) as SSEPayload;
                let newData: unknown;

                if (payload.type === 'full') {
                    // Full payload - replace cached data
                    newData = payload.data;
                    topicDataCache.set(topic, newData);
                } else if (payload.type === 'delta' && payload.patches) {
                    // Delta - apply patches to cached data
                    const currentData = topicDataCache.get(topic) || {};
                    try {
                        // Use structuredClone (native, faster than JSON.parse(JSON.stringify()))
                        // Clone is needed so patch failure doesn't corrupt the cached data
                        const clonedData = structuredClone(currentData);
                        const result = applyPatch(
                            clonedData,
                            payload.patches,
                            true, // validate
                            true  // mutate the clone directly (avoid internal clone)
                        );
                        newData = result.newDocument;
                        topicDataCache.set(topic, newData);
                    } catch (patchError) {
                        // Patch failed - clear cache and wait for next full update
                        // Using stale data causes UI to be stuck with wrong state
                        logger.warn('[SSE] Patch failed, clearing cache to force full refresh', { topic, error: patchError });
                        topicDataCache.delete(topic);
                        return; // Don't notify with stale data
                    }
                } else {
                    // Unknown payload type - skip
                    return;
                }

                // Notify all callbacks for this topic
                const callbacks = topicCallbacks.get(topic);
                if (callbacks) {
                    callbacks.forEach(cb => {
                        try {
                            cb(newData);
                        } catch (err) {
                            logger.warn('[SSE] Topic callback error', { topic, error: err });
                        }
                    });
                }
            } catch (err) {
                logger.warn('[SSE] Topic event parse error', { topic, error: err });
            }
        };

        eventSource.addEventListener(topic, listener);
        activeTopicListeners.set(topic, listener);
    }

    // Call backend to subscribe
    try {
        await fetch('/api/realtime/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Framerr-Client': '1'
            },
            credentials: 'include',
            body: JSON.stringify({
                connectionId: state.connectionId,
                topic
            })
        });
        logger.debug('[SSE] Subscribed to topic', { topic });
    } catch (err) {
        logger.warn('[SSE] Failed to subscribe via API', { topic, error: err });
    }

    // Return unsubscribe function
    return () => {
        const callbacks = topicCallbacks.get(topic);
        if (callbacks) {
            callbacks.delete(callback);

            // If no more callbacks for this topic, cleanup
            if (callbacks.size === 0) {
                topicCallbacks.delete(topic);
                topicDataCache.delete(topic);

                // Remove event listener
                const listener = activeTopicListeners.get(topic);
                if (listener && eventSource) {
                    eventSource.removeEventListener(topic, listener);
                    activeTopicListeners.delete(topic);
                }

                // Call backend to unsubscribe
                if (state.connectionId) {
                    fetch('/api/realtime/unsubscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Framerr-Client': '1'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            connectionId: state.connectionId,
                            topic
                        })
                    }).catch(err => {
                        logger.warn('[SSE] Failed to unsubscribe via API', { topic, error: err });
                    });
                }

                logger.debug('[SSE] Unsubscribed from topic', { topic });
            }
        }
    };
}

// ============================================================================
// P9: SSE LIFECYCLE API (auth-aware)
// ============================================================================

/**
 * P9: Initialize SSE connection after user authentication.
 * Must be called after login to enable SSE functionality.
 */
export function initializeSSE(): void {
    if (isSSEEnabled) {
        logger.debug('[SSE] Already initialized');
        return;
    }

    // SSE connection initiated - the 'Connected' log fires when connectionId is received
    isSSEEnabled = true;
    connectionAttempts = 0;
    setConnectionState('connecting');
    connect();
}

/**
 * P9: Disconnect SSE and prevent reconnection.
 * Should be called on logout.
 */
export function disconnectSSE(): void {
    if (!isSSEEnabled) {
        return;
    }

    logger.info('[SSE] Disconnecting');
    isSSEEnabled = false;

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }

    connectionAttempts = 0;
    setState({ isConnected: false, connectionId: null, disconnectedAt: null });
    setConnectionState('idle');

    // Clear all topic subscriptions
    topicCallbacks.clear();
    topicDataCache.clear();
    activeTopicListeners.clear();
}

/**
 * P9: Retry connection after failure.
 * Can be called manually or on user action.
 */
export function retrySSEConnection(): void {
    if (!isSSEEnabled) {
        logger.warn('[SSE] Cannot retry: SSE not initialized');
        return;
    }

    if (connectionState === 'failed') {
        logger.info('[SSE] Retrying connection');
        connectionAttempts = 0;
        setConnectionState('connecting');
        connect();
    }
}

// ============================================================================
// REACT HOOK
// ============================================================================

function subscribeToStore(listener: () => void) {
    stateListeners.add(listener);

    // P9: Only connect if SSE is enabled (auth guard)
    // Previously: auto-connected on first subscriber
    // Now: requires explicit initializeSSE() call
    if (stateListeners.size === 1 && !eventSource && isSSEEnabled) {
        connect();
    }

    return () => {
        stateListeners.delete(listener);
    };
}

function getSnapshot(): RealtimeState {
    return state;
}

export interface UseRealtimeSSEResult {
    isConnected: boolean;
    connectionId: string | null;
    disconnectedAt: number | null;  // Phase 5: for tiered disconnect UI
    subscribeToTopic: (topic: string, callback: (data: unknown) => void) => Promise<() => void>;
    onServiceStatus: (callback: (event: ServiceStatusEvent) => void) => () => void;
    onBackupEvent: (callback: (event: BackupEvent) => void) => () => void;
    // Phase 7: Notification events via unified SSE
    onNotification: (callback: (event: NotificationEvent) => void) => () => void;
    // Global settings invalidation for real-time sync
    onSettingsInvalidate: (callback: (event: SettingsInvalidateEvent) => void) => () => void;
    // Settings SSE: Theme events for real-time theme sync
    onThemeChange: (callback: (event: ThemeEvent) => void) => () => void;
    // Library sync progress for smooth progress bar
    onLibrarySyncProgress: (callback: (event: LibrarySyncProgressEvent) => void) => () => void;
    // LEGACY: Empty stubs until Phase 8 widget migration (these widgets should use subscribeToTopic)
    plexSessions: PlexSession[];
    sonarrQueue: QueueItem[];
    radarrQueue: QueueItem[];
}

// Export NotificationEvent type for consumers
export type { NotificationEvent };

/**
 * Connect to Framerr SSE for real-time updates.
 * Uses singleton pattern - all components share one connection.
 */
export function useRealtimeSSE(): UseRealtimeSSEResult {
    const currentState = useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);

    const onServiceStatus = useCallback((callback: (event: ServiceStatusEvent) => void) => {
        serviceStatusCallbacks.add(callback);
        return () => {
            serviceStatusCallbacks.delete(callback);
        };
    }, []);

    const onBackupEvent = useCallback((callback: (event: BackupEvent) => void) => {
        backupCallbacks.add(callback);
        return () => {
            backupCallbacks.delete(callback);
        };
    }, []);

    // Phase 7: Notification callback registration
    const onNotification = useCallback((callback: (event: NotificationEvent) => void) => {
        notificationCallbacks.add(callback);
        return () => {
            notificationCallbacks.delete(callback);
        };
    }, []);

    // Global settings invalidation callback registration
    const onSettingsInvalidate = useCallback((callback: (event: SettingsInvalidateEvent) => void) => {
        settingsInvalidateCallbacks.add(callback);
        return () => {
            settingsInvalidateCallbacks.delete(callback);
        };
    }, []);

    // Settings SSE: Theme callback registration for real-time theme sync
    const onThemeChange = useCallback((callback: (event: ThemeEvent) => void) => {
        themeCallbacks.add(callback);
        return () => {
            themeCallbacks.delete(callback);
        };
    }, []);

    // Library sync progress callback for smooth progress bar updates
    const onLibrarySyncProgress = useCallback((callback: (event: LibrarySyncProgressEvent) => void) => {
        librarySyncProgressCallbacks.add(callback);
        return () => {
            librarySyncProgressCallbacks.delete(callback);
        };
    }, []);

    return {
        isConnected: currentState.isConnected,
        connectionId: currentState.connectionId,
        disconnectedAt: currentState.disconnectedAt,
        subscribeToTopic: subscribeToTopicInternal,
        onServiceStatus,
        onBackupEvent,
        onNotification,
        onSettingsInvalidate,
        onThemeChange,
        onLibrarySyncProgress,
        // LEGACY: Empty stubs - widgets should migrate to subscribeToTopic in Phase 8
        plexSessions: [],
        sonarrQueue: [],
        radarrQueue: []
    };
}

/**
 * Hook for subscribing to a specific topic with automatic cleanup.
 * Returns the latest data for the topic.
 */
export function useTopicSubscription<T>(topic: string | null): T | null {
    const dataRef = useRef<T | null>(null);
    const { subscribeToTopic, connectionId } = useRealtimeSSE();

    useEffect(() => {
        if (!topic || !connectionId) {
            return;
        }

        let unsubscribe: (() => void) | null = null;

        subscribeToTopic(topic, (data) => {
            dataRef.current = data as T;
            // Force re-render by triggering state update
            // This is a simplified approach - in production might want to use a separate state
        }).then(unsub => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [topic, connectionId, subscribeToTopic]);

    return dataRef.current;
}

export default useRealtimeSSE;
