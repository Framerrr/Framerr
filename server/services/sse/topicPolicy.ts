/**
 * Topic Policy
 * 
 * Constants, types, and utility functions for SSE topic parsing and polling intervals.
 * Extracted from PollerOrchestrator for single-responsibility separation.
 * 
 * @module server/services/sse/topicPolicy
 */

import { getPlugin } from '../../integrations/registry';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Polling intervals by integration type (in milliseconds).
 * Queue subtypes get faster polling for near real-time download progress.
 */
export const POLLING_INTERVALS: Record<string, number> = {
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
export const BACKOFF_MAX_MS = 3 * 60 * 1000;

/** Fixed base interval for exponential backoff (standardized across all pollers) */
export const BACKOFF_BASE_MS = 15_000;

/** Fast retry interval: 10 seconds for quick error detection */
export const FAST_RETRY_INTERVAL_MS = 10_000;

/** Number of fast retries before error broadcast */
export const FAST_RETRY_ATTEMPTS = 3;

// ============================================================================
// TYPES
// ============================================================================

/** Parsed topic info from a topic string. */
export interface TopicInfo {
    type: string;
    instanceId: string | null;
    subtype?: string;
}

/**
 * State tracking for each active poller.
 */
export interface PollerState {
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
    topicInfo: TopicInfo;
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
// UTILITY FUNCTIONS
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
export function parseTopic(topic: string): TopicInfo {
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

/**
 * Get filter for a topic from the topic filters map, if any registered prefix matches.
 */
export function getTopicFilter<T>(
    topic: string,
    topicFilters: Map<string, T>
): T | null {
    for (const [prefix, filterFn] of topicFilters) {
        if (topic.startsWith(prefix)) {
            return filterFn;
        }
    }
    return null;
}
