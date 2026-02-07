/**
 * Integration Shares Database Layer
 * 
 * Database-backed sharing for integrations (replaces config-based sharing).
 * Provides atomic share/unshare operations and proper audit trail.
 */

import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type ShareType = 'everyone' | 'user' | 'group';

export interface IntegrationShare {
    id: string;
    integrationName: string;
    shareType: ShareType;
    shareTarget: string | null;  // user_id, group_name, or null for 'everyone'
    sharedBy: string;
    createdAt: string;
}

interface ShareRow {
    id: string;
    integration_name: string;
    share_type: string;
    share_target: string | null;
    shared_by: string;
    created_at: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function rowToShare(row: ShareRow): IntegrationShare {
    return {
        id: row.id,
        integrationName: row.integration_name,
        shareType: row.share_type as ShareType,
        shareTarget: row.share_target,
        sharedBy: row.shared_by,
        createdAt: new Date(row.created_at * 1000).toISOString(),
    };
}

// ============================================================================
// Share Operations
// ============================================================================

/**
 * Share an integration with users, groups, or everyone.
 * 
 * @param integrationName - The integration to share (e.g., 'plex', 'sonarr')
 * @param shareType - 'everyone', 'user', or 'group'
 * @param targets - Array of user IDs or group names (empty for 'everyone')
 * @param sharedBy - Admin user ID creating the share
 * @returns Array of created share records
 */
export async function shareIntegration(
    integrationName: string,
    shareType: ShareType,
    targets: string[],
    sharedBy: string
): Promise<IntegrationShare[]> {
    const shares: IntegrationShare[] = [];

    const insert = getDb().prepare(`
        INSERT OR IGNORE INTO integration_shares (id, integration_name, share_type, share_target, shared_by)
        VALUES (?, ?, ?, ?, ?)
    `);

    if (shareType === 'everyone') {
        // Single record for 'everyone'
        const id = uuidv4();
        try {
            insert.run(id, integrationName, 'everyone', null, sharedBy);
            const created = await getShareById(id);
            if (created) shares.push(created);
            logger.info(`[IntegrationShares] Shared: integration=${integrationName} target=everyone sharedBy=${sharedBy}`);
        } catch (error) {
            if (!(error as Error).message.includes('UNIQUE constraint')) {
                throw error;
            }
            // Already shared with everyone - not an error
            logger.debug(`[IntegrationShares] Already shared: integration=${integrationName} target=everyone`);
        }
    } else {
        // Multiple records for users/groups
        for (const target of targets) {
            const id = uuidv4();
            try {
                insert.run(id, integrationName, shareType, target, sharedBy);
                const created = await getShareById(id);
                if (created) shares.push(created);
            } catch (error) {
                if (!(error as Error).message.includes('UNIQUE constraint')) {
                    throw error;
                }
                // Already shared with this target - not an error
                logger.debug(`[IntegrationShares] Already shared: integration=${integrationName} type=${shareType} target=${target}`);
            }
        }
        logger.info(`[IntegrationShares] Shared: integration=${integrationName} type=${shareType} count=${targets.length} sharedBy=${sharedBy}`);
    }

    return shares;
}

/**
 * Revoke sharing for an integration.
 * 
 * @param integrationName - The integration to unshare
 * @param shareType - Optional: only revoke this type ('everyone', 'user', 'group')
 * @param targets - Optional: only revoke for these specific targets
 * @returns Number of shares revoked
 */
export async function unshareIntegration(
    integrationName: string,
    shareType?: ShareType,
    targets?: string[]
): Promise<number> {
    let sql = 'DELETE FROM integration_shares WHERE integration_name = ?';
    const params: (string | null)[] = [integrationName];

    if (shareType) {
        sql += ' AND share_type = ?';
        params.push(shareType);

        if (targets && targets.length > 0 && shareType !== 'everyone') {
            const placeholders = targets.map(() => '?').join(', ');
            sql += ` AND share_target IN (${placeholders})`;
            params.push(...targets);
        }
    }

    const result = getDb().prepare(sql).run(...params);
    logger.info(`[IntegrationShares] Revoked: integration=${integrationName} type=${shareType || 'all'} count=${result.changes}`);

    // Cascade: If unsharing servicemonitoring, also remove per-monitor shares
    if (integrationName === 'servicemonitoring' && result.changes > 0) {
        if (shareType === 'user' && targets && targets.length > 0) {
            // Unshare specific users from all monitors
            const monitorSharePlaceholders = targets.map(() => '?').join(', ');
            const monitorResult = getDb().prepare(`
                DELETE FROM service_monitor_shares WHERE user_id IN (${monitorSharePlaceholders})
            `).run(...targets);
            logger.info(`[IntegrationShares] Cascade: removed per-monitor shares users=${targets.length} deleted=${monitorResult.changes}`);
        } else if (shareType === 'everyone' || !shareType) {
            // Unsharing everyone or all shares - remove all per-monitor shares
            const monitorResult = getDb().prepare('DELETE FROM service_monitor_shares').run();
            logger.info(`[IntegrationShares] Cascade: removed all per-monitor shares deleted=${monitorResult.changes}`);
        }
        // Note: Group unshares would need to look up users in that group first
    }

    return result.changes;
}


/**
 * Get all shares for an integration.
 */
export async function getIntegrationShares(integrationName: string): Promise<IntegrationShare[]> {
    const rows = getDb().prepare(`
        SELECT * FROM integration_shares WHERE integration_name = ?
        ORDER BY created_at ASC
    `).all(integrationName) as ShareRow[];

    return rows.map(rowToShare);
}

/**
 * Get all shared integrations grouped by integration name.
 * Used for SharedWidgetsSettings display.
 * Filters out shares for deleted users and self-shares (admin sharing with themselves).
 */
export async function getAllSharedIntegrations(): Promise<Map<string, IntegrationShare[]>> {
    // Join with users table to filter out:
    // 1. Shares for deleted users (user no longer exists)
    // 2. Self-shares (admin who created the share targeting themselves)
    // Include 'everyone' and 'group' shares always
    const rows = getDb().prepare(`
        SELECT s.* FROM integration_shares s
        LEFT JOIN users u ON s.share_type = 'user' AND s.share_target = u.id
        WHERE s.share_type != 'user' 
           OR (u.id IS NOT NULL AND s.share_target != s.shared_by)
        ORDER BY s.integration_name, s.created_at
    `).all() as ShareRow[];

    const byIntegration = new Map<string, IntegrationShare[]>();
    for (const row of rows) {
        const share = rowToShare(row);
        const existing = byIntegration.get(share.integrationName) || [];
        existing.push(share);
        byIntegration.set(share.integrationName, existing);
    }

    return byIntegration;
}

/**
 * Check if a user has access to an integration.
 * 
 * @param integrationName - Integration to check
 * @param userId - User ID
 * @param userGroup - User's group
 * @returns true if user has access
 */
export async function userHasIntegrationAccess(
    integrationName: string,
    userId: string,
    userGroup: string
): Promise<boolean> {
    // Check for 'everyone' share
    const everyoneShare = getDb().prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'everyone'
        LIMIT 1
    `).get(integrationName);

    if (everyoneShare) return true;

    // Check for direct user share
    const userShare = getDb().prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'user' AND share_target = ?
        LIMIT 1
    `).get(integrationName, userId);

    if (userShare) return true;

    // Check for group share
    const groupShare = getDb().prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'group' AND share_target = ?
        LIMIT 1
    `).get(integrationName, userGroup);

    return !!groupShare;
}

/**
 * Get all integration names that a user has access to.
 * 
 * @param userId - User ID
 * @param userGroup - User's group
 * @returns Array of integration names
 */
export async function getUserAccessibleIntegrations(
    userId: string,
    userGroup: string
): Promise<string[]> {
    const rows = getDb().prepare(`
        SELECT DISTINCT integration_name FROM integration_shares
        WHERE share_type = 'everyone'
           OR (share_type = 'user' AND share_target = ?)
           OR (share_type = 'group' AND share_target = ?)
    `).all(userId, userGroup) as { integration_name: string }[];

    return rows.map(r => r.integration_name);
}

/**
 * Get the share record that grants a specific user access to an integration.
 * Returns the most relevant share: user-specific > group > everyone
 * 
 * @param integrationName - Integration name
 * @param userId - User ID  
 * @param userGroup - User's group
 * @returns The share record or null if no access
 */
export async function getShareForUser(
    integrationName: string,
    userId: string,
    userGroup: string
): Promise<IntegrationShare | null> {
    // First check for user-specific share (most specific)
    const userShare = getDb().prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'user' AND share_target = ?
        LIMIT 1
    `).get(integrationName, userId) as ShareRow | undefined;

    if (userShare) return rowToShare(userShare);

    // Then check for group share
    const groupShare = getDb().prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'group' AND share_target = ?
        LIMIT 1
    `).get(integrationName, userGroup) as ShareRow | undefined;

    if (groupShare) return rowToShare(groupShare);

    // Finally check for 'everyone' share
    const everyoneShare = getDb().prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_name = ? AND share_type = 'everyone'
        LIMIT 1
    `).get(integrationName) as ShareRow | undefined;

    if (everyoneShare) return rowToShare(everyoneShare);

    return null;
}

/**
 * Share integrations required by a template with target users.
 * Used when sharing a template with `shareIntegrations: true`.
 * 
 * @param requiredIntegrations - Array of integration names needed by template widgets
 * @param targetUserIds - User IDs to share with
 * @param adminId - Admin performing the share
 * @returns Object with shared and alreadyShared integration names
 */
export async function shareIntegrationsForUsers(
    requiredIntegrations: string[],
    targetUserIds: string[],
    adminId: string
): Promise<{ shared: string[]; alreadyShared: string[] }> {
    const shared: string[] = [];
    const alreadyShared: string[] = [];

    for (const integration of requiredIntegrations) {
        // Check if already shared with everyone
        const everyoneShare = getDb().prepare(`
            SELECT 1 FROM integration_shares 
            WHERE integration_name = ? AND share_type = 'everyone'
            LIMIT 1
        `).get(integration);

        if (everyoneShare) {
            alreadyShared.push(integration);
            continue;
        }

        // Share with each user who doesn't already have access
        let anyNewShares = false;
        for (const userId of targetUserIds) {
            const existingShare = getDb().prepare(`
                SELECT 1 FROM integration_shares 
                WHERE integration_name = ? AND share_type = 'user' AND share_target = ?
                LIMIT 1
            `).get(integration, userId);

            if (!existingShare) {
                const id = uuidv4();
                getDb().prepare(`
                    INSERT INTO integration_shares (id, integration_name, share_type, share_target, shared_by)
                    VALUES (?, ?, 'user', ?, ?)
                `).run(id, integration, userId, adminId);
                anyNewShares = true;
            }
        }

        if (anyNewShares) {
            shared.push(integration);
        } else {
            alreadyShared.push(integration);
        }
    }

    logger.info(`[IntegrationShares] Template share: shared=${shared.length} alreadyShared=${alreadyShared.length} users=${targetUserIds.length} admin=${adminId}`);
    return { shared, alreadyShared };
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function getShareById(id: string): Promise<IntegrationShare | null> {
    const row = getDb().prepare('SELECT * FROM integration_shares WHERE id = ?').get(id) as ShareRow | undefined;
    return row ? rowToShare(row) : null;
}

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * Migrate existing config-based shares to database.
 * Should be called once after table creation.
 * 
 * @param integrations - The integrations config from systemConfig
 * @param adminId - Admin ID to use as sharedBy
 */
export async function migrateConfigSharesToDatabase(
    integrations: Record<string, {
        enabled?: boolean;
        sharing?: {
            enabled?: boolean;
            mode?: 'everyone' | 'groups' | 'users';
            groups?: string[];
            users?: string[];
            sharedBy?: string;
        }
    }>,
    adminId: string
): Promise<{ migrated: number; skipped: number }> {
    let migrated = 0;
    let skipped = 0;

    for (const [integrationName, config] of Object.entries(integrations)) {
        if (!config.enabled || !config.sharing?.enabled) {
            continue;
        }

        const sharing = config.sharing;
        const sharedBy = sharing.sharedBy || adminId;

        try {
            if (sharing.mode === 'everyone') {
                await shareIntegration(integrationName, 'everyone', [], sharedBy);
                migrated++;
            } else if (sharing.mode === 'groups' && sharing.groups?.length) {
                await shareIntegration(integrationName, 'group', sharing.groups, sharedBy);
                migrated++;
            } else if (sharing.mode === 'users' && sharing.users?.length) {
                await shareIntegration(integrationName, 'user', sharing.users, sharedBy);
                migrated++;
            } else {
                skipped++;
            }
        } catch (error) {
            logger.error(`[IntegrationShares] Migration failed: integration=${integrationName} error="${(error as Error).message}"`);
            skipped++;
        }
    }

    logger.info(`[IntegrationShares] Migration complete: migrated=${migrated} skipped=${skipped}`);
    return { migrated, skipped };
}

// ============================================================================
// Instance-Based Sharing Functions (NEW - for Phase 4)
// These functions use integration_instance_id instead of integration_name
// ============================================================================

interface InstanceShareRow extends ShareRow {
    integration_instance_id: string | null;
}

export interface IntegrationInstanceShare {
    id: string;
    integrationInstanceId: string;
    integrationName: string;  // Kept for backward compatibility
    shareType: ShareType;
    shareTarget: string | null;
    sharedBy: string;
    createdAt: string;
}

function rowToInstanceShare(row: InstanceShareRow): IntegrationInstanceShare {
    return {
        id: row.id,
        integrationInstanceId: row.integration_instance_id || '',
        integrationName: row.integration_name,
        shareType: row.share_type as ShareType,
        shareTarget: row.share_target,
        sharedBy: row.shared_by,
        createdAt: new Date(row.created_at * 1000).toISOString(),
    };
}

/**
 * Share a specific integration instance with users, groups, or everyone.
 * 
 * @param integrationInstanceId - The instance ID to share (e.g., 'plex-home')
 * @param integrationType - The integration type for backward compatibility (e.g., 'plex')
 * @param shareType - 'everyone', 'user', or 'group'
 * @param targets - Array of user IDs or group names
 * @param sharedBy - Admin user ID
 */
export async function shareIntegrationInstance(
    integrationInstanceId: string,
    integrationType: string,
    shareType: ShareType,
    targets: string[],
    sharedBy: string
): Promise<IntegrationInstanceShare[]> {
    const db = getDb();
    const created: IntegrationInstanceShare[] = [];

    if (shareType === 'everyone') {
        const id = uuidv4();
        try {
            db.prepare(`
                INSERT OR REPLACE INTO integration_shares 
                (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, ?, 'everyone', NULL, ?, strftime('%s', 'now'))
            `).run(id, integrationType, integrationInstanceId, sharedBy);

            created.push({
                id,
                integrationInstanceId,
                integrationName: integrationType,
                shareType: 'everyone',
                shareTarget: null,
                sharedBy,
                createdAt: new Date().toISOString()
            });

            logger.info(`[IntegrationShares] Shared instance: id=${integrationInstanceId} target=everyone sharedBy=${sharedBy}`);
        } catch (error) {
            logger.error(`[IntegrationShares] Failed to create everyone share: error="${(error as Error).message}"`);
            throw error;
        }
    } else {
        for (const target of targets) {
            const id = uuidv4();
            try {
                db.prepare(`
                    INSERT OR REPLACE INTO integration_shares 
                    (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
                `).run(id, integrationType, integrationInstanceId, shareType, target, sharedBy);

                created.push({
                    id,
                    integrationInstanceId,
                    integrationName: integrationType,
                    shareType,
                    shareTarget: target,
                    sharedBy,
                    createdAt: new Date().toISOString()
                });
            } catch (error) {
                logger.error(`[IntegrationShares] Failed to create share: type=${shareType} target=${target} error="${(error as Error).message}"`);
            }
        }

        logger.info(`[IntegrationShares] Shared instance: id=${integrationInstanceId} type=${shareType} count=${created.length} sharedBy=${sharedBy}`);
    }

    return created;
}

/**
 * Revoke sharing for a specific integration instance.
 */
export async function unshareIntegrationInstance(
    integrationInstanceId: string,
    shareType?: ShareType,
    targets?: string[]
): Promise<number> {
    const db = getDb();

    if (!shareType) {
        const result = db.prepare(`
            DELETE FROM integration_shares WHERE integration_instance_id = ?
        `).run(integrationInstanceId);

        logger.info(`[IntegrationShares] Revoked instance shares: id=${integrationInstanceId} count=${result.changes}`);
        return result.changes;
    }

    if (shareType === 'everyone') {
        const result = db.prepare(`
            DELETE FROM integration_shares 
            WHERE integration_instance_id = ? AND share_type = 'everyone'
        `).run(integrationInstanceId);

        return result.changes;
    }

    if (!targets || targets.length === 0) {
        const result = db.prepare(`
            DELETE FROM integration_shares 
            WHERE integration_instance_id = ? AND share_type = ?
        `).run(integrationInstanceId, shareType);

        return result.changes;
    }

    let totalRevoked = 0;
    for (const target of targets) {
        const result = db.prepare(`
            DELETE FROM integration_shares 
            WHERE integration_instance_id = ? AND share_type = ? AND share_target = ?
        `).run(integrationInstanceId, shareType, target);
        totalRevoked += result.changes;
    }

    return totalRevoked;
}

/**
 * Check if a user has access to a specific integration instance.
 */
export async function userHasIntegrationInstanceAccess(
    integrationInstanceId: string,
    userId: string,
    userGroup: string
): Promise<boolean> {
    const db = getDb();

    // Check for 'everyone' share
    const everyoneShare = db.prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'everyone'
        LIMIT 1
    `).get(integrationInstanceId);

    if (everyoneShare) return true;

    // Check for direct user share
    const userShare = db.prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'user' AND share_target = ?
        LIMIT 1
    `).get(integrationInstanceId, userId);

    if (userShare) return true;

    // Check for group share
    const groupShare = db.prepare(`
        SELECT 1 FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'group' AND share_target = ?
        LIMIT 1
    `).get(integrationInstanceId, userGroup);

    return !!groupShare;
}

/**
 * Get the share record that grants a specific user access to an integration instance.
 * Returns the most relevant share: user-specific > group > everyone
 * 
 * @param integrationInstanceId - Instance ID
 * @param userId - User ID  
 * @param userGroup - User's group
 * @returns The share record or null if no access
 */
export async function getInstanceShareForUser(
    integrationInstanceId: string,
    userId: string,
    userGroup: string
): Promise<IntegrationInstanceShare | null> {
    const db = getDb();

    // First check for user-specific share (most specific)
    const userShare = db.prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'user' AND share_target = ?
        LIMIT 1
    `).get(integrationInstanceId, userId) as InstanceShareRow | undefined;

    if (userShare) return rowToInstanceShare(userShare);

    // Then check for group share
    const groupShare = db.prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'group' AND share_target = ?
        LIMIT 1
    `).get(integrationInstanceId, userGroup) as InstanceShareRow | undefined;

    if (groupShare) return rowToInstanceShare(groupShare);

    // Finally check for 'everyone' share
    const everyoneShare = db.prepare(`
        SELECT * FROM integration_shares 
        WHERE integration_instance_id = ? AND share_type = 'everyone'
        LIMIT 1
    `).get(integrationInstanceId) as InstanceShareRow | undefined;

    if (everyoneShare) return rowToInstanceShare(everyoneShare);

    return null;
}

/**
 * Get all integration instance IDs that a user has access to.
 */
export async function getUserAccessibleIntegrationInstances(
    userId: string,
    userGroup: string
): Promise<string[]> {
    const db = getDb();

    const rows = db.prepare(`
        SELECT DISTINCT integration_instance_id FROM integration_shares
        WHERE integration_instance_id IS NOT NULL
          AND (share_type = 'everyone'
               OR (share_type = 'user' AND share_target = ?)
               OR (share_type = 'group' AND share_target = ?))
    `).all(userId, userGroup) as { integration_instance_id: string }[];

    return rows.map(r => r.integration_instance_id);
}

/**
 * Get all instance shares for a specific integration instance.
 */
export async function getIntegrationInstanceShares(
    integrationInstanceId: string
): Promise<IntegrationInstanceShare[]> {
    const db = getDb();
    const rows = db.prepare(`
        SELECT * FROM integration_shares WHERE integration_instance_id = ?
    `).all(integrationInstanceId) as InstanceShareRow[];

    return rows.map(rowToInstanceShare);
}

/**
 * Bulk update shares for a specific integration instance.
 */
export async function bulkUpdateIntegrationInstanceShares(
    integrationInstanceId: string,
    integrationType: string,
    userShares: string[],
    groupShares: string[],
    everyoneShare: boolean,
    sharedBy: string
): Promise<void> {
    const db = getDb();

    db.exec('BEGIN TRANSACTION');

    try {
        // Delete all existing shares for this instance
        db.prepare(`DELETE FROM integration_shares WHERE integration_instance_id = ?`).run(integrationInstanceId);

        // Create new shares
        if (everyoneShare) {
            db.prepare(`
                INSERT INTO integration_shares (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, ?, 'everyone', NULL, ?, strftime('%s', 'now'))
            `).run(uuidv4(), integrationType, integrationInstanceId, sharedBy);
        }

        for (const userId of userShares) {
            db.prepare(`
                INSERT INTO integration_shares (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, ?, 'user', ?, ?, strftime('%s', 'now'))
            `).run(uuidv4(), integrationType, integrationInstanceId, userId, sharedBy);
        }

        for (const groupName of groupShares) {
            db.prepare(`
                INSERT INTO integration_shares (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                VALUES (?, ?, ?, 'group', ?, ?, strftime('%s', 'now'))
            `).run(uuidv4(), integrationType, integrationInstanceId, groupName, sharedBy);
        }

        db.exec('COMMIT');
        logger.info(`[IntegrationShares] Bulk updated instance: id=${integrationInstanceId} users=${userShares.length} groups=${groupShares.length} everyone=${everyoneShare}`);
    } catch (error) {
        db.exec('ROLLBACK');
        logger.error(`[IntegrationShares] Bulk update failed: error="${(error as Error).message}"`);
        throw error;
    }
}

