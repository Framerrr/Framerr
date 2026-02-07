/**
 * Service Monitor Aggregates
 * 
 * Hourly aggregate tracking for visualization.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToAggregate } from './helpers';
import type { AggregateRow, MonitorAggregate, MonitorCheckResult } from './types';

// ============================================================================
// Aggregates
// ============================================================================

/**
 * Update hourly aggregate for a monitor.
 */
export async function updateAggregate(monitorId: string, result: MonitorCheckResult): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const hourStart = now - (now % 3600); // Round down to hour

    // Try to update existing aggregate
    const existing = getDb().prepare(`
        SELECT * FROM service_monitor_aggregates 
        WHERE monitor_id = ? AND hour_start = ?
    `).get(monitorId, hourStart) as AggregateRow | undefined;

    if (existing) {
        // Update existing
        const newTotal = existing.checks_total + 1;
        const newUp = existing.checks_up + (result.status === 'up' ? 1 : 0);
        const newDegraded = existing.checks_degraded + (result.status === 'degraded' ? 1 : 0);
        const newDown = existing.checks_down + (result.status === 'down' ? 1 : 0);

        // Calculate new average response time
        let newAvg = existing.avg_response_ms;
        if (result.responseTimeMs !== null) {
            if (existing.avg_response_ms !== null) {
                newAvg = Math.round((existing.avg_response_ms * existing.checks_total + result.responseTimeMs) / newTotal);
            } else {
                newAvg = result.responseTimeMs;
            }
        }

        getDb().prepare(`
            UPDATE service_monitor_aggregates 
            SET checks_total = ?, checks_up = ?, checks_degraded = ?, checks_down = ?, avg_response_ms = ?
            WHERE monitor_id = ? AND hour_start = ?
        `).run(newTotal, newUp, newDegraded, newDown, newAvg, monitorId, hourStart);
    } else {
        // Create new aggregate
        const id = uuidv4();
        getDb().prepare(`
            INSERT INTO service_monitor_aggregates (id, monitor_id, hour_start, checks_total, checks_up, checks_degraded, checks_down, checks_maintenance, avg_response_ms)
            VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?)
        `).run(
            id,
            monitorId,
            hourStart,
            result.status === 'up' ? 1 : 0,
            result.status === 'degraded' ? 1 : 0,
            result.status === 'down' ? 1 : 0,
            result.responseTimeMs
        );
    }
}

/**
 * Update hourly aggregate to track maintenance period.
 * Called by poller when a monitor is skipped due to maintenance mode.
 */
export async function updateMaintenanceAggregate(monitorId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const hourStart = now - (now % 3600); // Round down to hour

    // Try to update existing aggregate
    const existing = getDb().prepare(`
        SELECT * FROM service_monitor_aggregates 
        WHERE monitor_id = ? AND hour_start = ?
    `).get(monitorId, hourStart) as AggregateRow | undefined;

    if (existing) {
        // Update existing - increment maintenance count
        getDb().prepare(`
            UPDATE service_monitor_aggregates 
            SET checks_maintenance = checks_maintenance + 1
            WHERE monitor_id = ? AND hour_start = ?
        `).run(monitorId, hourStart);
    } else {
        // Create new aggregate with just maintenance
        const id = uuidv4();
        getDb().prepare(`
            INSERT INTO service_monitor_aggregates (id, monitor_id, hour_start, checks_total, checks_up, checks_degraded, checks_down, checks_maintenance, avg_response_ms)
            VALUES (?, ?, ?, 0, 0, 0, 0, 1, NULL)
        `).run(id, monitorId, hourStart);
    }
}

/**
 * Get hourly aggregates for tick-bar visualization.
 */
export async function getHourlyAggregates(monitorId: string, hours: number = 24): Promise<MonitorAggregate[]> {
    const cutoff = Math.floor(Date.now() / 1000) - (hours * 60 * 60);
    const rows = getDb().prepare(`
        SELECT * FROM service_monitor_aggregates 
        WHERE monitor_id = ? AND hour_start >= ?
        ORDER BY hour_start ASC
    `).all(monitorId, cutoff) as AggregateRow[];
    return rows.map(rowToAggregate);
}

/**
 * Prune old aggregates (keep last 30 days).
 */
export async function pruneOldAggregates(daysToKeep: number = 30): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    const result = getDb().prepare('DELETE FROM service_monitor_aggregates WHERE hour_start < ?').run(cutoff);
    if (result.changes > 0) {
        logger.info(`[ServiceMonitors] Pruned aggregates: deleted=${result.changes} daysKept=${daysToKeep}`);
    }
    return result.changes;
}
