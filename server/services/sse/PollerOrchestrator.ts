/**
 * SSE Poller Orchestrator
 * 
 * Class-based polling management with error isolation, exponential backoff,
 * and health diagnostics. Each topic runs in complete isolation.
 * 
 * Implementation is split across focused modules:
 * - topicPolicy.ts: constants, types, topic parsing, interval resolution
 * - pollExecution.ts: poll routing, monitor polling, data fetching
 * - errorPolicy.ts: error classification, fast retry, exponential backoff
 * 
 * @module server/services/sse/PollerOrchestrator
 */

import { subscriptions } from './subscriptions';
import { getPlugin } from '../../integrations/registry';
import { metricHistoryService } from '../MetricHistoryService';
import logger from '../../utils/logger';
import type { SubscriberFilterFn } from './transport';

// Re-export public API from extracted modules
export { parseTopic, getPollingInterval } from './topicPolicy';
export type { PollerHealth, PollerState, TopicInfo } from './topicPolicy';

// Import from extracted modules
import { parseTopic, getPollingInterval, getTopicFilter } from './topicPolicy';
import type { PollerState, PollerHealth } from './topicPolicy';
import { pollForTopic } from './pollExecution';
import { handlePollSuccess, handlePollError } from './errorPolicy';

// ============================================================================
// POLLER ORCHESTRATOR CLASS
// ============================================================================

/**
 * Manages polling for SSE topics with error isolation and exponential backoff.
 * 
 * Key features:
 * - Each topic polls independently (isolated failures)
 * - Consecutive error tracking
 * - Exponential backoff after 3 errors
 * - Health metadata broadcasting
 * - Diagnostics via getHealth()
 */
export class PollerOrchestrator {
    private activePollers: Map<string, PollerState> = new Map();
    private topicFilters: Map<string, SubscriberFilterFn> = new Map();

    // Startup tracking - collect topics during initial startup phase
    private startupTopics: string[] = [];
    private startupTimer: NodeJS.Timeout | null = null;
    private static readonly STARTUP_WINDOW_MS = 2000; // 2 second window to collect starts

    /**
     * Start polling for a topic.
     * Called when the first subscriber subscribes.
     */
    start(topic: string): void {
        // Collect during startup window, log summary after
        this.collectStartupTopic(topic);

        // Don't start duplicate pollers
        if (this.activePollers.has(topic)) {
            logger.debug(`[PollerOrchestrator] Already polling: topic=${topic}`);
            return;
        }

        // Check if subscription exists
        const sub = subscriptions.get(topic);
        if (!sub) {
            logger.warn(`[PollerOrchestrator] Cannot start: subscription not found topic=${topic}`);
            return;
        }

        const topicInfo = parseTopic(topic);
        const baseIntervalMs = getPollingInterval(topic);

        // Create poll function that wraps error handling
        const pollFn = () => this.executePoll(topic);

        // Start the interval
        const interval = setInterval(pollFn, baseIntervalMs);

        // Track state
        this.activePollers.set(topic, {
            interval,
            consecutiveErrors: 0,
            lastError: null,
            lastSuccess: null,
            currentIntervalMs: baseIntervalMs,
            baseIntervalMs,
            topicInfo,
            inFastRetryMode: false,
        });

        // Poll immediately
        pollFn();

        // Notify metric history service of SSE subscriber for system-status topics
        const topicPlugin = getPlugin(topicInfo.type);
        if (topicInfo.instanceId && topicPlugin?.metrics?.length) {
            metricHistoryService.onSSEActive(topicInfo.instanceId);
        }

        logger.debug(`[PollerOrchestrator] Started: topic=${topic} interval=${baseIntervalMs}ms`);
    }

    /**
     * Stop polling for a topic.
     * Called when the last subscriber unsubscribes.
     */
    stop(topic: string): void {
        const state = this.activePollers.get(topic);
        if (!state) return;

        clearInterval(state.interval);
        this.activePollers.delete(topic);

        // Notify metric history service when SSE stops for system-status topics
        const stoppedPlugin = getPlugin(state.topicInfo.type);
        if (state.topicInfo.instanceId && stoppedPlugin?.metrics?.length) {
            metricHistoryService.onSSEIdle(state.topicInfo.instanceId);
        }

        logger.debug(`[PollerOrchestrator] Stopped: topic=${topic}`);
    }

    /**
     * Trigger an immediate poll and broadcast for a topic.
     * Used for on-demand updates like after maintenance toggle.
     */
    async triggerPoll(topic: string): Promise<void> {
        const sub = subscriptions.get(topic);
        if (!sub || sub.subscribers.size === 0) {
            logger.debug(`[PollerOrchestrator] triggerPoll: no subscribers topic=${topic}`);
            return;
        }

        await this.executePoll(topic);
        logger.debug(`[PollerOrchestrator] triggerPoll: complete topic=${topic}`);
    }

    /**
     * Check if a topic supports on-demand polling.
     */
    supportsPolling(topic: string): boolean {
        const { type, subtype } = parseTopic(topic);

        // Check plugin registry
        const plugin = getPlugin(type);
        if (plugin?.poller) {
            return true;
        }

        // Special case: calendar subtypes
        if ((type === 'sonarr' || type === 'radarr') && (subtype === 'calendar' || subtype === 'missing')) {
            return true;
        }

        return false;
    }

    /**
     * Get health status for all active pollers.
     * Used for diagnostics endpoint.
     */
    getHealth(): PollerHealth[] {
        return Array.from(this.activePollers.entries()).map(([topic, state]) => ({
            topic,
            status: state.consecutiveErrors === 0 ? 'healthy'
                : state.consecutiveErrors < 3 ? 'warning'
                    : 'degraded',
            lastSuccess: state.lastSuccess?.toISOString() || null,
            consecutiveErrors: state.consecutiveErrors,
            lastError: state.lastError,
            currentIntervalMs: state.currentIntervalMs,
        }));
    }

    /**
     * Check if a topic is currently being polled.
     */
    isPolling(topic: string): boolean {
        return this.activePollers.has(topic);
    }

    /**
     * Register a per-subscriber filter for topics matching a prefix.
     * When data is broadcast for a matching topic, filterFn runs per-user
     * to produce filtered payloads.
     * 
     * @param topicPrefix - Prefix to match (e.g., 'overseerr:' matches 'overseerr:abc123')
     * @param filterFn - Function(userId, data) => filtered data for that user
     */
    registerTopicFilter(topicPrefix: string, filterFn: SubscriberFilterFn): void {
        this.topicFilters.set(topicPrefix, filterFn);
        logger.debug(`[PollerOrchestrator] Registered topic filter: prefix=${topicPrefix}`);
    }

    /**
     * Get filter for a topic, if any registered prefix matches.
     */
    getTopicFilter(topic: string): SubscriberFilterFn | null {
        return getTopicFilter(topic, this.topicFilters);
    }

    /**
     * Shutdown all pollers (called during server shutdown).
     */
    shutdown(): void {
        for (const [topic, state] of this.activePollers) {
            clearInterval(state.interval);
            logger.debug(`[PollerOrchestrator] Shutdown: topic=${topic}`);
        }
        this.activePollers.clear();

        logger.info('[PollerOrchestrator] All pollers shut down');
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    /**
     * Collect topic starts during startup window, then log summary.
     * Reduces log spam during initial connection when many topics start at once.
     */
    private collectStartupTopic(topic: string): void {
        this.startupTopics.push(topic);

        // Start or reset the timer
        if (this.startupTimer) {
            clearTimeout(this.startupTimer);
        }

        this.startupTimer = setTimeout(() => {
            if (this.startupTopics.length > 0) {
                // Group by integration type for cleaner summary
                const typeCounts: Record<string, number> = {};
                for (const t of this.startupTopics) {
                    const { type } = parseTopic(t);
                    typeCounts[type] = (typeCounts[type] || 0) + 1;
                }

                const summary = Object.entries(typeCounts)
                    .map(([type, count]) => `${type}:${count}`)
                    .join(', ');

                logger.info(`[PollerOrchestrator] Started ${this.startupTopics.length} pollers (${summary})`);
                this.startupTopics = [];
            }
            this.startupTimer = null;
        }, PollerOrchestrator.STARTUP_WINDOW_MS);
    }

    /**
     * Execute a poll for a topic and handle success/error.
     */
    private async executePoll(topic: string): Promise<void> {
        const state = this.activePollers.get(topic);
        if (!state) return;

        try {
            const data = await pollForTopic(topic, state.topicInfo);
            if (data === null || data === undefined) {
                handlePollError(topic, 'Poll returned no data', this.activePollers, (t) => this.executePoll(t));
            } else {
                handlePollSuccess(topic, data, this.activePollers, this.topicFilters, (t) => this.executePoll(t));
            }
        } catch (error) {
            handlePollError(topic, (error as Error).message, this.activePollers, (t) => this.executePoll(t));
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of the PollerOrchestrator.
 * Used by the SSE module for all polling operations.
 */
export const pollerOrchestrator = new PollerOrchestrator();

// ============================================================================
// CONVENIENCE EXPORTS (for backward compatibility with pollers.ts API)
// ============================================================================

/**
 * Start polling for a topic.
 * @deprecated Use pollerOrchestrator.start() directly
 */
export function startPollerForTopic(topic: string): void {
    pollerOrchestrator.start(topic);
}

/**
 * Stop polling for a topic.
 * @deprecated Use pollerOrchestrator.stop() directly
 */
export function stopPollerForTopic(topic: string): void {
    pollerOrchestrator.stop(topic);
}

/**
 * Check if a topic supports on-demand polling.
 * @deprecated Use pollerOrchestrator.supportsPolling() directly
 */
export function supportsOnDemandPolling(topic: string): boolean {
    return pollerOrchestrator.supportsPolling(topic);
}

/**
 * Trigger an immediate poll and broadcast for a topic.
 * @deprecated Use pollerOrchestrator.triggerPoll() directly
 */
export async function triggerTopicPoll(topic: string): Promise<void> {
    await pollerOrchestrator.triggerPoll(topic);
}
