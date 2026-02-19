/**
 * Metric History Database Functions
 *
 * Raw SQL operations for the metric_history table.
 * Used by MetricHistoryService for recording and querying.
 *
 * @module server/db/metricHistory
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricHistoryRow {
    id: number;
    integration_id: string;
    metric_key: string;
    timestamp: number;
    resolution: string;
    value: number | null;
    value_min: number | null;
    value_avg: number | null;
    value_max: number | null;
    sample_count: number;
}

export interface MetricHistoryPoint {
    t: number;
    v?: number;
    avg?: number;
    min?: number;
    max?: number;
}

export interface StorageStats {
    totalRows: number;
    integrations: Array<{
        integrationId: string;
        rowCount: number;
        oldestTimestamp: number | null;
        newestTimestamp: number | null;
    }>;
}

// ============================================================================
// INSERT OPERATIONS
// ============================================================================

/**
 * Insert a raw (single-value) metric data point.
 */
export function insertRaw(
    integrationId: string,
    metricKey: string,
    timestamp: number,
    value: number
): void {
    const db = getDb();
    try {
        db.prepare(`
            INSERT OR IGNORE INTO metric_history
                (integration_id, metric_key, timestamp, resolution, value, sample_count)
            VALUES (?, ?, ?, 'raw', ?, 1)
        `).run(integrationId, metricKey, timestamp, value);
    } catch (error) {
        logger.debug(`[MetricHistoryDB] insertRaw failed: ${(error as Error).message}`);
    }
}

/**
 * Insert an aggregated (min/avg/max) metric data point.
 */
export function insertAggregated(
    integrationId: string,
    metricKey: string,
    timestamp: number,
    resolution: string,
    min: number,
    avg: number,
    max: number,
    sampleCount: number
): void {
    const db = getDb();
    try {
        db.prepare(`
            INSERT OR IGNORE INTO metric_history
                (integration_id, metric_key, timestamp, resolution, value_min, value_avg, value_max, sample_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(integrationId, metricKey, timestamp, resolution, min, avg, max, sampleCount);
    } catch (error) {
        logger.debug(`[MetricHistoryDB] insertAggregated failed: ${(error as Error).message}`);
    }
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Query metric history for a specific integration, metric, and time range.
 * Returns rows ordered by timestamp ascending.
 */
export function query(
    integrationId: string,
    metricKey: string,
    resolution: string,
    startTs: number,
    endTs: number
): MetricHistoryRow[] {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM metric_history
        WHERE integration_id = ?
          AND metric_key = ?
          AND resolution = ?
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp ASC
    `).all(integrationId, metricKey, resolution, startTs, endTs) as MetricHistoryRow[];
}

/**
 * Get raw rows for aggregation — returns rows in a resolution tier
 * older than the specified timestamp.
 */
export function getRawForAggregation(
    resolution: string,
    olderThan: number
): MetricHistoryRow[] {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM metric_history
        WHERE resolution = ?
          AND timestamp < ?
        ORDER BY integration_id, metric_key, timestamp ASC
    `).all(resolution, olderThan) as MetricHistoryRow[];
}

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

/**
 * Delete all rows older than a timestamp for a specific integration.
 * Used for retention cleanup.
 */
export function deleteOlderThan(integrationId: string, timestamp: number): number {
    const db = getDb();
    const result = db.prepare(`
        DELETE FROM metric_history
        WHERE integration_id = ?
          AND timestamp < ?
    `).run(integrationId, timestamp);
    return result.changes;
}

/**
 * Delete rows by resolution older than a timestamp (used during aggregation compaction).
 */
export function deleteByResolutionOlderThan(
    resolution: string,
    olderThan: number
): number {
    const db = getDb();
    const result = db.prepare(`
        DELETE FROM metric_history
        WHERE resolution = ?
          AND timestamp < ?
    `).run(resolution, olderThan);
    return result.changes;
}

/**
 * Delete all metric history data. Called when toggling feature OFF.
 */
export function deleteAll(): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM metric_history').run();
    logger.info(`[MetricHistoryDB] Deleted all history: ${result.changes} rows`);
    return result.changes;
}

/**
 * Delete all metric history for a specific integration.
 */
export function deleteForIntegration(integrationId: string): number {
    const db = getDb();
    const result = db.prepare(
        'DELETE FROM metric_history WHERE integration_id = ?'
    ).run(integrationId);
    return result.changes;
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Get storage statistics for the Jobs & Cache page.
 */
export function getStorageStats(): StorageStats {
    const db = getDb();

    const totalRow = db.prepare(
        'SELECT COUNT(*) as count FROM metric_history'
    ).get() as { count: number };

    const integrationRows = db.prepare(`
        SELECT
            integration_id as integrationId,
            COUNT(*) as rowCount,
            MIN(timestamp) as oldestTimestamp,
            MAX(timestamp) as newestTimestamp
        FROM metric_history
        GROUP BY integration_id
    `).all() as Array<{
        integrationId: string;
        rowCount: number;
        oldestTimestamp: number | null;
        newestTimestamp: number | null;
    }>;

    return {
        totalRows: totalRow.count,
        integrations: integrationRows,
    };
}
