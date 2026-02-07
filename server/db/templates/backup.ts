/**
 * Template Backup Operations
 * 
 * Dashboard backup before template application.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import type { BackupRow, DashboardBackup } from '../templates.types';

// ============================================================================
// Backup Operations
// ============================================================================

/**
 * Create or update dashboard backup before template apply
 */
export async function createBackup(
    userId: string,
    widgets: unknown[],
    mobileLayoutMode: 'linked' | 'independent',
    mobileWidgets?: unknown[]
): Promise<DashboardBackup> {
    const id = uuidv4();

    try {
        // Upsert - replace existing backup for user
        const upsert = getDb().prepare(`
            INSERT INTO dashboard_backups (id, user_id, widgets, mobile_layout_mode, mobile_widgets)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                widgets = excluded.widgets,
                mobile_layout_mode = excluded.mobile_layout_mode,
                mobile_widgets = excluded.mobile_widgets,
                backed_up_at = strftime('%s', 'now')
        `);

        upsert.run(
            id,
            userId,
            JSON.stringify(widgets),
            mobileLayoutMode,
            mobileWidgets ? JSON.stringify(mobileWidgets) : null
        );

        logger.debug(`[Templates] Backup created: user=${userId} widgets=${widgets.length}`);

        return getBackup(userId) as Promise<DashboardBackup>;
    } catch (error) {
        logger.error(`[Templates] Failed to create backup: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get backup for a user
 */
export async function getBackup(userId: string): Promise<DashboardBackup | null> {
    try {
        const row = getDb().prepare('SELECT * FROM dashboard_backups WHERE user_id = ?').get(userId) as BackupRow | undefined;

        if (!row) return null;

        let widgets: unknown[] = [];
        let mobileWidgets: unknown[] | null = null;

        try {
            widgets = JSON.parse(row.widgets);
        } catch {
            logger.warn(`[Templates] Failed to parse backup widgets: user=${userId}`);
        }

        if (row.mobile_widgets) {
            try {
                mobileWidgets = JSON.parse(row.mobile_widgets);
            } catch {
                logger.warn(`[Templates] Failed to parse backup mobile widgets: user=${userId}`);
            }
        }

        return {
            id: row.id,
            userId: row.user_id,
            widgets,
            mobileLayoutMode: row.mobile_layout_mode as 'linked' | 'independent',
            mobileWidgets,
            backedUpAt: new Date(row.backed_up_at * 1000).toISOString(),
        };
    } catch (error) {
        logger.error(`[Templates] Failed to get backup: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete backup after revert
 */
export async function deleteBackup(userId: string): Promise<boolean> {
    try {
        const result = getDb().prepare('DELETE FROM dashboard_backups WHERE user_id = ?').run(userId);
        return result.changes > 0;
    } catch (error) {
        logger.error(`[Templates] Failed to delete backup: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}
