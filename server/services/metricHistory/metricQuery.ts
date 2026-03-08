/**
 * Metric History — History Query & External Proxy
 *
 * Handles reading history data (internal and external sources)
 * and range-to-resolution mapping.
 *
 * @module server/services/metricHistory/metricQuery
 */

import * as metricHistoryDb from '../../db/metricHistory';
import * as metricHistorySourcesDb from '../../db/metricHistorySources';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { getPlugin } from '../../integrations/registry';
import type { MetricHistoryIntegrationConfig } from '../../db/systemConfig';
import logger from '../../utils/logger';
import { getRecordableMetrics } from './types';
import type { HistoryDataPoint, HistoryResponse } from './types';

// ============================================================================
// HISTORY QUERY
// ============================================================================

/**
 * Get history data for a specific integration and metric.
 * Checks per-integration mode and source resolution:
 * - If mode is 'off', returns empty data
 * - If source is 'external', proxies to integration's history endpoint
 * - Otherwise returns internal recorded data with resolution fallback
 */
export async function queryHistory(
    integrationId: string,
    metricKey: string,
    range: string,
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<HistoryResponse> {
    // Check per-integration mode
    const integrationConfig = getIntegrationConfig(integrationId);
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
        return fetchExternalHistory(integrationId, metricKey, range);
    }

    // Internal data path
    const { resolution, durationMs } = resolveRangeParams(range);

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

// ============================================================================
// EXTERNAL HISTORY PROXY
// ============================================================================

/**
 * Fetch history data from an external source (integration's history endpoint).
 * Normalizes the response to match the standard HistoryResponse format.
 */
async function fetchExternalHistory(
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

// ============================================================================
// RANGE RESOLUTION
// ============================================================================

/**
 * Resolve range string to resolution and duration.
 * Per spec:
 * - 5m, 15m, 30m, 1h → raw (15s)
 * - 3h, 6h → 1min
 * - 12h, 1d, 3d, 7d, 30d → 5min
 */
export function resolveRangeParams(range: string): { resolution: string; durationMs: number } {
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
