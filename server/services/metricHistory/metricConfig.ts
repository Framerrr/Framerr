/**
 * Metric History — Per-Integration Config Management
 *
 * Handles per-integration metric history configuration, cleanup,
 * and integration type resolution.
 *
 * @module server/services/metricHistory/metricConfig
 */

import * as metricHistoryDb from '../../db/metricHistory';
import * as metricHistorySourcesDb from '../../db/metricHistorySources';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { getSystemConfig, type MetricHistoryConfig, type MetricHistoryIntegrationConfig, type MetricHistoryDefaultsConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';

// ============================================================================
// CONFIG RESOLUTION
// ============================================================================

/**
 * Get per-integration metric history config, falling back to defaults.
 * Public so routes can query config for individual integrations.
 */
export function resolveIntegrationConfig(
    integrationId: string,
    config: MetricHistoryConfig | null,
    globalDefaults: MetricHistoryDefaultsConfig
): MetricHistoryIntegrationConfig {
    const perIntegration = config?.integrations?.[integrationId];
    return perIntegration ?? {
        mode: globalDefaults.mode,
        retentionDays: globalDefaults.retentionDays,
    };
}

/**
 * Update per-integration config and refresh internal state.
 * Returns the updated config and globalDefaults so the caller can cache them.
 */
export async function applyIntegrationConfig(
    integrationId: string,
    newConfig: MetricHistoryIntegrationConfig
): Promise<{ config: MetricHistoryConfig; globalDefaults: MetricHistoryDefaultsConfig }> {
    const systemConfig = await getSystemConfig();
    const metricHistory = systemConfig.metricHistory ?? { enabled: false };
    const integrations = metricHistory.integrations ?? {};
    integrations[integrationId] = newConfig;
    metricHistory.integrations = integrations;

    const { updateSystemConfig } = await import('../../db/systemConfig');
    await updateSystemConfig({ metricHistory });

    // Re-read the config to get the fresh state
    const freshSystemConfig = await getSystemConfig();
    const freshConfig = freshSystemConfig.metricHistory ?? { enabled: false };
    const { getMetricHistoryDefaults } = await import('../../db/systemConfig');
    const freshDefaults = await getMetricHistoryDefaults();

    logger.info(`[MetricHistory] Updated config for ${integrationId.slice(0, 8)}: mode=${newConfig.mode}, retention=${newConfig.retentionDays}d`);

    return { config: freshConfig, globalDefaults: freshDefaults };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Delete metric history and source records for a specific integration.
 * Called when an integration is deleted.
 */
export function clearIntegrationData(integrationId: string): void {
    metricHistoryDb.deleteForIntegration(integrationId);
    metricHistorySourcesDb.deleteForIntegration(integrationId);
}

/**
 * Delete all metric history data and source records.
 */
export function clearAllData(): void {
    metricHistoryDb.deleteAll();
    metricHistorySourcesDb.deleteAll();
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve integration type from ID by looking it up in the DB.
 */
export function resolveIntegrationType(integrationId: string): string | null {
    const instance = integrationInstancesDb.getInstanceById(integrationId);
    return instance?.type ?? null;
}
