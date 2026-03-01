/**
 * Metric History Service
 *
 * Core recording engine for system status metric history.
 * Handles two modes of data capture:
 * 1. SSE buffer mode: When PollerOrchestrator is active, buffer ticks and flush every 15s
 * 2. Background mode: When no SSE subscribers, poll system-status integrations directly at 15s
 *
 * Also manages tiered aggregation (raw → 1min → 5min) and retention cleanup.
 *
 * Gated behind the global experimental toggle (metricHistory.enabled in system_config).
 *
 * @module server/services/MetricHistoryService
 */

import * as metricHistoryDb from '../db/metricHistory';
import * as metricHistorySourcesDb from '../db/metricHistorySources';
import { getSystemConfig, getMetricHistoryDefaults, type MetricHistoryConfig, type MetricHistoryIntegrationConfig, type MetricHistoryDefaultsConfig } from '../db/systemConfig';
import * as integrationInstancesDb from '../db/integrationInstances';
import { getPlugin } from '../integrations/registry';
import { plugins } from '../integrations/registry';
import type { MetricDefinition } from '../integrations/types';
import { registerJob, unregisterJob } from './jobScheduler';
import logger from '../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Resolution for raw data points: 15 seconds */
const RAW_RESOLUTION_MS = 15_000;

/** Default retention in days if not configured per-integration */
const DEFAULT_RETENTION_DAYS = 3;

/** Maximum retention allowed */
const MAX_RETENTION_DAYS = 30;

/**
 * Get the set of system-status integration type IDs from plugins that declare metrics.
 * Replaces the old hardcoded SYSTEM_STATUS_TYPES set.
 */
function getSystemStatusTypes(): Set<string> {
    const types = new Set<string>();
    for (const p of plugins) {
        if (p.metrics && p.metrics.length > 0) {
            types.add(p.id);
        }
    }
    return types;
}

/**
 * Get recordable metric keys for a given integration type from the plugin declaration.
 * Replaces the old hardcoded METRIC_KEYS_BY_TYPE map.
 */
function getRecordableMetrics(type: string): MetricDefinition[] {
    const plugin = getPlugin(type);
    if (!plugin?.metrics) return [];
    return plugin.metrics.filter(m => m.recordable);
}

// ============================================================================
// TYPES
// ============================================================================

interface MetricBuffer {
    values: number[];
    lastFlush: number;
}

interface HistoryDataPoint {
    t: number;
    v?: number;
    avg?: number;
    min?: number;
    max?: number;
}

export interface HistoryResponse {
    data: HistoryDataPoint[];
    availableRange: string;
    resolution: string;
    source: 'internal' | 'external';
}

// ============================================================================
// METRIC HISTORY SERVICE CLASS
// ============================================================================

class MetricHistoryService {
    /** Buffers for SSE data: key = `${integrationId}:${metricKey}` */
    private buffers: Map<string, MetricBuffer> = new Map();

    /** Background pollers for when no SSE subscribers are active */
    private backgroundPollers: Map<string, NodeJS.Timeout> = new Map();

    /** Integrations that currently have SSE subscribers active */
    private sseActiveIntegrations: Set<string> = new Set();

    /** Timer for periodic buffer flush */
    private flushTimer: NodeJS.Timeout | null = null;

    // Cron job IDs (registered with jobScheduler)
    private static readonly AGGREGATION_JOB_ID = 'metric-history-aggregation';
    private static readonly REPROBE_JOB_ID = 'metric-history-reprobe';

    /** Whether the service is currently enabled and recording */
    private enabled = false;

    /** Cached metric history config */
    private config: MetricHistoryConfig | null = null;

    /** Cached global defaults for new integrations */
    private globalDefaults: MetricHistoryDefaultsConfig = { mode: 'auto', retentionDays: DEFAULT_RETENTION_DAYS };

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    /**
     * Initialize the service. Reads config and starts recording if enabled.
     * Called on server startup after DB migrations.
     */
    async initialize(): Promise<void> {
        try {
            const systemConfig = await getSystemConfig();
            this.config = systemConfig.metricHistory ?? { enabled: false };
            this.globalDefaults = await getMetricHistoryDefaults();

            if (this.config.enabled) {
                await this.enable();
            } else {
                // Even when disabled, register retention cleanup so old data gets pruned
                registerJob({
                    id: MetricHistoryService.AGGREGATION_JOB_ID,
                    name: 'Metric History Cleanup',
                    cronExpression: '0 * * * *',
                    description: 'Every hour',
                    execute: () => this.runRetentionCleanup(),
                });
                logger.info('[MetricHistory] Initialized (disabled, retention cleanup active)');
            }
        } catch (error) {
            logger.error(`[MetricHistory] Failed to initialize: ${(error as Error).message}`);
        }
    }

    /**
     * Shutdown the service. Stop all recording and clean up timers.
     */
    async shutdown(): Promise<void> {
        this.stopAllTimers();
        unregisterJob(MetricHistoryService.AGGREGATION_JOB_ID);
        unregisterJob(MetricHistoryService.REPROBE_JOB_ID);
        this.buffers.clear();
        this.sseActiveIntegrations.clear();
        this.enabled = false;
        logger.info('[MetricHistory] Shut down');
    }

    /**
     * Enable recording. Called when toggle turns ON.
     */
    async enable(): Promise<void> {
        if (this.enabled) return;

        this.enabled = true;
        await this.refreshConfig();

        // Initialize source records for existing integrations
        await this.initializeSources();

        // Start flush timer (15s)
        this.flushTimer = setInterval(() => this.flushBuffers(), RAW_RESOLUTION_MS);

        // Register aggregation + retention cron job (every hour)
        registerJob({
            id: MetricHistoryService.AGGREGATION_JOB_ID,
            name: 'Metric History Aggregation',
            cronExpression: '0 * * * *',
            description: 'Every hour',
            execute: () => this.runAggregation(),
        });

        // Register source re-probe cron job (every 6 hours)
        registerJob({
            id: MetricHistoryService.REPROBE_JOB_ID,
            name: 'Metric History Source Probe',
            cronExpression: '0 */6 * * *',
            description: 'Every 6 hours',
            execute: () => this.reprobeAll(),
        });

        // Start background pollers for integrations without SSE subscribers
        this.startBackgroundPollers();

        logger.info('[MetricHistory] Recording started');
    }

    /**
     * Disable recording. Stops all recording and pollers but preserves data.
     * Aggregation/retention cron job stays registered so stale data is still cleaned up.
     * Re-probe job is unregistered since we're not recording.
     */
    async disable(): Promise<void> {
        this.stopAllTimers();
        this.buffers.clear();
        this.sseActiveIntegrations.clear();
        this.enabled = false;

        // Unregister reprobe job (not needed when disabled)
        unregisterJob(MetricHistoryService.REPROBE_JOB_ID);

        // Re-register aggregation job as retention-only (keeps cleaning up old data)
        registerJob({
            id: MetricHistoryService.AGGREGATION_JOB_ID,
            name: 'Metric History Cleanup',
            cronExpression: '0 * * * *',
            description: 'Every hour',
            execute: () => this.runRetentionCleanup(),
        });

        logger.info('[MetricHistory] Recording stopped (data preserved, pruning continues)');
    }

    /**
     * Check if the service is currently enabled.
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Check if a given integration type is a system-status type.
     * Uses plugin metric declarations instead of a hardcoded set.
     */
    static isSystemStatusType(type: string): boolean {
        return getSystemStatusTypes().has(type);
    }

    // ========================================================================
    // SSE INTEGRATION (called from PollerOrchestrator)
    // ========================================================================

    /**
     * Called from PollerOrchestrator.handleSuccess when a system-status poll completes.
     * Buffers metric values for periodic flush.
     * Uses plugin metric declarations instead of hardcoded map.
     */
    onSSEData(integrationId: string, type: string, data: Record<string, unknown>): void {
        if (!this.enabled) return;

        const recordableMetrics = getRecordableMetrics(type);
        if (recordableMetrics.length === 0) return;

        // Check per-integration mode
        const integrationConfig = this.getIntegrationConfig(integrationId);
        if (integrationConfig.mode === 'off') return;

        for (const metric of recordableMetrics) {
            const value = data[metric.key];
            // Skip null/undefined (sensor not available) and non-finite numbers
            if (value === null || value === undefined) continue;
            if (typeof value !== 'number' || !isFinite(value)) continue;

            const bufferKey = `${integrationId}:${metric.key}`;
            let buffer = this.buffers.get(bufferKey);
            if (!buffer) {
                buffer = { values: [], lastFlush: Date.now() };
                this.buffers.set(bufferKey, buffer);
            }
            buffer.values.push(value);
        }
    }

    /**
     * Called when an SSE subscriber joins for a system-status topic.
     * Switches from background polling to SSE buffer mode.
     */
    onSSEActive(integrationId: string): void {
        if (!this.enabled) return;

        this.sseActiveIntegrations.add(integrationId);

        // Stop background poller for this integration (SSE handles it now)
        const bgTimer = this.backgroundPollers.get(integrationId);
        if (bgTimer) {
            clearInterval(bgTimer);
            this.backgroundPollers.delete(integrationId);
            logger.debug(`[MetricHistory] SSE active for ${integrationId.slice(0, 8)}, stopped background poller`);
        }
    }

    /**
     * Called when the last SSE subscriber leaves for a system-status topic.
     * Switches from SSE buffer mode back to background polling.
     */
    onSSEIdle(integrationId: string): void {
        if (!this.enabled) return;

        this.sseActiveIntegrations.delete(integrationId);

        // Flush remaining buffer for this integration
        this.flushForIntegration(integrationId);

        // Start background poller
        this.startBackgroundPollerForIntegration(integrationId);
        logger.debug(`[MetricHistory] SSE idle for ${integrationId.slice(0, 8)}, started background poller`);
    }

    // ========================================================================
    // QUERY
    // ========================================================================

    /**
     * Get history data for a specific integration and metric.
     * Checks per-integration mode and source resolution:
     * - If mode is 'off', returns empty data
     * - If source is 'external', proxies to integration's history endpoint
     * - Otherwise returns internal recorded data with resolution fallback
     */
    async getHistory(
        integrationId: string,
        metricKey: string,
        range: string
    ): Promise<HistoryResponse> {
        // Check per-integration mode
        const integrationConfig = this.getIntegrationConfig(integrationId);
        if (integrationConfig.mode === 'off') {
            return { data: [], availableRange: '0d', resolution: 'raw', source: 'internal' };
        }

        // Check source resolution for this metric
        const sourceRecord = metricHistorySourcesDb.getForMetric(integrationId, metricKey);

        // If mode is external-only and source failed/unavailable, return empty
        if (integrationConfig.mode === 'external' && sourceRecord?.source !== 'external') {
            return { data: [], availableRange: '0d', resolution: 'raw', source: 'internal' };
        }

        // If source is external (in auto or external mode), proxy to integration
        if (sourceRecord?.source === 'external' && integrationConfig.mode !== 'internal') {
            return this.fetchExternalHistory(integrationId, metricKey, range);
        }

        // Internal data path
        const { resolution, durationMs } = this.resolveRangeParams(range);

        const now = Date.now();
        const startTs = Math.floor((now - durationMs) / 1000);
        const endTs = Math.floor(now / 1000);

        // Try requested resolution first
        let rows = metricHistoryDb.query(integrationId, metricKey, resolution, startTs, endTs);
        let effectiveResolution = resolution;

        // Resolution fallback: if no data at requested tier, try finer resolutions
        if (rows.length === 0 && resolution !== 'raw') {
            const fallbackOrder = ['1min', 'raw'];
            for (const fallback of fallbackOrder) {
                if (fallback === resolution) continue;
                rows = metricHistoryDb.query(integrationId, metricKey, fallback, startTs, endTs);
                if (rows.length > 0) {
                    effectiveResolution = fallback;
                    logger.debug(`[MetricHistory] Resolution fallback: ${resolution} → ${fallback} for ${metricKey}`);
                    break;
                }
            }
        }

        const data: HistoryDataPoint[] = rows.map(row => {
            // Determine if this is a single-value or aggregated row by checking
            // which columns are populated (not by resolution, since flushBuffers
            // writes aggregated data with resolution='raw')
            if (row.value_avg != null) {
                return {
                    t: row.timestamp * 1000,
                    avg: row.value_avg,
                    min: row.value_min ?? row.value_avg,
                    max: row.value_max ?? row.value_avg,
                };
            }
            return { t: row.timestamp * 1000, v: row.value ?? 0 };
        });

        const retentionDays = integrationConfig.retentionDays;
        const availableRange = `${retentionDays}d`;

        return {
            data,
            availableRange,
            resolution: effectiveResolution,
            source: 'internal',
        };
    }

    // ========================================================================
    // BUFFER FLUSH
    // ========================================================================

    /**
     * Flush all buffers — called every 15s.
     * Aggregates buffered values into a single data point per metric.
     */
    private flushBuffers(): void {
        const now = Math.floor(Date.now() / 1000);

        for (const [bufferKey, buffer] of this.buffers.entries()) {
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
    private flushForIntegration(integrationId: string): void {
        const now = Math.floor(Date.now() / 1000);

        for (const [bufferKey, buffer] of this.buffers.entries()) {
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

    // ========================================================================
    // BACKGROUND POLLING
    // ========================================================================

    /**
     * Start background pollers for all system-status integrations
     * that don't currently have SSE subscribers.
     * Uses plugin registry instead of hardcoded type set.
     */
    private startBackgroundPollers(): void {
        for (const type of getSystemStatusTypes()) {
            const instances = integrationInstancesDb.getInstancesByType(type);
            for (const instance of instances) {
                if (!instance.enabled) continue;
                if (this.sseActiveIntegrations.has(instance.id)) continue;

                this.startBackgroundPollerForIntegration(instance.id, type);
            }
        }
    }

    /**
     * Start a background poller for a single integration.
     */
    private startBackgroundPollerForIntegration(integrationId: string, type?: string): void {
        // Don't start if already running or SSE is active
        if (this.backgroundPollers.has(integrationId)) return;
        if (this.sseActiveIntegrations.has(integrationId)) return;

        // Check per-integration mode
        const integrationConfig = this.getIntegrationConfig(integrationId);
        if (integrationConfig.mode === 'off') return;

        // Resolve integration type if not provided
        const resolvedType = type ?? this.resolveIntegrationType(integrationId);
        if (!resolvedType) return;

        const timer = setInterval(
            () => this.backgroundPoll(integrationId, resolvedType),
            RAW_RESOLUTION_MS
        );

        this.backgroundPollers.set(integrationId, timer);

        // Immediate first poll
        this.backgroundPoll(integrationId, resolvedType);
    }

    /**
     * Background poll for a single integration.
     * Fetches data directly using the plugin poller and records it.
     */
    private async backgroundPoll(integrationId: string, type: string): Promise<void> {
        try {
            const plugin = getPlugin(type);
            if (!plugin?.poller) return;

            const instance = integrationInstancesDb.getInstanceById(integrationId);
            if (!instance || !instance.enabled) {
                // Instance was deleted or disabled — stop polling
                const timer = this.backgroundPollers.get(integrationId);
                if (timer) {
                    clearInterval(timer);
                    this.backgroundPollers.delete(integrationId);
                }
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
                this.onSSEData(integrationId, type, data as Record<string, unknown>);
            }
        } catch (error) {
            logger.debug(`[MetricHistory] Background poll failed for ${integrationId.slice(0, 8)}: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // AGGREGATION
    // ========================================================================

    /**
     * Run the aggregation job.
     * Compacts raw → 1min, 1min → 5min.
     * Then runs retention cleanup.
     */
    private async runAggregation(): Promise<void> {
        try {
            const now = Math.floor(Date.now() / 1000);

            // Compact raw data older than 2 minutes into 1-minute buckets
            await this.compactTier('raw', '1min', now - 120, 60);

            // Compact 1-minute data older than 10 minutes into 5-minute buckets
            await this.compactTier('1min', '5min', now - 600, 300);

            // Run retention cleanup
            await this.runRetentionCleanup();

            logger.debug('[MetricHistory] Aggregation complete');
        } catch (error) {
            logger.error(`[MetricHistory] Aggregation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Compact data from one resolution tier to the next.
     */
    private async compactTier(
        fromResolution: string,
        toResolution: string,
        olderThan: number,
        bucketSeconds: number
    ): Promise<void> {
        const rows = metricHistoryDb.getRawForAggregation(fromResolution, olderThan);
        if (rows.length === 0) return;

        // Group by integration + metric + time bucket
        const buckets = new Map<string, number[]>();

        for (const row of rows) {
            const bucketTs = Math.floor(row.timestamp / bucketSeconds) * bucketSeconds;
            const key = `${row.integration_id}:${row.metric_key}:${bucketTs}`;

            let values = buckets.get(key);
            if (!values) {
                values = [];
                buckets.set(key, values);
            }

            // Use the best available value
            const val = row.value ?? row.value_avg;
            if (val !== null && val !== undefined) {
                values.push(val);
            }
        }

        // Insert aggregated rows
        for (const [key, values] of buckets.entries()) {
            if (values.length === 0) continue;

            const [integrationId, metricKey, bucketTsStr] = key.split(':');
            const bucketTs = parseInt(bucketTsStr, 10);

            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            metricHistoryDb.insertAggregated(
                integrationId, metricKey, bucketTs, toResolution,
                min, avg, max, values.length
            );
        }

        // Delete the source rows
        metricHistoryDb.deleteByResolutionOlderThan(fromResolution, olderThan);
    }

    /**
     * Run retention cleanup — delete data older than per-integration retention.
     */
    private async runRetentionCleanup(): Promise<void> {
        const stats = metricHistoryDb.getStorageStats();

        for (const integration of stats.integrations) {
            const config = this.getIntegrationConfig(integration.integrationId);
            const retentionSeconds = config.retentionDays * 24 * 60 * 60;
            const cutoff = Math.floor(Date.now() / 1000) - retentionSeconds;

            const deleted = metricHistoryDb.deleteOlderThan(integration.integrationId, cutoff);
            if (deleted > 0) {
                logger.debug(
                    `[MetricHistory] Retention cleanup: deleted ${deleted} rows for ${integration.integrationId.slice(0, 8)}`
                );
            }
        }
    }

    // ========================================================================
    // SOURCE INITIALIZATION & PROBING
    // ========================================================================

    /**
     * Initialize source records for all existing system-status integrations.
     * Called when the feature is first enabled.
     * Seeds pending entries and triggers probing.
     */
    private async initializeSources(): Promise<void> {
        for (const type of getSystemStatusTypes()) {
            const instances = integrationInstancesDb.getInstancesByType(type);
            for (const instance of instances) {
                if (!instance.enabled) continue;

                const integrationConfig = this.getIntegrationConfig(instance.id);
                if (integrationConfig.mode === 'off') continue;

                await this.probeIntegration(instance.id, type);
            }
        }
    }

    /**
     * Probe an integration's metrics for external history availability.
     * For each recordable metric with a historyProbe config, attempts to
     * fetch from the external endpoint. Updates metric_history_sources.
     *
     * Called on: feature enable, integration save/edit, daily re-probe.
     */
    async probeIntegration(integrationId: string, type?: string): Promise<void> {
        const resolvedType = type ?? this.resolveIntegrationType(integrationId);
        if (!resolvedType) return;

        const recordableMetrics = getRecordableMetrics(resolvedType);
        if (recordableMetrics.length === 0) return;

        const instance = integrationInstancesDb.getInstanceById(integrationId);
        if (!instance) return;

        const plugin = getPlugin(resolvedType);
        if (!plugin) return;

        logger.debug(`[MetricHistory] Probing ${recordableMetrics.length} metrics for ${integrationId.slice(0, 8)} (${resolvedType})`);

        for (const metric of recordableMetrics) {
            if (!metric.historyProbe) {
                // No external history endpoint — always internal
                metricHistorySourcesDb.upsert(integrationId, metric.key, 'internal', null);
                continue;
            }

            // Try to probe the external history endpoint
            try {
                const pluginInstance = {
                    id: instance.id,
                    type: instance.type,
                    name: instance.displayName,
                    config: instance.config,
                };

                const response = await plugin.adapter.get!(pluginInstance, metric.historyProbe.path, {
                    params: metric.historyProbe.params,
                    timeout: 10000,
                });

                // Probe succeeded if we got data back
                if (response.status === 200 && response.data) {
                    metricHistorySourcesDb.upsert(integrationId, metric.key, 'external', 'success');
                    logger.debug(`[MetricHistory] Probe: ${metric.key} on ${integrationId.slice(0, 8)} → external`);
                } else {
                    metricHistorySourcesDb.upsert(integrationId, metric.key, 'internal', 'failed');
                    logger.debug(`[MetricHistory] Probe: ${metric.key} on ${integrationId.slice(0, 8)} → internal (no data)`);
                }
            } catch {
                // Probe failed — fall back to internal recording
                metricHistorySourcesDb.upsert(integrationId, metric.key, 'internal', 'failed');
                logger.debug(`[MetricHistory] Probe: ${metric.key} on ${integrationId.slice(0, 8)} → internal (probe failed)`);
            }
        }

        // Prune stale source records for metrics no longer declared by the plugin
        const validKeys = new Set(recordableMetrics.map(m => m.key));
        const existing = metricHistorySourcesDb.getForIntegration(integrationId);
        for (const record of existing) {
            if (!validKeys.has(record.metric_key)) {
                metricHistorySourcesDb.deleteForMetric(integrationId, record.metric_key);
                logger.debug(`[MetricHistory] Pruned stale source record: ${record.metric_key} for ${integrationId.slice(0, 8)}`);
            }
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Delete all metric history data and source records.
     */
    async clearAll(): Promise<void> {
        metricHistoryDb.deleteAll();
        metricHistorySourcesDb.deleteAll();
    }

    // ========================================================================
    // RE-PROBE SCHEDULER
    // ========================================================================

    /**
     * Re-probe all integrations in auto/external mode.
     * Called by the cron job scheduler (every 6h when enabled).
     */
    private async reprobeAll(): Promise<void> {
        try {
            for (const type of getSystemStatusTypes()) {
                const instances = integrationInstancesDb.getInstancesByType(type);
                for (const instance of instances) {
                    if (!instance.enabled) continue;
                    const config = this.getIntegrationConfig(instance.id);
                    // Only re-probe for auto and external modes
                    if (config.mode === 'off' || config.mode === 'internal') continue;
                    await this.probeIntegration(instance.id, type);
                }
            }
            logger.info('[MetricHistory] Re-probe cycle complete');
        } catch (error) {
            logger.error(`[MetricHistory] Re-probe failed: ${(error as Error).message}`);
        }
    }

    /**
     * Called when an integration is saved/edited.
     * Re-probes to check for external history availability changes.
     */
    async onIntegrationSaved(integrationId: string): Promise<void> {
        if (!this.enabled) return;

        const type = this.resolveIntegrationType(integrationId);
        if (!type) return;

        const config = this.getIntegrationConfig(integrationId);

        // Always prune stale source records (regardless of mode)
        const recordableMetrics = getRecordableMetrics(type);
        if (recordableMetrics.length > 0) {
            const validKeys = new Set(recordableMetrics.map(m => m.key));
            const existing = metricHistorySourcesDb.getForIntegration(integrationId);
            for (const record of existing) {
                if (!validKeys.has(record.metric_key)) {
                    metricHistorySourcesDb.deleteForMetric(integrationId, record.metric_key);
                    logger.debug(`[MetricHistory] Pruned stale source record: ${record.metric_key} for ${integrationId.slice(0, 8)}`);
                }
            }
        }

        // Only probe external sources if mode is auto or external
        if (config.mode === 'off' || config.mode === 'internal') return;
        await this.probeIntegration(integrationId, type);
        logger.debug(`[MetricHistory] Re-probed ${integrationId.slice(0, 8)} after save`);
    }

    /**
     * Fetch history data from an external source (integration's history endpoint).
     * Normalizes the response to match the standard HistoryResponse format.
     */
    private async fetchExternalHistory(
        integrationId: string,
        metricKey: string,
        range: string
    ): Promise<HistoryResponse> {
        const instance = integrationInstancesDb.getInstanceById(integrationId);
        if (!instance) {
            return { data: [], availableRange: '0d', resolution: 'raw', source: 'external' };
        }

        const plugin = getPlugin(instance.type);
        if (!plugin) {
            return { data: [], availableRange: '0d', resolution: 'raw', source: 'external' };
        }

        try {
            const pluginInstance = {
                id: instance.id,
                type: instance.type,
                name: instance.displayName,
                config: instance.config,
            };

            // Find the metric's historyProbe config for the endpoint path
            const recordableMetrics = getRecordableMetrics(instance.type);
            const metric = recordableMetrics.find(m => m.key === metricKey);
            if (!metric?.historyProbe) {
                return { data: [], availableRange: '0d', resolution: 'raw', source: 'external' };
            }

            const response = await plugin.adapter.get!(pluginInstance, metric.historyProbe.path, {
                params: { ...metric.historyProbe.params, range },
                timeout: 15000,
            });

            if (response.status !== 200 || !response.data) {
                return { data: [], availableRange: range, resolution: 'raw', source: 'external' };
            }

            // Normalize external response to HistoryDataPoint[]
            const rawData = response.data;
            const data: HistoryDataPoint[] = Array.isArray(rawData.data)
                ? rawData.data.map((point: Record<string, unknown>) => ({
                    t: typeof point.t === 'number' ? point.t : Date.now(),
                    v: typeof point.v === 'number' ? point.v : undefined,
                    avg: typeof point.avg === 'number' ? point.avg : undefined,
                    min: typeof point.min === 'number' ? point.min : undefined,
                    max: typeof point.max === 'number' ? point.max : undefined,
                }))
                : [];

            return {
                data,
                availableRange: rawData.availableRange ?? range,
                resolution: rawData.resolution ?? 'raw',
                source: 'external',
            };
        } catch (error) {
            logger.warn(`[MetricHistory] External fetch failed for ${metricKey} on ${integrationId.slice(0, 8)}: ${(error as Error).message}`);
            return { data: [], availableRange: '0d', resolution: 'raw', source: 'external' };
        }
    }

    /**
     * Delete metric history and source records for a specific integration.
     * Called when an integration is deleted.
     */
    async clearForIntegration(integrationId: string): Promise<void> {
        metricHistoryDb.deleteForIntegration(integrationId);
        metricHistorySourcesDb.deleteForIntegration(integrationId);

        // Stop background poller if running
        const bgTimer = this.backgroundPollers.get(integrationId);
        if (bgTimer) {
            clearInterval(bgTimer);
            this.backgroundPollers.delete(integrationId);
        }
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Get per-integration metric history config, falling back to defaults.
     * Public so routes can query config for individual integrations.
     */
    getIntegrationConfig(integrationId: string): MetricHistoryIntegrationConfig {
        const perIntegration = this.config?.integrations?.[integrationId];
        return perIntegration ?? {
            mode: this.globalDefaults.mode,
            retentionDays: this.globalDefaults.retentionDays,
        };
    }

    /**
     * Update per-integration config and refresh internal state.
     */
    async updateIntegrationConfig(
        integrationId: string,
        config: MetricHistoryIntegrationConfig
    ): Promise<void> {
        const systemConfig = await getSystemConfig();
        const metricHistory = systemConfig.metricHistory ?? { enabled: false };
        const integrations = metricHistory.integrations ?? {};
        integrations[integrationId] = config;
        metricHistory.integrations = integrations;

        const { updateSystemConfig } = await import('../db/systemConfig');
        await updateSystemConfig({ metricHistory });

        await this.refreshConfig();

        // Handle mode changes: restart/stop poller for this integration
        if (config.mode === 'off') {
            // Stop poller if running
            const existing = this.backgroundPollers.get(integrationId);
            if (existing) {
                clearInterval(existing);
                this.backgroundPollers.delete(integrationId);
            }
        } else if (this.enabled) {
            // Ensure poller is running (if not SSE-active)
            if (!this.backgroundPollers.has(integrationId) && !this.sseActiveIntegrations.has(integrationId)) {
                this.startBackgroundPollerForIntegration(integrationId);
            }
        }

        logger.info(`[MetricHistory] Updated config for ${integrationId.slice(0, 8)}: mode=${config.mode}, retention=${config.retentionDays}d`);
    }

    /**
     * Resolve integration type from ID by looking it up in the DB.
     */
    private resolveIntegrationType(integrationId: string): string | null {
        const instance = integrationInstancesDb.getInstanceById(integrationId);
        return instance?.type ?? null;
    }

    /**
     * Resolve range string to resolution and duration.
     * Per spec:
     * - 5m, 15m, 30m, 1h → raw (15s)
     * - 3h, 6h → 1min
     * - 12h, 1d, 3d, 7d, 30d → 5min
     */
    private resolveRangeParams(range: string): { resolution: string; durationMs: number } {
        const rangeMap: Record<string, { resolution: string; durationMs: number }> = {
            '5m': { resolution: 'raw', durationMs: 5 * 60 * 1000 },
            '15m': { resolution: 'raw', durationMs: 15 * 60 * 1000 },
            '30m': { resolution: 'raw', durationMs: 30 * 60 * 1000 },
            '1h': { resolution: 'raw', durationMs: 60 * 60 * 1000 },
            '3h': { resolution: '1min', durationMs: 3 * 60 * 60 * 1000 },
            '6h': { resolution: '1min', durationMs: 6 * 60 * 60 * 1000 },
            '12h': { resolution: '5min', durationMs: 12 * 60 * 60 * 1000 },
            '1d': { resolution: '5min', durationMs: 24 * 60 * 60 * 1000 },
            '3d': { resolution: '5min', durationMs: 3 * 24 * 60 * 60 * 1000 },
            '7d': { resolution: '5min', durationMs: 7 * 24 * 60 * 60 * 1000 },
            '30d': { resolution: '5min', durationMs: 30 * 24 * 60 * 60 * 1000 },
        };

        return rangeMap[range] ?? rangeMap['1h'];
    }

    /**
     * Refresh config from database.
     */
    private async refreshConfig(): Promise<void> {
        const systemConfig = await getSystemConfig();
        this.config = systemConfig.metricHistory ?? { enabled: false };
        this.globalDefaults = await getMetricHistoryDefaults();
    }

    /**
     * Refresh cached global defaults. Called when defaults are updated via settings.
     */
    async refreshGlobalDefaults(): Promise<void> {
        this.globalDefaults = await getMetricHistoryDefaults();
    }

    /**
     * Stop flush timer and background pollers.
     * Cron jobs (aggregation, reprobe) are managed separately via registerJob/unregisterJob.
     */
    private stopAllTimers(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        for (const [, timer] of this.backgroundPollers) {
            clearInterval(timer);
        }
        this.backgroundPollers.clear();
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const metricHistoryService = new MetricHistoryService();
