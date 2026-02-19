/**
 * Metric History Sources Database Functions
 *
 * CRUD operations for the metric_history_sources table.
 * Tracks per-metric source resolution (internal/external/none/pending)
 * and probe status for each integration's metrics.
 *
 * @module server/db/metricHistorySources
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type MetricSource = 'internal' | 'external' | 'none' | 'pending';
export type ProbeStatus = 'success' | 'failed' | 'pending';

export interface MetricHistorySourceRow {
    integration_id: string;
    metric_key: string;
    source: MetricSource;
    last_probed: number | null;
    probe_status: ProbeStatus | null;
}

export interface MetricAvailability {
    metricKey: string;
    source: MetricSource;
    probeStatus: ProbeStatus | null;
    hasData: boolean;
    dataPoints: number;
}

// ============================================================================
// UPSERT
// ============================================================================

/**
 * Insert or update a metric source entry.
 */
export function upsert(
    integrationId: string,
    metricKey: string,
    source: MetricSource,
    probeStatus: ProbeStatus | null = null
): void {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    try {
        db.prepare(`
            INSERT INTO metric_history_sources
                (integration_id, metric_key, source, last_probed, probe_status)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(integration_id, metric_key)
            DO UPDATE SET source = ?, last_probed = ?, probe_status = ?
        `).run(
            integrationId, metricKey, source, now, probeStatus,
            source, now, probeStatus
        );
    } catch (error) {
        logger.error(`[MetricHistorySourcesDB] upsert failed: ${(error as Error).message}`);
    }
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Get all source entries for an integration.
 */
export function getForIntegration(integrationId: string): MetricHistorySourceRow[] {
    const db = getDb();
    return db.prepare(
        'SELECT * FROM metric_history_sources WHERE integration_id = ?'
    ).all(integrationId) as MetricHistorySourceRow[];
}

/**
 * Get a specific metric's source for an integration.
 */
export function getForMetric(
    integrationId: string,
    metricKey: string
): MetricHistorySourceRow | undefined {
    const db = getDb();
    return db.prepare(
        'SELECT * FROM metric_history_sources WHERE integration_id = ? AND metric_key = ?'
    ).get(integrationId, metricKey) as MetricHistorySourceRow | undefined;
}

/**
 * Get all source entries across all integrations.
 */
export function listAll(): MetricHistorySourceRow[] {
    const db = getDb();
    return db.prepare('SELECT * FROM metric_history_sources').all() as MetricHistorySourceRow[];
}

// ============================================================================
// AVAILABILITY (merged with live data counts)
// ============================================================================

/**
 * Get per-metric availability for an integration.
 * Merges source probe results with actual data presence from metric_history table.
 */
export function getAvailability(integrationId: string): MetricAvailability[] {
    const db = getDb();

    // Get source entries for this integration
    const sources = getForIntegration(integrationId);

    // Get data point counts from metric_history
    const dataCounts = db.prepare(`
        SELECT metric_key, COUNT(*) as count
        FROM metric_history
        WHERE integration_id = ?
        GROUP BY metric_key
    `).all(integrationId) as Array<{ metric_key: string; count: number }>;

    const countMap = new Map(dataCounts.map(d => [d.metric_key, d.count]));

    return sources.map(s => ({
        metricKey: s.metric_key,
        source: s.source as MetricSource,
        probeStatus: s.probe_status as ProbeStatus | null,
        hasData: (countMap.get(s.metric_key) ?? 0) > 0 || s.source === 'external',
        dataPoints: countMap.get(s.metric_key) ?? 0,
    }));
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete all source entries for an integration.
 * Called when integration is deleted.
 */
export function deleteForIntegration(integrationId: string): number {
    const db = getDb();
    const result = db.prepare(
        'DELETE FROM metric_history_sources WHERE integration_id = ?'
    ).run(integrationId);
    return result.changes;
}

/**
 * Delete a single metric source entry for an integration.
 * Used by pruning logic to remove stale records for metrics no longer declared.
 */
export function deleteForMetric(integrationId: string, metricKey: string): number {
    const db = getDb();
    const result = db.prepare(
        'DELETE FROM metric_history_sources WHERE integration_id = ? AND metric_key = ?'
    ).run(integrationId, metricKey);
    return result.changes;
}

/**
 * Delete all source entries. Called when feature is toggled OFF.
 */
export function deleteAll(): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM metric_history_sources').run();
    return result.changes;
}
