/**
 * SSE Module - Public API
 * 
 * This barrel exports all SSE functionality.
 * Types from ./types, connections from ./connections, subscriptions from ./subscriptions.
 * 
 * @deprecated PHASE: SSE-P3
 * @status EVOLVING
 * @note This file evolves as modules are extracted. Currently Phase 3 complete (connections + types + subscriptions).
 */

// Type exports from dedicated types module
export type {
    QueueItem,
    PlexSession,
    Subscription,
} from './types';

// Connection types and interfaces
export type {
    ClientConnection,
    PendingDisconnect,
} from './connections';

// Subscription payload type
export type {
    SSEEventPayload,
} from './subscriptions';

// Connection management from dedicated module
export {
    // Constants
    GRACE_PERIOD_MS,

    // State (for internal use by other SSE modules)
    clientConnections,
    responseToConnectionId,
    pendingDisconnects,
    clients,

    // Connection functions
    addClient,
    removeClient,
    addClientConnection,
    removeClientConnection,
    sendToConnection,
    hasUserConnection,
    getClientCount,
    setPushEndpoint,
    getActiveEndpointsForUser,
    registerSubscriptionHandlers,
} from './connections';

// Subscription management from dedicated module
export {
    // State (for internal use)
    subscriptions,

    // Subscription functions
    subscribe,
    unsubscribe,
    getSubscriberCount,
    hasSubscribers,
    getActiveTopics,

    // Grace period handlers (used by connections)
    handleGracePeriodExpiry,
    restoreSubscriptions,

    // Poller callback registration
    setStartPollerCallback,
    setTopicFilterCallback,
} from './subscriptions';

// Transport layer (broadcasting) from dedicated module
export {
    // Broadcasting
    broadcast,
    broadcastToTopic,
    broadcastToTopicFiltered,
    broadcastToUser,
    broadcastToAllUsers,

    // Legacy cache access
    getCachedPlexSessions,
    getCachedSonarrQueue,
    getCachedRadarrQueue,
} from './transport';

export type { SubscriberFilterFn } from './transport';

// Polling from PollerOrchestrator (Phase 4 corrected)
export {
    // Topic parsing utilities
    parseTopic,
    getPollingInterval,

    // Poller lifecycle (backward-compatible function exports)
    startPollerForTopic,
    stopPollerForTopic,

    // On-demand polling
    supportsOnDemandPolling,
    triggerTopicPoll,

    // Class and singleton (new in Phase 4 correction)
    PollerOrchestrator,
    pollerOrchestrator,
} from './PollerOrchestrator';

// Export types for diagnostics
export type { PollerHealth } from './PollerOrchestrator';

// Phase 4b: RealtimeOrchestrator for WebSocket connections
export {
    RealtimeOrchestrator,
    realtimeOrchestrator,
} from './RealtimeOrchestrator';

export type { RealtimeHealth } from './RealtimeOrchestrator';

// NOTE: Lifecycle functions removed - orchestrators are self-starting on first subscription

// ============================================================================
// MODULE INITIALIZATION - Wire up callbacks between modules
// ============================================================================

import { registerSubscriptionHandlers as registerHandlers } from './connections';
import { handleGracePeriodExpiry as gracePeriodHandler, restoreSubscriptions as restoreHandler, setPollerCallbacks, setRealtimeCallbacks, setTopicFilterCallback } from './subscriptions';
import { pollerOrchestrator, parseTopic } from './PollerOrchestrator';
import { realtimeOrchestrator } from './RealtimeOrchestrator';
import { getPlugin } from '../../integrations/registry';

/**
 * Initialize SSE module by wiring callbacks.
 * Called automatically on module load.
 * 
 * Wires:
 * 1. connections -> subscriptions (grace period handlers)
 * 2. subscriptions -> PollerOrchestrator (poller lifecycle)
 * 3. subscriptions -> RealtimeOrchestrator (realtime lifecycle)
 */
export function initializeSSEModule(): void {
    // Wire connections -> subscriptions callbacks for grace period
    registerHandlers(gracePeriodHandler, restoreHandler);

    // Wire subscriptions -> PollerOrchestrator for poller lifecycle
    setPollerCallbacks(
        (topic: string) => pollerOrchestrator.start(topic),
        (topic: string) => pollerOrchestrator.stop(topic)
    );

    // Wire subscriptions -> RealtimeOrchestrator for realtime lifecycle
    setRealtimeCallbacks(
        (topic: string) => {
            const { type, instanceId } = parseTopic(topic);
            const plugin = getPlugin(type);
            if (plugin?.realtime && instanceId) {
                realtimeOrchestrator.start(topic, plugin, instanceId);
            }
        },
        (topic: string) => realtimeOrchestrator.stop(topic)
    );

    // Wire subscriptions -> PollerOrchestrator for topic-level data filtering
    // When subscribe() returns cached data, apply per-user filters if registered
    setTopicFilterCallback((userId: string, data: unknown, topic: string) => {
        const filterFn = pollerOrchestrator.getTopicFilter(topic);
        if (filterFn) {
            return filterFn(userId, data, topic);
        }
        return data;
    });
}

// Auto-initialize on module load
initializeSSEModule();

