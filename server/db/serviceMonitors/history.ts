/**
 * Service Monitor History
 * 
 * Check history recording and queries.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToHistory } from './helpers';
import { updateAggregate } from './aggregates';
import type { HistoryRow, MonitorHistoryEntry, MonitorCheckResult } from './types';

// ============================================================================
// Check History
// ============================================================================

/**
 * Record a check result to history.
 */
export async function recordCheck(monitorId: string, result: MonitorCheckResult): Promise<MonitorHistoryEntry> {
    const id = uuidv4();

    getDb().prepare(`
        INSERT INTO service_monitor_history (id, monitor_id, status, response_time_ms, status_code, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, monitorId, result.status, result.responseTimeMs, result.statusCode, result.errorMessage);

    // Update hourly aggregate
    await updateAggregate(monitorId, result);

    const row = getDb().prepare('SELECT * FROM service_monitor_history WHERE id = ?').get(id) as HistoryRow;
    return rowToHistory(row);
}

/**
 * Get recent checks for a monitor (for degraded calculation).
 */
export async function getRecentChecks(monitorId: string, count: number = 5): Promise<MonitorHistoryEntry[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitor_history 
        WHERE monitor_id = ? 
        ORDER BY checked_at DESC 
        LIMIT ?
    `).all(monitorId, count) as HistoryRow[];
    return rows.map(rowToHistory);
}

/**
 * Get check history for a monitor (paginated).
 */
export async function getCheckHistory(monitorId: string, limit: number = 100, offset: number = 0): Promise<MonitorHistoryEntry[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitor_history 
        WHERE monitor_id = ? 
        ORDER BY checked_at DESC 
        LIMIT ? OFFSET ?
    `).all(monitorId, limit, offset) as HistoryRow[];
    return rows.map(rowToHistory);
}

/**
 * Prune old history (keep last 7 days).
 */
export async function pruneOldHistory(daysToKeep: number = 7): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    const result = getDb().prepare('DELETE FROM service_monitor_history WHERE checked_at < ?').run(cutoff);
    if (result.changes > 0) {
        logger.info(`[ServiceMonitors] Pruned history: deleted=${result.changes} daysKept=${daysToKeep}`);
    }
    return result.changes;
}
