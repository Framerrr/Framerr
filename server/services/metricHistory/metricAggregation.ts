/**
 * Metric History — Tiered Aggregation & Retention
 *
 * Handles compaction of raw data into higher-resolution tiers
 * and retention-based cleanup of old data.
 *
 * @module server/services/metricHistory/metricAggregation
 */

import * as metricHistoryDb from '../../db/metricHistory';
import type { MetricHistoryIntegrationConfig } from '../../db/systemConfig';
import { yieldToEventLoop } from '../../utils/eventLoopYield';
import logger from '../../utils/logger';

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Run the aggregation job.
 * Compacts raw → 1min, 1min → 5min.
 * Then runs retention cleanup.
 */
export async function runAggregation(
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<void> {
    try {
        const now = Math.floor(Date.now() / 1000);

        // Phase 1: compact raw → 1min (contiguous read/insert/delete)
        await compactTier('raw', '1min', now - 120, 60);

        // Yield between phases — safe because each phase is self-contained
        await yieldToEventLoop();

        // Phase 2: compact 1min → 5min (contiguous read/insert/delete)
        await compactTier('1min', '5min', now - 600, 300);

        // Yield before retention cleanup
        await yieldToEventLoop();

        // Phase 3: retention cleanup
        await runRetentionCleanup(getIntegrationConfig);

        logger.debug('[MetricHistory] Aggregation complete');
    } catch (error) {
        logger.error(`[MetricHistory] Aggregation failed: ${(error as Error).message}`);
    }
}

/**
 * Compact data from one resolution tier to the next.
 */
async function compactTier(
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
export async function runRetentionCleanup(
    getIntegrationConfig: (id: string) => MetricHistoryIntegrationConfig
): Promise<void> {
    const stats = metricHistoryDb.getStorageStats();

    for (const integration of stats.integrations) {
        const config = getIntegrationConfig(integration.integrationId);
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
