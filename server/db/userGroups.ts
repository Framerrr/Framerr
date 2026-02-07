/**
 * User Groups Database Layer
 * 
 * Manages custom user groups for sharing workflows.
 * Groups are UI convenience - shares are stored per-user, not per-group.
 * 
 * Tables (from migration 0020):
 * - user_groups: id, name, created_at
 * - user_group_members: user_id, group_id (many-to-many junction)
 */

import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UserGroup {
    id: string;
    name: string;
    createdAt: string;
    memberCount?: number;
}

export interface UserGroupMember {
    userId: string;
    groupId: string;
}

interface GroupRow {
    id: string;
    name: string;
    created_at: number;
    member_count?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function rowToGroup(row: GroupRow): UserGroup {
    return {
        id: row.id,
        name: row.name,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        memberCount: row.member_count ?? undefined
    };
}

// ============================================================================
// Group CRUD Operations
// ============================================================================

/**
 * Create a new user group.
 * 
 * @param name - Group name (must be unique)
 * @returns Created group
 */
export async function createGroup(name: string): Promise<UserGroup> {
    const db = getDb();
    const id = uuidv4();

    try {
        const stmt = db.prepare(`
            INSERT INTO user_groups (id, name)
            VALUES (?, ?)
        `);
        stmt.run(id, name.trim());

        logger.info(`[UserGroups] Created: id=${id} name="${name}"`);

        return {
            id,
            name: name.trim(),
            createdAt: new Date().toISOString(),
            memberCount: 0
        };
    } catch (error) {
        if ((error as Error).message.includes('UNIQUE constraint failed')) {
            throw new Error(`Group name "${name}" already exists`);
        }
        throw error;
    }
}

/**
 * Get all user groups with member counts.
 * 
 * @returns Array of groups with member counts
 */
export async function getGroups(): Promise<UserGroup[]> {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT 
            g.id,
            g.name,
            g.created_at,
            COUNT(m.user_id) as member_count
        FROM user_groups g
        LEFT JOIN user_group_members m ON g.id = m.group_id
        GROUP BY g.id
        ORDER BY g.name ASC
    `);

    const rows = stmt.all() as GroupRow[];
    return rows.map(rowToGroup);
}

/**
 * Get a single group by ID.
 * 
 * @param id - Group ID
 * @returns Group or null if not found
 */
export async function getGroupById(id: string): Promise<UserGroup | null> {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT 
            g.id,
            g.name,
            g.created_at,
            COUNT(m.user_id) as member_count
        FROM user_groups g
        LEFT JOIN user_group_members m ON g.id = m.group_id
        WHERE g.id = ?
        GROUP BY g.id
    `);

    const row = stmt.get(id) as GroupRow | undefined;
    return row ? rowToGroup(row) : null;
}

/**
 * Update a group's name.
 * 
 * @param id - Group ID
 * @param name - New group name
 * @returns Updated group
 */
export async function updateGroup(id: string, name: string): Promise<UserGroup> {
    const db = getDb();

    try {
        const stmt = db.prepare(`
            UPDATE user_groups
            SET name = ?
            WHERE id = ?
        `);
        const result = stmt.run(name.trim(), id);

        if (result.changes === 0) {
            throw new Error('Group not found');
        }

        logger.info(`[UserGroups] Updated: id=${id} name="${name}"`);

        const group = await getGroupById(id);
        if (!group) {
            throw new Error('Group not found after update');
        }
        return group;
    } catch (error) {
        if ((error as Error).message.includes('UNIQUE constraint failed')) {
            throw new Error(`Group name "${name}" already exists`);
        }
        throw error;
    }
}

/**
 * Delete a group.
 * Members are automatically removed via ON DELETE CASCADE.
 * 
 * @param id - Group ID
 */
export async function deleteGroup(id: string): Promise<void> {
    const db = getDb();

    const stmt = db.prepare(`DELETE FROM user_groups WHERE id = ?`);
    const result = stmt.run(id);

    if (result.changes === 0) {
        throw new Error('Group not found');
    }

    logger.info(`[UserGroups] Deleted: id=${id}`);
}

// ============================================================================
// Membership Operations
// ============================================================================

/**
 * Add a user to a group.
 * 
 * @param userId - User ID
 * @param groupId - Group ID
 */
export async function addUserToGroup(userId: string, groupId: string): Promise<void> {
    const db = getDb();

    try {
        const stmt = db.prepare(`
            INSERT INTO user_group_members (user_id, group_id)
            VALUES (?, ?)
        `);
        stmt.run(userId, groupId);

        logger.debug(`[UserGroups] Added user: user=${userId} group=${groupId}`);
    } catch (error) {
        // Ignore duplicate - user already in group
        if ((error as Error).message.includes('UNIQUE constraint failed') ||
            (error as Error).message.includes('PRIMARY KEY constraint failed')) {
            return;
        }
        throw error;
    }
}

/**
 * Remove a user from a group.
 * 
 * @param userId - User ID
 * @param groupId - Group ID
 */
export async function removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    const db = getDb();

    const stmt = db.prepare(`
        DELETE FROM user_group_members
        WHERE user_id = ? AND group_id = ?
    `);
    stmt.run(userId, groupId);

    logger.debug(`[UserGroups] Removed user: user=${userId} group=${groupId}`);
}

/**
 * Get all groups that a user belongs to.
 * 
 * @param userId - User ID
 * @returns Array of groups
 */
export async function getUserGroups(userId: string): Promise<UserGroup[]> {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT 
            g.id,
            g.name,
            g.created_at,
            (SELECT COUNT(*) FROM user_group_members WHERE group_id = g.id) as member_count
        FROM user_groups g
        INNER JOIN user_group_members m ON g.id = m.group_id
        WHERE m.user_id = ?
        ORDER BY g.name ASC
    `);

    const rows = stmt.all(userId) as GroupRow[];
    return rows.map(rowToGroup);
}

/**
 * Get all members of a group.
 * Returns user IDs only - caller can fetch full user data as needed.
 * 
 * @param groupId - Group ID
 * @returns Array of user IDs
 */
export async function getGroupMembers(groupId: string): Promise<string[]> {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT user_id
        FROM user_group_members
        WHERE group_id = ?
    `);

    interface MemberRow { user_id: string }
    const rows = stmt.all(groupId) as MemberRow[];
    return rows.map(row => row.user_id);
}

/**
 * Set a user's group memberships.
 * Replaces all existing memberships with the provided list.
 * 
 * @param userId - User ID
 * @param groupIds - Array of group IDs to assign
 */
export async function setUserGroups(userId: string, groupIds: string[]): Promise<void> {
    const db = getDb();

    // Use transaction for atomicity
    const deleteStmt = db.prepare(`DELETE FROM user_group_members WHERE user_id = ?`);
    const insertStmt = db.prepare(`INSERT INTO user_group_members (user_id, group_id) VALUES (?, ?)`);

    const transaction = db.transaction(() => {
        deleteStmt.run(userId);
        for (const groupId of groupIds) {
            insertStmt.run(userId, groupId);
        }
    });

    transaction();

    logger.info(`[UserGroups] Set groups: user=${userId} groups=[${groupIds.join(',')}]`);
}

/**
 * Get all group memberships for multiple users.
 * Useful for bulk operations (e.g., user list display).
 * 
 * @param userIds - Array of user IDs
 * @returns Map of userId -> array of group IDs
 */
export async function getBulkUserGroups(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) {
        return new Map();
    }

    const db = getDb();
    const placeholders = userIds.map(() => '?').join(',');

    const stmt = db.prepare(`
        SELECT user_id, group_id
        FROM user_group_members
        WHERE user_id IN (${placeholders})
    `);

    interface MembershipRow { user_id: string; group_id: string }
    const rows = stmt.all(...userIds) as MembershipRow[];

    const result = new Map<string, string[]>();
    for (const userId of userIds) {
        result.set(userId, []);
    }
    for (const row of rows) {
        result.get(row.user_id)?.push(row.group_id);
    }

    return result;
}
