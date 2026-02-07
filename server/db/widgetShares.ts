/**
 * Widget Shares Database Layer
 * 
 * Database-backed sharing for widget types.
 * Works alongside integration_shares for the dual-table sharing model:
 * - widget_shares: Controls access to widget TYPES (e.g., 'plex-sessions')
 * - integration_shares: Controls access to integration INSTANCES (e.g., 'plex-home')
 * 
 * User needs BOTH widget share AND integration share to use a widget.
 */

import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type ShareType = 'everyone' | 'user' | 'group';

export interface WidgetShare {
    id: string;
    widgetType: string;
    shareType: ShareType;
    shareTarget: string | null;  // user_id, group_name, or null for 'everyone'
    sharedBy: string;
    createdAt: string;
}

interface ShareRow {
    id: string;
    widget_type: string;
    share_type: string;
    share_target: string | null;
    shared_by: string;
    created_at: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function rowToShare(row: ShareRow): WidgetShare {
    return {
        id: row.id,
        widgetType: row.widget_type,
        shareType: row.share_type as ShareType,
        shareTarget: row.share_target,
        sharedBy: row.shared_by,
        createdAt: new Date(row.created_at * 1000).toISOString()
    };
}

// ============================================================================
// Share Operations
// ============================================================================

/**
 * Share a widget type with users, groups, or everyone.
 * 
 * @param widgetType - The widget type to share (e.g., 'plex-sessions', 'calendar')
 * @param shareType - 'everyone', 'user', or 'group'
 * @param targets - Array of user IDs or group names (ignored for 'everyone')
 * @param sharedBy - Admin user ID creating the share
 * @returns Array of created share records
 */
export async function shareWidgetType(
    widgetType: string,
    shareType: ShareType,
    targets: string[],
    sharedBy: string
): Promise<WidgetShare[]> {
    const db = getDb();
    const created: WidgetShare[] = [];

    if (shareType === 'everyone') {
        // For 'everyone', ignore targets and create a single share
        const id = uuidv4();
        try {
            db.prepare(`
                INSERT OR REPLACE INTO widget_shares 
                (id, widget_type, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, 'everyone', NULL, ?, strftime('%s', 'now'))
            `).run(id, widgetType, sharedBy);

            created.push({
                id,
                widgetType,
                shareType: 'everyone',
                shareTarget: null,
                sharedBy,
                createdAt: new Date().toISOString()
            });

            logger.info(`[WidgetShares] Shared: widget=${widgetType} target=everyone sharedBy=${sharedBy}`);
        } catch (error) {
            logger.error(`[WidgetShares] Failed to create everyone share: error="${(error as Error).message}"`);
            throw error;
        }
    } else {
        // For 'user' or 'group', create a share for each target
        for (const target of targets) {
            const id = uuidv4();
            try {
                db.prepare(`
                    INSERT OR REPLACE INTO widget_shares 
                    (id, widget_type, share_type, share_target, shared_by, created_at)
                    VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
                `).run(id, widgetType, shareType, target, sharedBy);

                created.push({
                    id,
                    widgetType,
                    shareType,
                    shareTarget: target,
                    sharedBy,
                    createdAt: new Date().toISOString()
                });
            } catch (error) {
                logger.error(`[WidgetShares] Failed to create share: type=${shareType} target=${target} error="${(error as Error).message}"`);
            }
        }

        logger.info(`[WidgetShares] Shared: widget=${widgetType} type=${shareType} count=${created.length} sharedBy=${sharedBy}`);
    }

    return created;
}

/**
 * Revoke sharing for a widget type.
 * 
 * @param widgetType - The widget type to unshare
 * @param shareType - Optional: only revoke this type ('everyone', 'user', 'group')
 * @param targets - Optional: only revoke for these specific targets
 * @returns Number of shares revoked
 */
export async function unshareWidgetType(
    widgetType: string,
    shareType?: ShareType,
    targets?: string[]
): Promise<number> {
    const db = getDb();

    if (!shareType) {
        // Revoke ALL shares for this widget type
        const result = db.prepare(`
            DELETE FROM widget_shares WHERE widget_type = ?
        `).run(widgetType);

        logger.info(`[WidgetShares] Revoked: widget=${widgetType} target=all count=${result.changes}`);
        return result.changes;
    }

    if (shareType === 'everyone') {
        // Revoke 'everyone' share
        const result = db.prepare(`
            DELETE FROM widget_shares 
            WHERE widget_type = ? AND share_type = 'everyone'
        `).run(widgetType);

        logger.info(`[WidgetShares] Revoked: widget=${widgetType} target=everyone count=${result.changes}`);
        return result.changes;
    }

    if (!targets || targets.length === 0) {
        // Revoke all shares of this type
        const result = db.prepare(`
            DELETE FROM widget_shares 
            WHERE widget_type = ? AND share_type = ?
        `).run(widgetType, shareType);

        logger.info(`[WidgetShares] Revoked: widget=${widgetType} type=${shareType} count=${result.changes}`);
        return result.changes;
    }

    // Revoke specific target shares
    let totalRevoked = 0;
    for (const target of targets) {
        const result = db.prepare(`
            DELETE FROM widget_shares 
            WHERE widget_type = ? AND share_type = ? AND share_target = ?
        `).run(widgetType, shareType, target);
        totalRevoked += result.changes;
    }

    logger.info(`[WidgetShares] Revoked ${totalRevoked} ${shareType} share(s) for ${widgetType}`);
    return totalRevoked;
}

/**
 * Get all shares for a widget type.
 */
export async function getWidgetShares(widgetType: string): Promise<WidgetShare[]> {
    const db = getDb();
    const rows = db.prepare(`
        SELECT * FROM widget_shares WHERE widget_type = ?
    `).all(widgetType) as ShareRow[];

    return rows.map(rowToShare);
}

/**
 * Get all widget shares grouped by widget type.
 * Used for admin UI display.
 */
export async function getAllWidgetShares(): Promise<Map<string, WidgetShare[]>> {
    const db = getDb();
    const rows = db.prepare(`
        SELECT * FROM widget_shares ORDER BY widget_type, share_type
    `).all() as ShareRow[];

    const sharesByType = new Map<string, WidgetShare[]>();
    for (const row of rows) {
        const share = rowToShare(row);
        if (!sharesByType.has(share.widgetType)) {
            sharesByType.set(share.widgetType, []);
        }
        sharesByType.get(share.widgetType)!.push(share);
    }

    return sharesByType;
}

/**
 * Check if a user has access to a widget type.
 * 
 * @param widgetType - Widget type to check
 * @param userId - User ID
 * @param userGroup - User's group
 * @returns true if user has access
 */
export async function userHasWidgetShare(
    widgetType: string,
    userId: string,
    userGroup: string
): Promise<boolean> {
    const db = getDb();

    // Check for 'everyone' share
    const everyoneShare = db.prepare(`
        SELECT 1 FROM widget_shares 
        WHERE widget_type = ? AND share_type = 'everyone'
        LIMIT 1
    `).get(widgetType);

    if (everyoneShare) return true;

    // Check for direct user share
    const userShare = db.prepare(`
        SELECT 1 FROM widget_shares 
        WHERE widget_type = ? AND share_type = 'user' AND share_target = ?
        LIMIT 1
    `).get(widgetType, userId);

    if (userShare) return true;

    // Check for group share
    const groupShare = db.prepare(`
        SELECT 1 FROM widget_shares 
        WHERE widget_type = ? AND share_type = 'group' AND share_target = ?
        LIMIT 1
    `).get(widgetType, userGroup);

    return !!groupShare;
}

/**
 * Get all widget types that a user has access to.
 * 
 * @param userId - User ID
 * @param userGroup - User's group
 * @returns Array of widget types
 */
export async function getUserAccessibleWidgets(
    userId: string,
    userGroup: string
): Promise<string[]> {
    const db = getDb();

    const rows = db.prepare(`
        SELECT DISTINCT widget_type FROM widget_shares
        WHERE share_type = 'everyone'
           OR (share_type = 'user' AND share_target = ?)
           OR (share_type = 'group' AND share_target = ?)
    `).all(userId, userGroup) as { widget_type: string }[];

    return rows.map(r => r.widget_type);
}

/**
 * Bulk update shares for a widget type.
 * Replaces all existing shares with the new ones.
 * 
 * @param widgetType - Widget type to update
 * @param userShares - Array of user IDs to share with
 * @param groupShares - Array of group names to share with
 * @param everyoneShare - Whether to share with everyone
 * @param sharedBy - Admin user ID
 */
export async function bulkUpdateWidgetShares(
    widgetType: string,
    userShares: string[],
    groupShares: string[],
    everyoneShare: boolean,
    sharedBy: string
): Promise<void> {
    const db = getDb();

    // Start transaction
    db.exec('BEGIN TRANSACTION');

    try {
        // Delete all existing shares for this widget type
        db.prepare(`DELETE FROM widget_shares WHERE widget_type = ?`).run(widgetType);

        // Create new shares
        if (everyoneShare) {
            db.prepare(`
                INSERT INTO widget_shares (id, widget_type, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, 'everyone', NULL, ?, strftime('%s', 'now'))
            `).run(uuidv4(), widgetType, sharedBy);
        }

        for (const userId of userShares) {
            db.prepare(`
                INSERT INTO widget_shares (id, widget_type, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, 'user', ?, ?, strftime('%s', 'now'))
            `).run(uuidv4(), widgetType, userId, sharedBy);
        }

        for (const groupName of groupShares) {
            db.prepare(`
                INSERT INTO widget_shares (id, widget_type, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, 'group', ?, ?, strftime('%s', 'now'))
            `).run(uuidv4(), widgetType, groupName, sharedBy);
        }

        db.exec('COMMIT');
        logger.info(`[WidgetShares] Bulk updated: widget=${widgetType} users=${userShares.length} groups=${groupShares.length} everyone=${everyoneShare}`);
    } catch (error) {
        db.exec('ROLLBACK');
        logger.error(`[WidgetShares] Bulk update failed: error="${(error as Error).message}"`);
        throw error;
    }
}
