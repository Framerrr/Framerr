/**
 * RealtimeOrchestrator
 * 
 * Manages persistent connections (WebSocket, etc.) to real-time data sources.
 * Uses a hybrid strategy: starts on first subscriber, stops after 5min idle.
 * 
 * Features:
 * - Per-topic connection management
 * - Automatic reconnection with exponential backoff
 * - Idle timeout for resource efficiency
 * - Health tracking and diagnostics
 * 
 * Implements the design from IMPLEMENTATION_PLAN.md lines 401-569.
 */

import logger from '../../utils/logger';
import { IntegrationPlugin, RealtimeManager, PluginInstance } from '../../integrations/types';
import { getInstanceById as getIntegrationInstance } from '../../db/integrationInstances';
import { broadcastToTopic } from './transport';
import { pollerOrchestrator } from './PollerOrchestrator';

// ============================================================================
// TYPES
// ============================================================================

interface RealtimeState {
    manager: RealtimeManager;
    reconnectAttempts: number;
    lastConnected: Date | null;
    instanceId: string;
    type: string;
    /** Current mode: 'websocket' or 'polling' (fallback) */
    mode: 'websocket' | 'polling';
    /** Plugin reference for potential WS retry */
    plugin: IntegrationPlugin;
    /** Timer for periodic WS retry when in polling mode */
    wsRetryTimer?: NodeJS.Timeout;
}

export interface RealtimeHealth {
    topic: string;
    type: string;
    status: 'connected' | 'disconnected';
    reconnectAttempts: number;
    lastConnected: string | null;
}

// ============================================================================
// REALTIME ORCHESTRATOR CLASS
// ============================================================================

export class RealtimeOrchestrator {
    private activeConnections: Map<string, RealtimeState> = new Map();
    private broadcastFn: (topic: string, data: unknown, options?: { forceFullPayload?: boolean }) => void;
    private idleTimers: Map<string, NodeJS.Timeout> = new Map();

    // Configuration constants
    private static readonly IDLE_TIMEOUT_MS = 5 * 60_000;       // 5 minutes
    private static readonly RECONNECT_INITIAL = 1_000;          // 1 second
    private static readonly RECONNECT_MAX = 120_000;            // 2 minutes
    private static readonly WS_FAILURE_THRESHOLD = 5;           // Fall back to polling after ~30s (1+2+4+8+16=31s with backoff)
    private static readonly WS_RETRY_INTERVAL_MS = 60_000;      // Retry WS every 60s when in polling mode

    constructor(broadcast?: (topic: string, data: unknown, options?: { forceFullPayload?: boolean }) => void) {
        this.broadcastFn = broadcast || broadcastToTopic;
    }

    /**
     * Start a realtime connection for a topic.
     * Called when first subscriber joins a realtime topic.
     */
    start(topic: string, plugin: IntegrationPlugin, instanceId: string): void {
        if (this.activeConnections.has(topic)) return;
        if (!plugin.realtime) return;

        const instance = getIntegrationInstance(instanceId);
        if (!instance) {
            logger.warn(`[Realtime] Instance not found: instanceId=${instanceId}`);
            return;
        }

        // Convert to PluginInstance format
        const pluginInstance: PluginInstance = {
            id: instance.id,
            type: instance.type,
            name: instance.displayName,
            config: typeof instance.config === 'string'
                ? JSON.parse(instance.config)
                : instance.config
        };

        const onUpdate = (data: unknown) => {
            this.broadcastFn(topic, {
                ...(typeof data === 'object' && data !== null ? data : { data }),
                _meta: { healthy: true, source: 'realtime' }
            }, { forceFullPayload: true });
        };

        const manager = plugin.realtime.createManager(pluginInstance, onUpdate);

        // Set up event handlers for reconnection
        manager.onDisconnect = () => this.handleDisconnect(topic);
        manager.onConnect = () => this.handleConnect(topic);
        manager.onError = (err) => this.handleError(topic, err);

        this.activeConnections.set(topic, {
            manager,
            reconnectAttempts: 0,
            lastConnected: null,
            instanceId,
            type: plugin.id,
            mode: 'websocket',
            plugin,
        });

        manager.connect();

        logger.info(`[Realtime] Starting WS: topic=${topic} type=${plugin.id}`);
    }

    /**
     * Called when first subscriber arrives - cancel any pending idle timer.
     */
    onSubscribe(topic: string): void {
        const timer = this.idleTimers.get(topic);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(topic);
            logger.debug(`[Realtime] Idle timer cancelled: topic=${topic}`);
        }
    }

    /**
     * Called when last subscriber leaves - start idle timer (hybrid strategy).
     * Connection persists for 5 minutes to handle tab switches, refreshes.
     */
    onLastSubscriberLeave(topic: string): void {
        const timer = setTimeout(() => {
            this.stopConnection(topic);
            this.idleTimers.delete(topic);
        }, RealtimeOrchestrator.IDLE_TIMEOUT_MS);

        this.idleTimers.set(topic, timer);
        logger.debug(`[Realtime] Idle timer started: topic=${topic} timeout=5min`);
    }

    /**
     * Internal: actually close the connection after idle timeout.
     */
    private stopConnection(topic: string): void {
        const state = this.activeConnections.get(topic);
        if (!state) return;

        state.manager.disconnect();
        this.activeConnections.delete(topic);

        logger.debug(`[Realtime] Stopped after idle: topic=${topic}`);
    }

    /**
     * Immediate stop (e.g., shutdown, instance deleted).
     */
    stop(topic: string): void {
        // Cancel any idle timer
        const timer = this.idleTimers.get(topic);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(topic);
        }

        this.stopConnection(topic);

        logger.debug(`[Realtime] Stopped: topic=${topic}`);
    }

    /**
     * Handle successful connection.
     */
    private handleConnect(topic: string): void {
        const state = this.activeConnections.get(topic);
        if (!state) return;

        const wasInFailedState = state.reconnectAttempts >= RealtimeOrchestrator.WS_FAILURE_THRESHOLD;
        const wasInPollingMode = state.mode === 'polling';

        state.reconnectAttempts = 0;
        state.lastConnected = new Date();

        // If we were in polling mode, switch back to websocket
        if (wasInPollingMode) {
            state.mode = 'websocket';
            // Stop poller
            pollerOrchestrator.stop(topic);
            // Clear WS retry timer
            if (state.wsRetryTimer) {
                clearInterval(state.wsRetryTimer);
                state.wsRetryTimer = undefined;
            }
            logger.info(`[Realtime] Recovered to WS: topic=${topic}`);
        }

        // Broadcast recovery if we were in error state
        if (wasInFailedState || wasInPollingMode) {
            this.broadcastFn(topic, {
                _meta: {
                    healthy: true,
                    source: 'realtime',
                    recovered: true,
                }
            });
        }
        logger.debug(`[Realtime] Connected: topic=${topic}`);
    }

    /**
     * Handle disconnection - schedule reconnect.
     */
    private handleDisconnect(topic: string): void {
        const state = this.activeConnections.get(topic);
        if (!state) return;

        this.scheduleReconnect(topic, state);
    }

    /**
     * Handle error - notify frontend of degraded state.
     * 
     * In polling mode, WS errors are suppressed since the poller is still
     * providing data. Only log the error for debugging.
     * 
     * This implements the "self-healing redundancy" model:
     * - Error is only broadcast when BOTH sources fail
     * - WS failures during polling are silent (poller is the active source)
     * - Poller failures are handled by PollerOrchestrator
     */
    private handleError(topic: string, error: string): void {
        const state = this.activeConnections.get(topic);
        if (!state) return;

        // In polling mode, WS errors are expected (we're retrying in background)
        // Don't broadcast error to frontend - the poller is providing data
        if (state.mode === 'polling') {
            logger.debug(`[Realtime] WS retry failed (polling active): topic=${topic} error="${error}"`);
            return;
        }

        logger.warn(`[Realtime] Error: topic=${topic} error="${error}"`);

        // Notify frontend of degraded state (only when WS is the primary source)
        this.broadcastFn(topic, {
            _error: true,
            _message: 'Real-time connection lost, reconnecting...',
            _meta: {
                healthy: false,
                reconnectAttempts: state.reconnectAttempts,
            }
        });
    }

    /**
     * Schedule a reconnection with exponential backoff.
     * After WS_FAILURE_THRESHOLD attempts (~30s), falls back to polling.
     */
    private scheduleReconnect(topic: string, state: RealtimeState): void {
        state.reconnectAttempts++;

        // Fall back to polling after ~30 seconds of WS failures
        // With exponential backoff: 1+2+4+8+16 = 31 seconds for 5 attempts
        if (state.reconnectAttempts >= RealtimeOrchestrator.WS_FAILURE_THRESHOLD) {
            this.switchToPolling(topic, state);
            return;
        }

        // Exponential backoff for WS retries: 1s → 2s → 4s
        const delay = Math.min(
            RealtimeOrchestrator.RECONNECT_INITIAL * Math.pow(2, state.reconnectAttempts - 1),
            RealtimeOrchestrator.RECONNECT_MAX
        );

        logger.debug(`[Realtime] WS retry: topic=${topic} attempt=${state.reconnectAttempts} delay=${delay}ms`);

        setTimeout(() => {
            if (this.activeConnections.has(topic) && state.mode === 'websocket') {
                state.manager.connect();
            }
        }, delay);
    }

    /**
     * Switch from WebSocket to Polling mode after WS failures.
     * Starts poller and schedules periodic WS retry attempts.
     */
    private switchToPolling(topic: string, state: RealtimeState): void {
        if (state.mode === 'polling') return; // Already in polling mode

        state.mode = 'polling';

        // Disconnect the WS manager (it's failing anyway)
        state.manager.disconnect();

        // Start the poller for this topic
        pollerOrchestrator.start(topic);

        // Log the fallback
        logger.warn(`[Realtime] Falling back to polling: topic=${topic} after ${state.reconnectAttempts} WS failures`);

        // Schedule periodic WS retry attempts (every 60s)
        state.wsRetryTimer = setInterval(() => {
            if (state.mode === 'polling' && this.activeConnections.has(topic)) {
                logger.debug(`[Realtime] Attempting WS reconnect: topic=${topic}`);
                // Try to reconnect WS
                state.manager.connect();
            }
        }, RealtimeOrchestrator.WS_RETRY_INTERVAL_MS);
    }

    /**
     * Refresh a realtime connection for an instance.
     * Called when integration config is updated to force manager recreation
     * with fresh config values.
     * 
     * This solves the "stale config" problem where the manager was created
     * with old URL/token values and continues trying to connect to the old endpoint.
     */
    refreshConnection(instanceId: string): void {
        // Find all topics for this instance
        const topicsToRefresh: Array<{ topic: string; state: RealtimeState }> = [];

        for (const [topic, state] of this.activeConnections) {
            if (state.instanceId === instanceId) {
                topicsToRefresh.push({ topic, state });
            }
        }

        if (topicsToRefresh.length === 0) {
            logger.debug(`[Realtime] No active connections to refresh for instanceId=${instanceId}`);
            return;
        }

        // For each topic, disconnect and remove (let next subscriber re-create with fresh config)
        for (const { topic, state } of topicsToRefresh) {
            logger.info(`[Realtime] Refreshing connection: topic=${topic} instanceId=${instanceId}`);

            // Clear any WS retry timer
            if (state.wsRetryTimer) {
                clearInterval(state.wsRetryTimer);
            }

            // Clear idle timer if any
            const idleTimer = this.idleTimers.get(topic);
            if (idleTimer) {
                clearTimeout(idleTimer);
                this.idleTimers.delete(topic);
            }

            // Disconnect the manager
            state.manager.disconnect();

            // Stop poller if in polling mode
            if (state.mode === 'polling') {
                pollerOrchestrator.stop(topic);
            }

            // Remove from active connections
            this.activeConnections.delete(topic);

            // Re-start the connection fresh with new config
            // The next call arrives from subscriptions.onSubscribe which calls handleTopicSubscription
            // We need to restart immediately since there are still subscribers
            this.start(topic, state.plugin, instanceId);
        }

        logger.info(`[Realtime] Refreshed ${topicsToRefresh.length} connection(s) for instanceId=${instanceId}`);
    }

    /**
     * Get health status for all active connections.
     * Used by diagnostics endpoint.
     */
    getHealth(): RealtimeHealth[] {
        return Array.from(this.activeConnections.entries()).map(([topic, state]) => ({
            topic,
            type: state.type,
            status: state.manager.isConnected() ? 'connected' : 'disconnected',
            reconnectAttempts: state.reconnectAttempts,
            lastConnected: state.lastConnected?.toISOString() || null,
        }));
    }

    /**
     * Shutdown all connections (called during server shutdown).
     */
    shutdown(): void {
        // Clear all idle timers
        for (const timer of this.idleTimers.values()) {
            clearTimeout(timer);
        }
        this.idleTimers.clear();

        // Disconnect all active connections
        for (const [topic, state] of this.activeConnections) {
            state.manager.disconnect();
            logger.debug(`[Realtime] Shutdown: topic=${topic}`);
        }
        this.activeConnections.clear();

        logger.info('[Realtime] All connections shut down');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const realtimeOrchestrator = new RealtimeOrchestrator();
