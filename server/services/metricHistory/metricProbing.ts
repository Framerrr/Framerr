/**
 * Metric History — Source Detection & Probing
 *
 * Handles initialization and periodic re-probing of external
 * history sources for integrations.
 *
 * @module server/services/metricHistory/metricProbing
 */

import * as metricHistorySourcesDb from '../../db/metricHistorySources';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { getPlugin } from '../../integrations/registry';
import type { MetricHistoryIntegrationConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';
import { getSystemStatusTypes, getRecordableMetrics } from './types';
import { resolveIntegrationType } from './metricConfig';

// ============================================================================
// SOURCE INITIALIZATION
// ============================================================================

/**
 * Initialize source records for all existing system-status integrations.
 * Called when the feature is first enabled.
 * Seeds pending entries and triggers probing.
 */
export async function initializeSources(
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<void> {
    for (const type of getSystemStatusTypes()) {
        const instances = integrationInstancesDb.getInstancesByType(type);
        for (const instance of instances) {
            if (!instance.enabled) continue;

            const integrationConfig = getIntegrationConfig(instance.id);
            if (integrationConfig.mode === 'off') continue;

            await probeIntegrationMetrics(instance.id, type);
        }
    }
}

// ============================================================================
// PROBING
// ============================================================================

/**
 * Probe an integration's metrics for external history availability.
 * For each recordable metric with a historyProbe config, attempts to
 * fetch from the external endpoint. Updates metric_history_sources.
 *
 * Called on: feature enable, integration save/edit, daily re-probe.
 */
export async function probeIntegrationMetrics(
    integrationId: string,
    type?: string
): Promise<void> {
    const resolvedType = type ?? resolveIntegrationType(integrationId);
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

/**
 * Re-probe all integrations in auto/external mode.
 * Called by the cron job scheduler (every 6h when enabled).
 */
export async function reprobeAll(
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<void> {
    try {
        for (const type of getSystemStatusTypes()) {
            const instances = integrationInstancesDb.getInstancesByType(type);
            for (const instance of instances) {
                if (!instance.enabled) continue;
                const config = getIntegrationConfig(instance.id);
                // Only re-probe for auto and external modes
                if (config.mode === 'off' || config.mode === 'internal') continue;
                await probeIntegrationMetrics(instance.id, type);
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
export async function handleIntegrationSaved(
    integrationId: string,
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<void> {
    const type = resolveIntegrationType(integrationId);
    if (!type) return;

    const config = getIntegrationConfig(integrationId);

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
    await probeIntegrationMetrics(integrationId, type);
    logger.debug(`[MetricHistory] Re-probed ${integrationId.slice(0, 8)} after save`);
}
