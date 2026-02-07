/**
 * Tab Groups Database Functions
 * 
 * CRUD operations for per-user tab groups.
 * Uses the existing `tab_groups` table in the database.
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroup {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    order: number;
    createdAt: string;
}

interface TabGroupRow {
    id: string;
    user_id: string;
    name: string;
    icon: string | null;
    tab_order: number;
    created_at: number;
}

// Default tab groups for new users
const DEFAULT_TAB_GROUPS = [
    { id: 'media', name: 'Media', icon: null, order: 0 },
    { id: 'downloads', name: 'Downloads', icon: null, order: 1 },
    { id: 'system', name: 'System', icon: null, order: 2 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function rowToTabGroup(row: TabGroupRow): TabGroup {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        icon: row.icon,
        order: row.tab_order ?? 0,
        createdAt: new Date(row.created_at * 1000).toISOString(),
    };
}

// ============================================================================
// CRUD FUNCTIONS
// ============================================================================

/**
 * Get all tab groups for a user
 */
export async function getUserTabGroups(userId: string): Promise<TabGroup[]> {
    try {
        const rows = getDb().prepare(`
            SELECT id, user_id, name, icon, tab_order, created_at
            FROM tab_groups
            WHERE user_id = ?
            ORDER BY tab_order ASC, created_at ASC
        `).all(userId) as TabGroupRow[];

        // If no groups exist, create defaults
        if (rows.length === 0) {
            await createDefaultTabGroups(userId);
            return getUserTabGroups(userId);
        }

        return rows.map(rowToTabGroup);
    } catch (error) {
        logger.error(`[TabGroups] Failed to get: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Create default tab groups for a new user
 */
export async function createDefaultTabGroups(userId: string): Promise<void> {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO tab_groups (id, user_id, name, icon, tab_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const now = Math.floor(Date.now() / 1000);

        const insertMany = getDb().transaction(() => {
            for (const group of DEFAULT_TAB_GROUPS) {
                stmt.run(
                    `${userId}-${group.id}`, // Unique ID per user
                    userId,
                    group.name,
                    group.icon,
                    group.order,
                    now
                );
            }
        });

        insertMany();
        logger.info(`[TabGroups] Created defaults: user=${userId}`);
    } catch (error) {
        logger.error(`[TabGroups] Failed to create defaults: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Create a new tab group
 */
export async function createTabGroup(
    userId: string,
    data: { name: string; icon?: string }
): Promise<TabGroup> {
    try {
        // Get max order
        const maxOrderRow = getDb().prepare(`
            SELECT MAX(tab_order) as max_order FROM tab_groups WHERE user_id = ?
        `).get(userId) as { max_order: number | null } | undefined;

        const order = (maxOrderRow?.max_order ?? -1) + 1;
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        getDb().prepare(`
            INSERT INTO tab_groups (id, user_id, name, icon, tab_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, userId, data.name, data.icon || null, order, now);

        logger.info(`[TabGroups] Created: user=${userId} id=${id} name="${data.name}"`);

        return {
            id,
            userId,
            name: data.name,
            icon: data.icon || null,
            order,
            createdAt: new Date(now * 1000).toISOString(),
        };
    } catch (error) {
        logger.error(`[TabGroups] Failed to create: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Update a tab group
 */
export async function updateTabGroup(
    userId: string,
    groupId: string,
    updates: { name?: string; icon?: string }
): Promise<TabGroup> {
    try {
        // Verify ownership
        const existing = getDb().prepare(`
            SELECT * FROM tab_groups WHERE id = ? AND user_id = ?
        `).get(groupId, userId) as TabGroupRow | undefined;

        if (!existing) {
            throw new Error('Tab group not found');
        }

        const setClauses: string[] = [];
        const values: (string | null)[] = [];

        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            values.push(updates.name);
        }
        if (updates.icon !== undefined) {
            setClauses.push('icon = ?');
            values.push(updates.icon || null);
        }

        if (setClauses.length === 0) {
            return rowToTabGroup(existing);
        }

        values.push(groupId, userId);

        getDb().prepare(`
            UPDATE tab_groups SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?
        `).run(...values);

        logger.info(`[TabGroups] Updated: user=${userId} id=${groupId}`);

        const updated = getDb().prepare(`
            SELECT * FROM tab_groups WHERE id = ?
        `).get(groupId) as TabGroupRow;

        return rowToTabGroup(updated);
    } catch (error) {
        logger.error(`[TabGroups] Failed to update: user=${userId} id=${groupId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete a tab group
 */
export async function deleteTabGroup(userId: string, groupId: string): Promise<boolean> {
    try {
        const result = getDb().prepare(`
            DELETE FROM tab_groups WHERE id = ? AND user_id = ?
        `).run(groupId, userId);

        if (result.changes === 0) {
            throw new Error('Tab group not found');
        }

        logger.info(`[TabGroups] Deleted: user=${userId} id=${groupId}`);
        return true;
    } catch (error) {
        logger.error(`[TabGroups] Failed to delete: user=${userId} id=${groupId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Reorder tab groups
 */
export async function reorderTabGroups(userId: string, orderedIds: string[]): Promise<TabGroup[]> {
    try {
        const updateStmt = getDb().prepare(`
            UPDATE tab_groups SET tab_order = ? WHERE id = ? AND user_id = ?
        `);

        const reorder = getDb().transaction(() => {
            orderedIds.forEach((id, index) => {
                updateStmt.run(index, id, userId);
            });
        });

        reorder();
        logger.info(`[TabGroups] Reordered: user=${userId}`);

        return getUserTabGroups(userId);
    } catch (error) {
        logger.error(`[TabGroups] Failed to reorder: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Batch update tab groups (for full replacement)
 */
export async function batchUpdateTabGroups(userId: string, groups: Array<{ id: string; name: string; order?: number }>): Promise<TabGroup[]> {
    try {
        const existing = await getUserTabGroups(userId);
        const existingIds = new Set(existing.map(g => g.id));
        const newIds = new Set(groups.map(g => g.id));

        const toDelete = existing.filter(g => !newIds.has(g.id));
        const toUpdate = groups.filter(g => existingIds.has(g.id));
        const toCreate = groups.filter(g => !existingIds.has(g.id));

        const deleteStmt = getDb().prepare(`DELETE FROM tab_groups WHERE id = ? AND user_id = ?`);
        const updateStmt = getDb().prepare(`UPDATE tab_groups SET name = ?, tab_order = ? WHERE id = ? AND user_id = ?`);
        const insertStmt = getDb().prepare(`INSERT INTO tab_groups (id, user_id, name, icon, tab_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`);

        const now = Math.floor(Date.now() / 1000);

        const batch = getDb().transaction(() => {
            for (const g of toDelete) {
                deleteStmt.run(g.id, userId);
            }
            for (const g of toUpdate) {
                updateStmt.run(g.name, g.order ?? 0, g.id, userId);
            }
            for (const g of toCreate) {
                insertStmt.run(g.id, userId, g.name, null, g.order ?? 0, now);
            }
        });

        batch();
        logger.info(`[TabGroups] Batch updated: user=${userId} deleted=${toDelete.length} updated=${toUpdate.length} created=${toCreate.length}`);

        return getUserTabGroups(userId);
    } catch (error) {
        logger.error(`[TabGroups] Failed to batch update: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}
