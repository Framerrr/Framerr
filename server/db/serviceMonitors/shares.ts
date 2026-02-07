/**
 * Service Monitor Sharing
 * 
 * Share monitors with users.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToMonitor, rowToShare } from './helpers';
import type { MonitorRow, ShareRow, ServiceMonitor, MonitorShare } from './types';

// ============================================================================
// Sharing
// ============================================================================

/**
 * Share a monitor with specific users.
 */
export async function shareMonitor(monitorId: string, userIds: string[], notify: boolean = false): Promise<MonitorShare[]> {
    const shares: MonitorShare[] = [];

    const insert = getDb().prepare(`
        INSERT OR IGNORE INTO service_monitor_shares (id, monitor_id, user_id, notify)
        VALUES (?, ?, ?, ?)
    `);

    for (const userId of userIds) {
        const id = uuidv4();
        try {
            insert.run(id, monitorId, userId, notify ? 1 : 0);
            const share = await getShareById(id);
            if (share) shares.push(share);
        } catch (error) {
            if (!(error as Error).message.includes('UNIQUE constraint')) {
                throw error;
            }
        }
    }

    logger.info(`[ServiceMonitors] Shared: monitor=${monitorId} users=${userIds.length}`);
    return shares;
}

/**
 * Remove sharing for a monitor.
 */
export async function unshareMonitor(monitorId: string, userIds?: string[]): Promise<number> {
    let sql = 'DELETE FROM service_monitor_shares WHERE monitor_id = ?';
    const params: string[] = [monitorId];

    if (userIds && userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(', ');
        sql += ` AND user_id IN (${placeholders})`;
        params.push(...userIds);
    }

    const result = getDb().prepare(sql).run(...params);
    logger.info(`[ServiceMonitors] Unshared: monitor=${monitorId} removed=${result.changes}`);
    return result.changes;
}

/**
 * Get all shares for a monitor.
 */
export async function getMonitorShares(monitorId: string): Promise<MonitorShare[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitor_shares WHERE monitor_id = ?
    `).all(monitorId) as ShareRow[];
    return rows.map(rowToShare);
}

/**
 * Get monitors shared with a user.
 */
export async function getSharedMonitors(userId: string): Promise<ServiceMonitor[]> {
    const rows = getDb().prepare(`
        SELECT m.* FROM service_monitors m
        INNER JOIN service_monitor_shares s ON m.id = s.monitor_id
        WHERE s.user_id = ? AND m.enabled = 1
        ORDER BY m.order_index ASC, m.created_at ASC
    `).all(userId) as MonitorRow[];
    return rows.map(rowToMonitor);
}

/**
 * Update notification preference for a share.
 */
export async function updateShareNotify(monitorId: string, userId: string, notify: boolean): Promise<boolean> {
    const result = getDb().prepare(`
        UPDATE service_monitor_shares SET notify = ? WHERE monitor_id = ? AND user_id = ?
    `).run(notify ? 1 : 0, monitorId, userId);
    return result.changes > 0;
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function getShareById(id: string): Promise<MonitorShare | null> {
    const row = getDb().prepare('SELECT * FROM service_monitor_shares WHERE id = ?').get(id) as ShareRow | undefined;
    return row ? rowToShare(row) : null;
}
