/**
 * Metric History Service — Orchestrator
 *
 * Core recording engine for system status metric history.
 * Acts as a thin facade that delegates to focused sub-modules:
 * - metricRecording: SSE buffering and background polling
 * - metricAggregation: tiered compaction and retention
 * - metricQuery: history reads and external proxy
 * - metricProbing: source detection and probing
 * - metricConfig: per-integration config management
 *
 * Retains ownership of all mutable state (buffers, pollers, timers, config).
 *
 * @module server/services/MetricHistoryService
 */

import { getSystemConfig, getMetricHistoryDefaults, type MetricHistoryConfig, type MetricHistoryIntegrationConfig, type MetricHistoryDefaultsConfig } from '../db/systemConfig';
import { registerJob, unregisterJob } from './jobScheduler';
import { yieldToEventLoop } from '../utils/eventLoopYield';
import logger from '../utils/logger';

// Sub-module imports
import { getSystemStatusTypes } from './metricHistory/types';
import type { MetricBuffer, HistoryResponse } from './metricHistory/types';
import { handleSSEData, flushAllBuffers, flushBuffersForIntegration, startAllBackgroundPollers, startBackgroundPollerForIntegration } from './metricHistory/metricRecording';
import { runAggregation, runRetentionCleanup } from './metricHistory/metricAggregation';
import { queryHistory } from './metricHistory/metricQuery';
import { initializeSources, probeIntegrationMetrics, reprobeAll, handleIntegrationSaved } from './metricHistory/metricProbing';
import { resolveIntegrationConfig, applyIntegrationConfig, clearIntegrationData, clearAllData } from './metricHistory/metricConfig';

// Re-exports for consumers
export type { HistoryResponse } from './metricHistory/types';

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

    /** Whether the feature is currently enabled */
    private enabled = false;

    /** Cached system config for metric history */
    private config: MetricHistoryConfig | null = null;

    /** Cached global defaults */
    private globalDefaults: MetricHistoryDefaultsConfig = {
        mode: 'auto',
        retentionDays: 3,
    };

    /** Job IDs for scheduler */
    private static readonly AGGREGATION_JOB_ID = 'metricHistory:aggregation';
    private static readonly REPROBE_JOB_ID = 'metricHistory:reprobe';

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    /**
     * Initialize the service: check if enabled and set up recording.
     * Called during server startup via IntegrationManager.
     */
    async initialize(): Promise<void> {
        await this.refreshConfig();

        if (!this.config?.enabled) {
            logger.info('[MetricHistory] Disabled by config');
            return;
        }

        await this.enable();
        logger.info('[MetricHistory] Service initialized and enabled');
    }

    /**
     * Shut down the service and clean up resources.
     */
    async shutdown(): Promise<void> {
        this.stopAllTimers();
        this.sseActiveIntegrations.clear();
        this.buffers.clear();

        if (this.enabled) {
            unregisterJob(MetricHistoryService.AGGREGATION_JOB_ID);
            unregisterJob(MetricHistoryService.REPROBE_JOB_ID);
        }

        this.enabled = false;
        logger.info('[MetricHistory] Service shut down');
    }

    /**
     * Enable the service: start recording, set up aggregation cron.
     * Called on initialize() and when toggled on via settings.
     */
    async enable(): Promise<void> {
        if (this.enabled) return;
        this.enabled = true;

        await this.refreshConfig();

        // Initialize source records (probe external availability)
        const boundGetConfig = (id: string) => this.getIntegrationConfig(id);
        await initializeSources(boundGetConfig);

        // Start flush timer
        this.flushTimer = setInterval(() => {
            flushAllBuffers(this.buffers);
        }, 15_000);

        // Register aggregation cron job (every 5 minutes)
        registerJob({
            id: MetricHistoryService.AGGREGATION_JOB_ID,
            name: 'Metric History Aggregation',
            cronExpression: '*/5 * * * *',
            description: 'Compact raw → 1min → 5min + retention cleanup',
            execute: () => runAggregation(boundGetConfig),
        });

        // Register re-probe cron job (every 6 hours)
        registerJob({
            id: MetricHistoryService.REPROBE_JOB_ID,
            name: 'Metric History Source Re-probe',
            cronExpression: '0 */6 * * *',
            description: 'Re-probe integrations for external history availability',
            execute: () => reprobeAll(boundGetConfig),
        });

        // Start background pollers for integrations without SSE
        const boundOnSSEData = (integrationId: string, type: string, data: Record<string, unknown>) => {
            this.onSSEData(integrationId, type, data);
        };
        startAllBackgroundPollers(
            this.backgroundPollers,
            this.sseActiveIntegrations,
            boundGetConfig,
            boundOnSSEData
        );

        logger.info('[MetricHistory] Recording started (SSE buffer + background polling)');
    }

    /**
     * Disable the service: stop all recording and cron jobs.
     * Called when toggled off via settings.
     */
    async disable(): Promise<void> {
        if (!this.enabled) return;

        this.stopAllTimers();
        this.sseActiveIntegrations.clear();
        this.buffers.clear();
        this.enabled = false;

        unregisterJob(MetricHistoryService.REPROBE_JOB_ID);

        // Keep aggregation job if data exists (to compact remaining data)
        registerJob({
            id: MetricHistoryService.AGGREGATION_JOB_ID,
            name: 'Metric History Aggregation (wind-down)',
            cronExpression: '*/5 * * * *',
            description: 'Compact remaining data after feature disable',
            execute: () => runAggregation((id: string) => this.getIntegrationConfig(id)),
        });

        logger.info('[MetricHistory] Recording stopped (aggregation continues for existing data)');
    }

    /**
     * Whether the feature is currently enabled.
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Check if a given integration type is a system-status type (from plugin metrics).
     */
    static isSystemStatusType(type: string): boolean {
        return getSystemStatusTypes().has(type);
    }

    // ========================================================================
    // SSE MODE SWITCHING
    // ========================================================================

    /**
     * Called when a new SSE subscriber opens for a system-status integration.
     * Tracks the integration and stops its background poller (data will come via SSE).
     */
    onSSEActive(integrationId: string): void {
        if (!this.enabled) return;
        this.sseActiveIntegrations.add(integrationId);

        // Stop background poller if running
        const bgTimer = this.backgroundPollers.get(integrationId);
        if (bgTimer) {
            clearInterval(bgTimer);
            this.backgroundPollers.delete(integrationId);
        }
    }

    /**
     * Called when the last SSE subscriber disconnects for a system-status integration.
     * Flushes remaining buffer and starts background polling.
     */
    onSSEIdle(integrationId: string): void {
        if (!this.enabled) return;
        this.sseActiveIntegrations.delete(integrationId);

        // Flush any remaining buffered data
        flushBuffersForIntegration(integrationId, this.buffers);

        // Start background poller to continue recording
        const boundGetConfig = (id: string) => this.getIntegrationConfig(id);
        const boundOnSSEData = (iid: string, type: string, data: Record<string, unknown>) => {
            this.onSSEData(iid, type, data);
        };
        startBackgroundPollerForIntegration(
            integrationId, undefined, this.backgroundPollers, this.sseActiveIntegrations,
            boundGetConfig, boundOnSSEData
        );
    }

    // ========================================================================
    // PUBLIC API — Delegated to Sub-Modules
    // ========================================================================

    /**
     * Buffer SSE metric data for periodic flush.
     * Called from PollerOrchestrator.handleSuccess for system-status polls.
     */
    onSSEData(integrationId: string, type: string, data: Record<string, unknown>): void {
        if (!this.enabled) return;
        handleSSEData(integrationId, type, data, this.buffers, (id) => this.getIntegrationConfig(id));
    }

    /**
     * Get history data for a specific integration and metric.
     */
    async getHistory(integrationId: string, metricKey: string, range: string): Promise<HistoryResponse> {
        return queryHistory(integrationId, metricKey, range, (id) => this.getIntegrationConfig(id));
    }

    /**
     * Probe an integration's metrics for external history availability.
     */
    async probeIntegration(integrationId: string, type?: string): Promise<void> {
        return probeIntegrationMetrics(integrationId, type);
    }

    /**
     * Delete all metric history data.
     */
    async clearAll(): Promise<void> {
        clearAllData();
    }

    /**
     * Called when an integration is saved/edited.
     */
    async onIntegrationSaved(integrationId: string): Promise<void> {
        if (!this.enabled) return;
        await handleIntegrationSaved(integrationId, (id) => this.getIntegrationConfig(id));
    }

    /**
     * Delete metric history and source records for a specific integration.
     * Called when an integration is deleted.
     */
    async clearForIntegration(integrationId: string): Promise<void> {
        clearIntegrationData(integrationId);

        // Stop background poller if running
        const bgTimer = this.backgroundPollers.get(integrationId);
        if (bgTimer) {
            clearInterval(bgTimer);
            this.backgroundPollers.delete(integrationId);
        }
    }

    /**
     * Get per-integration metric history config, falling back to defaults.
     * Public so routes can query config for individual integrations.
     */
    getIntegrationConfig(integrationId: string): MetricHistoryIntegrationConfig {
        return resolveIntegrationConfig(integrationId, this.config, this.globalDefaults);
    }

    /**
     * Update per-integration config and refresh internal state.
     */
    async updateIntegrationConfig(
        integrationId: string,
        config: MetricHistoryIntegrationConfig
    ): Promise<void> {
        const result = await applyIntegrationConfig(integrationId, config);
        this.config = result.config;
        this.globalDefaults = result.globalDefaults;

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
                const boundGetConfig = (id: string) => this.getIntegrationConfig(id);
                const boundOnSSEData = (iid: string, type: string, data: Record<string, unknown>) => {
                    this.onSSEData(iid, type, data);
                };
                startBackgroundPollerForIntegration(
                    integrationId, undefined, this.backgroundPollers, this.sseActiveIntegrations,
                    boundGetConfig, boundOnSSEData
                );
            }
        }
    }

    /**
     * Refresh cached global defaults. Called when defaults are updated via settings.
     */
    async refreshGlobalDefaults(): Promise<void> {
        this.globalDefaults = await getMetricHistoryDefaults();
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    /**
     * Refresh config from database.
     */
    private async refreshConfig(): Promise<void> {
        const systemConfig = getSystemConfig();
        this.config = systemConfig.metricHistory ?? { enabled: false };
        await yieldToEventLoop();
        this.globalDefaults = getMetricHistoryDefaults();
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
