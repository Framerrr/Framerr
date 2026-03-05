/**
 * Error Policy
 * 
 * Error classification, fast retry, exponential backoff, and success handling
 * for the poller orchestrator. Functions receive poller state and broadcast
 * dependencies as parameters.
 * 
 * @module server/services/sse/errorPolicy
 */

import { broadcastToTopic, broadcastToTopicFiltered } from './transport';
import type { SubscriberFilterFn } from './transport';
import { metricHistoryService } from '../MetricHistoryService';
import {
    BACKOFF_MAX_MS,
    BACKOFF_BASE_MS,
    FAST_RETRY_INTERVAL_MS,
    FAST_RETRY_ATTEMPTS,
    getTopicFilter,
} from './topicPolicy';
import type { PollerState } from './topicPolicy';
import logger from '../../utils/logger';

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Config error patterns that should broadcast immediately without retries.
 * These are errors caused by missing/invalid config, not transient failures.
 */
const CONFIG_ERROR_PATTERNS = [
    'No URL configured',
    'URL and API key required',
    'URL and token required',
    'No instance found',
];

/**
 * Auth error patterns that should broadcast immediately without retries.
 * Bad credentials won't fix themselves — no point retrying for 30s.
 */
const AUTH_ERROR_PATTERNS = [
    'Authentication failed',
    'Request failed with status code 401',
    'Request failed with status code 403',
];

// ============================================================================
// TYPES
// ============================================================================

/** Callback type for executePoll, used in interval rescheduling. */
export type ExecutePollFn = (topic: string) => Promise<void>;

// ============================================================================
// SUCCESS HANDLING
// ============================================================================

/**
 * Handle successful poll - reset error state, exit fast retry mode, broadcast data.
 */
export function handlePollSuccess(
    topic: string,
    data: unknown,
    activePollers: Map<string, PollerState>,
    topicFilters: Map<string, SubscriberFilterFn>,
    executePoll: ExecutePollFn,
): void {
    const state = activePollers.get(topic);
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
        state.interval = setInterval(() => executePoll(topic), state.baseIntervalMs);
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
    const topicFilter = getTopicFilter(topic, topicFilters);
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

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle poll error - enter fast retry mode for quick error detection.
 * 
 * Strategy:
 * 1. Config errors: broadcast immediately, skip retries
 * 2. On first error: switch to 10s fast retry interval
 * 3. After 3 fast retries (30s): broadcast _error and start exponential backoff
 * 4. This ensures consistent ~30s error detection regardless of normal poll interval
 */
export function handlePollError(
    topic: string,
    error: string,
    activePollers: Map<string, PollerState>,
    executePoll: ExecutePollFn,
): void {
    const state = activePollers.get(topic);
    if (!state) return;

    // Config errors broadcast immediately — no retries, config won't fix itself
    const isConfigError = CONFIG_ERROR_PATTERNS
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
    const isAuthError = AUTH_ERROR_PATTERNS
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
        state.interval = setInterval(() => executePoll(topic), FAST_RETRY_INTERVAL_MS);
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
        applyBackoff(topic, activePollers, executePoll);
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

// ============================================================================
// BACKOFF
// ============================================================================

/**
 * Apply exponential backoff to a failing poller.
 */
export function applyBackoff(
    topic: string,
    activePollers: Map<string, PollerState>,
    executePoll: ExecutePollFn,
): void {
    const state = activePollers.get(topic);
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
    state.interval = setInterval(() => executePoll(topic), backoffInterval);
    // No logging here - already included in error message
}
