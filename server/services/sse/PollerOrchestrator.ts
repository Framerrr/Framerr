/**
 * SSE Poller Orchestrator
 * 
 * Class-based polling management with error isolation, exponential backoff,
 * and health diagnostics. Each topic runs in complete isolation.
 * 
 * @module server/services/sse/PollerOrchestrator
 */

import { subscriptions } from './subscriptions';
import { broadcastToTopic, broadcastToTopicFiltered } from './transport';
import type { SubscriberFilterFn } from './transport';
import { getPlugin } from '../../integrations/registry';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { metricHistoryService } from '../MetricHistoryService';
import logger from '../../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Polling intervals by integration type (in milliseconds).
 * Queue subtypes get faster polling for near real-time download progress.
 */
const POLLING_INTERVALS: Record<string, number> = {
    'qbittorrent': 5000,        // 5 seconds
    'glances': 2000,            // 2 seconds
    'customsystemstatus': 2000, // 2 seconds
    'sonarr': 5000,             // 5 seconds (default)
    'radarr': 5000,             // 5 seconds (default)
    'sonarr:queue': 3000,       // 3 seconds (queue data - near real-time)
    'radarr:queue': 3000,       // 3 seconds
    'sonarr:calendar': 300000,  // 5 minutes (calendar changes rarely)
    'sonarr:missing': 60000,    // 1 minute (missing counts for stats bar)
    'radarr:calendar': 300000,  // 5 minutes
    'overseerr': 60000,         // 60 seconds (requests)
    'overseerr:requests': 60000,
    'plex': 30000,              // 30 seconds
    'monitor': 10000,           // 10 seconds
    'monitors': 30000,          // 30 seconds
    'default': 10000            // 10 seconds fallback
};

/** Maximum backoff interval: 3 minutes */
const BACKOFF_MAX_MS = 3 * 60 * 1000;

/** Fixed base interval for exponential backoff (standardized across all pollers) */
const BACKOFF_BASE_MS = 15_000;

/** Fast retry interval: 10 seconds for quick error detection */
const FAST_RETRY_INTERVAL_MS = 10_000;

/** Number of fast retries before error broadcast */
const FAST_RETRY_ATTEMPTS = 3;

// ============================================================================
// TYPES
// ============================================================================

/**
 * State tracking for each active poller.
 */
interface PollerState {
    /** The interval timer reference */
    interval: NodeJS.Timeout;
    /** Count of consecutive poll failures */
    consecutiveErrors: number;
    /** Last error message if any */
    lastError: string | null;
    /** Last successful poll time */
    lastSuccess: Date | null;
    /** Current polling interval (may be increased due to backoff) */
    currentIntervalMs: number;
    /** Base interval before any backoff */
    baseIntervalMs: number;
    /** Parsed topic info */
    topicInfo: { type: string; instanceId: string | null; subtype?: string };
    /** Whether in fast retry mode (10s intervals for quick error detection) */
    inFastRetryMode: boolean;
}

/**
 * Health status for a poller, returned by getHealth().
 */
export interface PollerHealth {
    topic: string;
    status: 'healthy' | 'warning' | 'degraded';
    lastSuccess: string | null;
    consecutiveErrors: number;
    lastError: string | null;
    currentIntervalMs: number;
}

// ============================================================================
// UTILITY FUNCTIONS (Exported for use by other modules)
// ============================================================================

/**
 * Parse a topic string into integration type and instance ID.
 * Topic format: "{type}:{instanceId}" or "{type}:queue:{instanceId}" or "monitors:status"
 * 
 * Examples:
 * - "qbittorrent:123" -> { type: 'qbittorrent', instanceId: '123' }
 * - "sonarr:queue:456" -> { type: 'sonarr', instanceId: '456', subtype: 'queue' }
 * - "monitors:status" -> { type: 'monitors', instanceId: null }
 */
export function parseTopic(topic: string): { type: string; instanceId: string | null; subtype?: string } {
    const parts = topic.split(':');

    if (parts.length === 1) {
        return { type: parts[0], instanceId: null };
    }

    if (parts.length === 2) {
        // Could be "type:instanceId" or "type:subtype"
        if (parts[1] === 'status' || parts[1] === 'queue') {
            return { type: parts[0], instanceId: null, subtype: parts[1] };
        }
        return { type: parts[0], instanceId: parts[1] };
    }

    // "type:subtype:instanceId"
    return { type: parts[0], instanceId: parts[2], subtype: parts[1] };
}

/**
 * Get polling interval for a topic.
 * Uses plugin registry if available, otherwise falls back to POLLING_INTERVALS.
 */
export function getPollingInterval(topic: string): number {
    const { type, subtype } = parseTopic(topic);

    // Check for subtype-specific interval first (e.g., "sonarr:calendar", "sonarr:missing")
    // These override the main plugin interval since subtypes often poll at different rates
    if (subtype) {
        const subtypeKey = `${type}:${subtype}`;
        if (POLLING_INTERVALS[subtypeKey]) {
            return POLLING_INTERVALS[subtypeKey];
        }

        // Also check plugin's subtype interval
        const plugin = getPlugin(type);
        if (plugin?.poller?.subtypes?.[subtype]?.intervalMs) {
            return plugin.poller.subtypes[subtype].intervalMs;
        }
    }

    // Check plugin registry for main interval
    const plugin = getPlugin(type);
    if (plugin?.poller?.intervalMs) {
        return plugin.poller.intervalMs;
    }

    return POLLING_INTERVALS[type] ?? POLLING_INTERVALS.default;
}

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
        for (const [prefix, filterFn] of this.topicFilters) {
            if (topic.startsWith(prefix)) {
                return filterFn;
            }
        }
        return null;
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
            const data = await this.pollForTopic(topic, state.topicInfo);
            if (data === null || data === undefined) {
                this.handleError(topic, 'Poll returned no data');
            } else {
                this.handleSuccess(topic, data);
            }
        } catch (error) {
            this.handleError(topic, (error as Error).message);
        }
    }

    /**
     * Execute the actual poll for a topic.
     * Routes to appropriate handler based on topic type.
     */
    private async pollForTopic(
        topic: string,
        topicInfo: { type: string; instanceId: string | null; subtype?: string }
    ): Promise<unknown> {
        const { type, instanceId, subtype } = topicInfo;

        // =================================================================
        // SPECIAL TOPICS (not plugin-based)
        // =================================================================

        // Service monitors - internal Framerr feature, reads from local DB
        if (type === 'monitor' || type === 'monitors') {
            return await this.pollMonitors(instanceId);
        }

        // =================================================================
        // PLUGIN-BASED TOPICS
        // =================================================================

        // Get plugin from registry
        const plugin = getPlugin(type);
        if (!plugin?.poller) {
            throw new Error(`No poller available for topic=${topic}`);
        }

        // Get instance
        const instance = instanceId
            ? integrationInstancesDb.getInstanceById(instanceId)
            : integrationInstancesDb.getFirstEnabledByType(type);

        if (!instance) {
            throw new Error(`No instance found for type=${type}`);
        }

        const pluginInstance = {
            id: instance.id,
            type: instance.type,
            name: instance.displayName,
            config: instance.config
        };

        // Handle subtype-specific polling (e.g., calendar)
        if (subtype && plugin.poller.subtypes?.[subtype]) {
            return await plugin.poller.subtypes[subtype].poll(pluginInstance);
        }

        // Default: use main poller
        return await plugin.poller.poll(pluginInstance);
    }

    /**
     * Poll service monitors from local database.
     * Special handler for monitors:status and monitor:{id} topics.
     */
    private async pollMonitors(instanceId: string | null): Promise<unknown> {
        // Lazy import to avoid circular dependency
        const serviceMonitorsDb = require('../../db/serviceMonitors');

        if (!instanceId) {
            // monitors:status - get all monitors for all instances
            try {
                const all = await serviceMonitorsDb.getAllMonitors();
                return await this.formatMonitors(all, serviceMonitorsDb);
            } catch {
                return [];
            }
        }

        try {
            const monitors = await serviceMonitorsDb.getMonitorsByIntegrationInstance(instanceId);
            return await this.formatMonitors(monitors, serviceMonitorsDb);
        } catch {
            return [];
        }
    }

    /**
     * Format monitors with status data.
     */
    private async formatMonitors(monitors: unknown[], serviceMonitorsDb: unknown): Promise<unknown[]> {
        const db = serviceMonitorsDb as { getRecentChecks: (id: string, count: number) => Promise<{ status?: string; responseTimeMs?: number; checkedAt?: string }[]> };

        return Promise.all((monitors as { id: string; name: string; url: string; iconName?: string; iconId?: string; maintenance?: boolean; intervalSeconds?: number }[]).map(async (m) => {
            const recentChecks = await db.getRecentChecks(m.id, 1);
            const lastCheck = recentChecks[0];

            const rawStatus = lastCheck?.status || 'pending';
            const effectiveStatus = m.maintenance ? 'maintenance' : rawStatus;

            return {
                id: m.id,
                name: m.name,
                url: m.url,
                iconName: m.iconName || null,
                iconId: m.iconId || null,
                maintenance: m.maintenance,
                status: effectiveStatus,
                responseTimeMs: lastCheck?.responseTimeMs || null,
                lastCheck: lastCheck?.checkedAt || null,
                uptimePercent: null,
                intervalSeconds: m.intervalSeconds ?? 60
            };
        }));
    }

    /**
     * Handle successful poll - reset error state, exit fast retry mode, broadcast data.
     */
    private handleSuccess(topic: string, data: unknown): void {
        const state = this.activePollers.get(topic);
        if (!state) return;

        const wasInErrorState = state.consecutiveErrors > 0;

        // Reset error state
        state.consecutiveErrors = 0;
        state.lastError = null;
        state.lastSuccess = new Date();

        // Exit fast retry mode or backoff - restore normal interval
        if (wasInErrorState && (state.inFastRetryMode || state.currentIntervalMs !== state.baseIntervalMs)) {
            state.inFastRetryMode = false;
            clearInterval(state.interval);
            state.interval = setInterval(() => this.executePoll(topic), state.baseIntervalMs);
            state.currentIntervalMs = state.baseIntervalMs;
            const { type, instanceId } = state.topicInfo;
            const serviceName = `${type}${instanceId ? `:${instanceId.slice(0, 8)}` : ''}`;
            logger.info(`[PollerOrchestrator] Service reconnected: ${serviceName}`);
        }

        // Broadcast with health metadata
        // IMPORTANT: Arrays must be wrapped in an object to survive JSON Patch delta updates.
        // Spreading an array as {...array} creates {0: {...}, 1: {...}} which breaks Array.isArray() checks.
        const meta = {
            healthy: true,
            lastPoll: state.lastSuccess.toISOString(),
            errorCount: 0,
        };

        let payload: unknown;
        if (Array.isArray(data)) {
            // Wrap arrays in an object to preserve array structure through delta patching
            payload = { items: data, _meta: meta };
        } else if (typeof data === 'object' && data !== null) {
            // Objects can be spread normally
            payload = { ...(data as Record<string, unknown>), _meta: meta };
        } else {
            payload = data;
        }

        // Use filtered broadcast if a topic filter is registered
        const topicFilter = this.getTopicFilter(topic);
        if (topicFilter) {
            broadcastToTopicFiltered(topic, payload, topicFilter);
        } else {
            broadcastToTopic(topic, payload);
        }

        // Feed metric history recording if enabled
        if (metricHistoryService.isEnabled()) {
            const { type, instanceId } = state.topicInfo;
            if (instanceId && typeof data === 'object' && data !== null) {
                metricHistoryService.onSSEData(instanceId, type, data as Record<string, unknown>);
            }
        }
    }

    /**
     * Config error patterns that should broadcast immediately without retries.
     * These are errors caused by missing/invalid config, not transient failures.
     */
    private static CONFIG_ERROR_PATTERNS = [
        'No URL configured',
        'URL and API key required',
        'URL and token required',
        'No instance found',
    ];

    /**
     * Auth error patterns that should broadcast immediately without retries.
     * Bad credentials won't fix themselves — no point retrying for 30s.
     */
    private static AUTH_ERROR_PATTERNS = [
        'Authentication failed',
        'Request failed with status code 401',
        'Request failed with status code 403',
    ];

    /**
     * Handle poll error - enter fast retry mode for quick error detection.
     * 
     * Strategy:
     * 1. Config errors: broadcast immediately, skip retries
     * 2. On first error: switch to 10s fast retry interval
     * 3. After 3 fast retries (30s): broadcast _error and start exponential backoff
     * 4. This ensures consistent ~30s error detection regardless of normal poll interval
     */
    private handleError(topic: string, error: string): void {
        const state = this.activePollers.get(topic);
        if (!state) return;

        // Config errors broadcast immediately — no retries, config won't fix itself
        const isConfigError = PollerOrchestrator.CONFIG_ERROR_PATTERNS
            .some(p => error.includes(p));
        if (isConfigError) {
            logger.debug(`[PollerOrchestrator] Config error: topic=${topic} error="${error}"`);
            broadcastToTopic(topic, {
                _error: true,
                _message: error,
                _configError: true,
            });
            return;
        }

        // Auth errors broadcast immediately — bad credentials won't fix themselves
        const isAuthError = PollerOrchestrator.AUTH_ERROR_PATTERNS
            .some(p => error.includes(p));
        if (isAuthError) {
            logger.debug(`[PollerOrchestrator] Auth error: topic=${topic} error="${error}"`);
            broadcastToTopic(topic, {
                _error: true,
                _message: 'Authentication failed — check credentials in Settings',
                _authError: true,
            });
            return;
        }

        state.consecutiveErrors++;
        state.lastError = error;

        // Smart logging: debug during retries, single error at threshold, no spam
        if (state.consecutiveErrors < FAST_RETRY_ATTEMPTS) {
            // Debug during fast retry attempts (1, 2) - expected transient failures
            logger.debug(`[PollerOrchestrator] Poll failed (retry ${state.consecutiveErrors}/${FAST_RETRY_ATTEMPTS}): topic=${topic} error="${error}"`);
        } else if (state.consecutiveErrors === FAST_RETRY_ATTEMPTS) {
            // Single ERROR when threshold reached - service confirmed unreachable
            const { type, instanceId } = state.topicInfo;
            const serviceName = `${type}${instanceId ? `:${instanceId.slice(0, 8)}` : ''}`;
            // Calculate backoff interval for informative logging
            const backoffMs = Math.min(
                BACKOFF_BASE_MS * Math.pow(2, state.consecutiveErrors - 2),
                BACKOFF_MAX_MS
            );
            const backoffSec = Math.round(backoffMs / 1000);
            logger.error(`[PollerOrchestrator] Service unreachable: ${serviceName} (backoff: ${backoffSec}s)`);
        }
        // No logging after threshold - avoid spam, UI shows error state

        // Enter fast retry mode on first error (if not already in it)
        if (state.consecutiveErrors === 1 && !state.inFastRetryMode) {
            state.inFastRetryMode = true;
            clearInterval(state.interval);
            state.interval = setInterval(() => this.executePoll(topic), FAST_RETRY_INTERVAL_MS);
            state.currentIntervalMs = FAST_RETRY_INTERVAL_MS;
            // Debug level - routine state change during retry phase
            logger.debug(`[PollerOrchestrator] Fast retry mode: topic=${topic}`);
        }

        // After FAST_RETRY_ATTEMPTS failures: broadcast error and start exponential backoff
        if (state.consecutiveErrors === FAST_RETRY_ATTEMPTS) {
            // Broadcast error state to frontend
            broadcastToTopic(topic, {
                _error: true,
                _message: 'Service temporarily unavailable',
                _lastSuccess: state.lastSuccess?.toISOString(),
                _meta: {
                    healthy: false,
                    errorCount: state.consecutiveErrors,
                    lastError: error,
                }
            });

            // Now apply exponential backoff
            this.applyBackoff(topic);
        }

        // Keep broadcasting error on subsequent failures (backoff continues)
        if (state.consecutiveErrors > FAST_RETRY_ATTEMPTS) {
            broadcastToTopic(topic, {
                _error: true,
                _message: 'Service temporarily unavailable',
                _lastSuccess: state.lastSuccess?.toISOString(),
                _meta: {
                    healthy: false,
                    errorCount: state.consecutiveErrors,
                    lastError: error,
                }
            });
        }
    }

    /**
     * Apply exponential backoff to a failing poller.
     */
    private applyBackoff(topic: string): void {
        const state = this.activePollers.get(topic);
        if (!state) return;

        clearInterval(state.interval);

        // Exponential backoff: fixed 15s base * 2^(errors-2), capped at 3 minutes
        // Uses BACKOFF_BASE_MS instead of baseIntervalMs so all pollers share
        // the same retry curve regardless of their normal polling speed.
        const backoffInterval = Math.min(
            BACKOFF_BASE_MS * Math.pow(2, state.consecutiveErrors - 2),
            BACKOFF_MAX_MS
        );

        state.currentIntervalMs = backoffInterval;
        state.interval = setInterval(() => this.executePoll(topic), backoffInterval);
        // No logging here - already included in error message
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
