/**
 * Metric History — SSE Buffer Recording & Background Polling
 *
 * Handles SSE data buffering, periodic flush, and background
 * polling for integrations without active SSE subscribers.
 *
 * @module server/services/metricHistory/metricRecording
 */

import * as metricHistoryDb from '../../db/metricHistory';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { getPlugin } from '../../integrations/registry';
import type { MetricHistoryIntegrationConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';
import { RAW_RESOLUTION_MS, getSystemStatusTypes, getRecordableMetrics } from './types';
import type { MetricBuffer } from './types';

// ============================================================================
// SSE DATA BUFFERING
// ============================================================================

/**
 * Called from PollerOrchestrator.handleSuccess when a system-status poll completes.
 * Buffers metric values for periodic flush.
 * Uses plugin metric declarations instead of hardcoded map.
 */
export function handleSSEData(
    integrationId: string,
    type: string,
    data: Record<string, unknown>,
    buffers: Map<string, MetricBuffer>,
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): void {
    const recordableMetrics = getRecordableMetrics(type);
    if (recordableMetrics.length === 0) return;

    // Check per-integration mode
    const integrationConfig = getIntegrationConfig(integrationId);
    if (integrationConfig.mode === 'off') return;

    for (const metric of recordableMetrics) {
        const value = data[metric.key];
        // Skip null/undefined (sensor not available) and non-finite numbers
        if (value === null || value === undefined) continue;
        if (typeof value !== 'number' || !isFinite(value)) continue;

        const bufferKey = `${integrationId}:${metric.key}`;
        let buffer = buffers.get(bufferKey);
        if (!buffer) {
            buffer = { values: [], lastFlush: Date.now() };
            buffers.set(bufferKey, buffer);
        }
        buffer.values.push(value);
    }
}

// ============================================================================
// BUFFER FLUSH
// ============================================================================

/**
 * Flush all buffers — called every 15s.
 * Aggregates buffered values into a single data point per metric.
 */
export function flushAllBuffers(buffers: Map<string, MetricBuffer>): void {
    const now = Math.floor(Date.now() / 1000);

    for (const [bufferKey, buffer] of buffers.entries()) {
        if (buffer.values.length === 0) continue;

        const [integrationId, metricKey] = bufferKey.split(':');

        const avg = buffer.values.reduce((a, b) => a + b, 0) / buffer.values.length;
        const min = Math.min(...buffer.values);
        const max = Math.max(...buffer.values);

        // Round the timestamp to the nearest 15s boundary
        const alignedTs = now - (now % 15);

        if (buffer.values.length === 1) {
            // Single value — store as raw
            metricHistoryDb.insertRaw(integrationId, metricKey, alignedTs, buffer.values[0]);
        } else {
            // Multiple values — store as aggregated raw
            metricHistoryDb.insertAggregated(
                integrationId, metricKey, alignedTs, 'raw',
                min, avg, max, buffer.values.length
            );
        }

        // Reset buffer
        buffer.values = [];
        buffer.lastFlush = Date.now();
    }
}

/**
 * Flush buffers for a specific integration (on SSE idle).
 */
export function flushBuffersForIntegration(
    integrationId: string,
    buffers: Map<string, MetricBuffer>
): void {
    const now = Math.floor(Date.now() / 1000);

    for (const [bufferKey, buffer] of buffers.entries()) {
        if (!bufferKey.startsWith(`${integrationId}:`)) continue;
        if (buffer.values.length === 0) continue;

        const metricKey = bufferKey.split(':')[1];
        const avg = buffer.values.reduce((a, b) => a + b, 0) / buffer.values.length;
        const min = Math.min(...buffer.values);
        const max = Math.max(...buffer.values);
        const alignedTs = now - (now % 15);

        if (buffer.values.length === 1) {
            metricHistoryDb.insertRaw(integrationId, metricKey, alignedTs, buffer.values[0]);
        } else {
            metricHistoryDb.insertAggregated(
                integrationId, metricKey, alignedTs, 'raw',
                min, avg, max, buffer.values.length
            );
        }

        buffer.values = [];
        buffer.lastFlush = Date.now();
    }
}

// ============================================================================
// BACKGROUND POLLING
// ============================================================================

/**
 * Start background pollers for all system-status integrations
 * that don't currently have SSE subscribers.
 * Uses plugin registry instead of hardcoded type set.
 */
export function startAllBackgroundPollers(
    backgroundPollers: Map<string, NodeJS.Timeout>,
    sseActiveIntegrations: Set<string>,
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig,
    onSSEData: (integrationId: string, type: string, data: Record<string, unknown>) => void
): void {
    for (const type of getSystemStatusTypes()) {
        const instances = integrationInstancesDb.getInstancesByType(type);
        for (const instance of instances) {
            if (!instance.enabled) continue;
            if (sseActiveIntegrations.has(instance.id)) continue;

            startBackgroundPollerForIntegration(
                instance.id, type, backgroundPollers, sseActiveIntegrations,
                getIntegrationConfig, onSSEData
            );
        }
    }
}

/**
 * Start a background poller for a single integration.
 */
export function startBackgroundPollerForIntegration(
    integrationId: string,
    type: string | undefined,
    backgroundPollers: Map<string, NodeJS.Timeout>,
    sseActiveIntegrations: Set<string>,
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig,
    onSSEData: (integrationId: string, type: string, data: Record<string, unknown>) => void
): void {
    // Don't start if already running or SSE is active
    if (backgroundPollers.has(integrationId)) return;
    if (sseActiveIntegrations.has(integrationId)) return;

    // Check per-integration mode
    const integrationConfig = getIntegrationConfig(integrationId);
    if (integrationConfig.mode === 'off') return;

    // Resolve integration type if not provided
    const instance = integrationInstancesDb.getInstanceById(integrationId);
    const resolvedType = type ?? instance?.type ?? null;
    if (!resolvedType) return;

    const timer = setInterval(
        () => backgroundPoll(integrationId, resolvedType, onSSEData),
        RAW_RESOLUTION_MS
    );

    backgroundPollers.set(integrationId, timer);

    // Immediate first poll
    backgroundPoll(integrationId, resolvedType, onSSEData);
}

/**
 * Background poll for a single integration.
 * Fetches data directly using the plugin poller and records it.
 */
async function backgroundPoll(
    integrationId: string,
    type: string,
    onSSEData: (integrationId: string, type: string, data: Record<string, unknown>) => void
): Promise<void> {
    try {
        const plugin = getPlugin(type);
        if (!plugin?.poller) return;

        const instance = integrationInstancesDb.getInstanceById(integrationId);
        if (!instance || !instance.enabled) {
            return;
        }

        const pluginInstance = {
            id: instance.id,
            type: instance.type,
            name: instance.displayName,
            config: instance.config,
        };

        const data = await plugin.poller.poll(pluginInstance, plugin.adapter);
        if (data && typeof data === 'object') {
            onSSEData(integrationId, type, data as Record<string, unknown>);
        }
    } catch (error) {
        logger.debug(`[MetricHistory] Background poll failed for ${integrationId.slice(0, 8)}: ${(error as Error).message}`);
    }
}
