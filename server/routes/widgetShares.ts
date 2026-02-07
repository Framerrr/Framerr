/**
 * Widget Shares API Routes
 * 
 * Endpoints for managing widget type sharing.
 * Works alongside integration shares for the dual-table sharing model.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as widgetSharesDb from '../db/widgetShares';
import * as integrationSharesDb from '../db/integrationShares';
import * as integrationInstancesDb from '../db/integrationInstances';
import * as usersDb from '../db/users';
import * as userGroupsDb from '../db/userGroups';
import logger from '../utils/logger';
import { invalidateUserSettings, invalidateSystemSettings } from '../utils/invalidateUserSettings';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// Widget Shares Endpoints
// ============================================================================

/**
 * GET /api/widget-shares
 * Get all widget shares (admin only)
 */
router.get('/', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        const sharesMap = await widgetSharesDb.getAllWidgetShares();
        const result: Record<string, widgetSharesDb.WidgetShare[]> = {};

        sharesMap.forEach((shares, widgetType) => {
            result[widgetType] = shares;
        });

        res.json({ shares: result });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get shares: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get widget shares' });
    }
});

// ============================================================================
// IMPORTANT: Static routes MUST come before parameterized routes (/:widgetType)
// Otherwise Express will match /my-access as a widgetType parameter!
// ============================================================================

/**
 * GET /api/widget-shares/my-access
 * Get widget types and integration instances the current user has access to
 */
router.get('/my-access', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const userGroup = req.user!.group;

        // If admin, return all (admins have full access)
        if (userGroup === 'admin') {
            res.json({
                widgets: 'all',
                integrations: 'all',
                integrationTypes: 'all'
            });
            return;
        }

        // Get accessible widget types
        const widgets = await widgetSharesDb.getUserAccessibleWidgets(userId, userGroup);

        // Get accessible integration instance IDs
        const integrationIds = await integrationSharesDb.getUserAccessibleIntegrationInstances(userId, userGroup);

        // Get the types of those instances for frontend widget filtering
        const integrationTypes: string[] = [];
        for (const instanceId of integrationIds) {
            const instance = await integrationInstancesDb.getInstanceById(instanceId);
            if (instance && !integrationTypes.includes(instance.type)) {
                integrationTypes.push(instance.type);
            }
        }

        // DEBUG: Log what we're returning
        logger.debug(`[WidgetSharesAPI] my-access: user=${userId} group=${userGroup} widgets=[${widgets.join(',')}] integrations=${integrationIds.length}`);

        res.json({
            widgets,
            integrations: integrationIds,
            integrationTypes  // Types for matching against widget.compatibleIntegrations
        });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get user access: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get access information' });
    }
});

/**
 * GET /api/widget-shares/admin/users-and-groups
 * Get all users and groups for the share modal (admin only)
 * Uses social groups (user_groups table) for organization
 */
router.get('/admin/users-and-groups', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        // Get all non-admin users
        const allUsers = await usersDb.listUsers();
        const nonAdminUsers = allUsers.filter(u => u.group !== 'admin');

        // Get social groups from user_groups table
        const socialGroups = await userGroupsDb.getGroups();

        // Get group membership for all users at once
        const userIds = nonAdminUsers.map(u => u.id);
        const membershipMap = await userGroupsDb.getBulkUserGroups(userIds);

        // Build user data helper
        const toUserData = (user: typeof nonAdminUsers[0]) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            profilePictureUrl: user.profilePictureUrl
        });

        // Build groups array - each group contains users who are members
        // Users can appear in multiple groups if they have multiple memberships
        // Filter out empty groups (no users) so they don't render in UI
        const groups = socialGroups
            .map(g => ({
                id: g.id,
                name: g.name,
                users: nonAdminUsers
                    .filter(u => membershipMap.get(u.id)?.includes(g.id))
                    .map(toUserData)
            }))
            .filter(g => g.users.length > 0);

        // Ungrouped users = users not in any social group
        const ungroupedUsers = nonAdminUsers
            .filter(u => (membershipMap.get(u.id)?.length ?? 0) === 0)
            .map(toUserData);

        res.json({ groups, ungroupedUsers });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get users/groups: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get users and groups' });
    }
});

/**
 * GET /api/widget-shares/admin/all
 * Get all widget shares across all widget types for the Shared Widgets settings page (admin only)
 * Returns a map of widgetType -> { shares, userCount, groupCount, hasEveryoneShare }
 */
router.get('/admin/all', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        // Get all widget shares from DB
        const allSharesMap = await widgetSharesDb.getAllWidgetShares();

        // Build response with aggregated data per widget type
        const result: Record<string, {
            shares: widgetSharesDb.WidgetShare[];
            userCount: number;
            groupCount: number;
            hasEveryoneShare: boolean;
        }> = {};

        allSharesMap.forEach((shares, widgetType) => {
            const userShares = shares.filter(s => s.shareType === 'user');
            const groupShares = shares.filter(s => s.shareType === 'group');
            const hasEveryoneShare = shares.some(s => s.shareType === 'everyone');

            result[widgetType] = {
                shares,
                userCount: userShares.length,
                groupCount: groupShares.length,
                hasEveryoneShare
            };
        });

        res.json({ widgetShares: result });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get all shares: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get all widget shares' });
    }
});

/**
 * GET /api/widget-shares/admin/existing/:widgetType
 * Get existing shares for a widget type for pre-populating the modal (admin only)
 */
router.get('/admin/existing/:widgetType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { widgetType } = req.params;

        // P4 Pattern: Frontend passes compatible types from plugin definition
        // This eliminates the need for WIDGET_INTEGRATION_MAP sync between frontend and backend
        const compatibleTypesParam = req.query.compatibleTypes as string | undefined;
        const compatibleTypesList = compatibleTypesParam
            ? compatibleTypesParam.split(',').filter(t => t.trim())
            : [];

        // Get widget shares
        const widgetShares = await widgetSharesDb.getWidgetShares(widgetType);

        // Build a map of userId -> { checked, integrations }
        const userStates: Record<string, { checked: boolean; integrations: string[] }> = {};

        for (const share of widgetShares) {
            if (share.shareType === 'user' && share.shareTarget) {
                if (!userStates[share.shareTarget]) {
                    userStates[share.shareTarget] = { checked: true, integrations: [] };
                } else {
                    userStates[share.shareTarget].checked = true;
                }
            }
        }

        // Fetch integration instance shares for each user who has a widget share
        // ONLY include instances whose type is compatible with this widget
        const { getDb } = require('../database/db');
        const db = getDb();

        for (const userId of Object.keys(userStates)) {
            if (compatibleTypesList.length === 0) {
                // Widget doesn't require any integrations
                userStates[userId].integrations = [];
                continue;
            }

            // Query with type filter via JOIN to integration_instances
            const placeholders = compatibleTypesList.map(() => '?').join(',');
            const rows = db.prepare(`
                SELECT DISTINCT s.integration_instance_id 
                FROM integration_shares s
                JOIN integration_instances i ON s.integration_instance_id = i.id
                WHERE s.share_type = 'user' 
                  AND s.share_target = ? 
                  AND s.integration_instance_id IS NOT NULL
                  AND i.type IN (${placeholders})
            `).all(userId, ...compatibleTypesList) as { integration_instance_id: string }[];

            userStates[userId].integrations = rows.map(r => r.integration_instance_id);
        }

        res.json({
            widgetShares,
            userStates,
            hasEveryoneShare: widgetShares.some(s => s.shareType === 'everyone'),
            groupShares: widgetShares.filter(s => s.shareType === 'group').map(s => s.shareTarget)
        });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get existing: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get existing shares' });
    }
});

/**
 * DELETE /api/widget-shares/all
 * Revoke ALL widget shares AND integration shares globally (admin only)
 * This is a destructive operation that clears all sharing permissions.
 */
router.delete('/all', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { getDb } = require('../database/db');
        const db = getDb();

        // Get counts before deletion for logging
        const widgetShareCount = (db.prepare('SELECT COUNT(*) as count FROM widget_shares').get() as { count: number }).count;
        const integrationShareCount = (db.prepare('SELECT COUNT(*) as count FROM integration_shares').get() as { count: number }).count;

        // Get affected user IDs for SSE broadcast
        const affectedUserIds = db.prepare(`
            SELECT DISTINCT share_target FROM widget_shares WHERE share_type = 'user'
            UNION
            SELECT DISTINCT share_target FROM integration_shares WHERE share_type = 'user'
        `).all() as { share_target: string }[];

        // Delete all widget shares
        db.prepare('DELETE FROM widget_shares').run();

        // Delete all integration shares
        db.prepare('DELETE FROM integration_shares').run();

        // Broadcast to all affected users
        for (const row of affectedUserIds) {
            if (row.share_target) {
                invalidateUserSettings(row.share_target, 'permissions');
                invalidateUserSettings(row.share_target, 'notifications');  // Also update notification settings
            }
        }

        // Broadcast to all admins so their Shared Widgets page updates
        invalidateSystemSettings('widget-shares');

        const totalRevoked = widgetShareCount + integrationShareCount;
        logger.info(`[WidgetSharesAPI] Revoked all: widgets=${widgetShareCount} integrations=${integrationShareCount} users=${affectedUserIds.length}`);

        res.json({ success: true, revoked: totalRevoked });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to revoke all: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to revoke all shares' });
    }
});

// ============================================================================
// Parameterized routes MUST come AFTER static routes
// ============================================================================

/**
 * GET /api/widget-shares/:widgetType
 * Get shares for a specific widget type (admin only)
 */
router.get('/:widgetType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { widgetType } = req.params;
        const shares = await widgetSharesDb.getWidgetShares(widgetType);
        res.json({ shares });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to get shares: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get widget shares' });
    }
});

/**
 * POST /api/widget-shares/:widgetType
 * Update shares for a widget type (admin only)
 * 
 * Body: {
 *   userShares: string[],      // User IDs to share widget with
 *   groupShares: string[],     // Group names to share widget with
 *   everyoneShare: boolean,    // Whether to share with everyone
 *   integrationShares: {       // Integration shares per user
 *     [userId: string]: string[]  // Array of integration instance IDs
 *   }
 * }
 */
router.post('/:widgetType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { widgetType } = req.params;
        const {
            userShares = [],
            groupShares = [],
            everyoneShare = false,
            integrationShares = {},
            compatibleTypes = []  // P4 Pattern: Frontend passes from plugin
        } = req.body;
        const adminId = req.user!.id;

        // Get existing widget shares BEFORE updating (to know who to revoke)
        const existingShares = await widgetSharesDb.getWidgetShares(widgetType);
        const previousUserIds = existingShares
            .filter(s => s.shareType === 'user' && s.shareTarget)
            .map(s => s.shareTarget as string);

        // Update widget shares (replaces all existing)
        await widgetSharesDb.bulkUpdateWidgetShares(
            widgetType,
            userShares,
            groupShares,
            everyoneShare,
            adminId
        );

        // Determine users who were removed
        const removedUsers = previousUserIds.filter(id => !userShares.includes(id));

        // Revoke integration shares for removed users
        // Only revoke integrations that are compatible with THIS widget type
        const { getDb } = require('../database/db');
        const db = getDb();

        // P4 Pattern: Use frontend-provided compatible types instead of map lookup
        const compatibleTypesList: string[] = Array.isArray(compatibleTypes) ? compatibleTypes : [];

        for (const userId of removedUsers) {
            if (compatibleTypesList.length === 0) continue; // Widget doesn't need integrations

            // Get integration instance IDs currently shared with this user - only compatible types
            const placeholders = compatibleTypesList.map(() => '?').join(',');
            const currentShares = db.prepare(`
                SELECT DISTINCT s.integration_instance_id 
                FROM integration_shares s
                JOIN integration_instances i ON s.integration_instance_id = i.id
                WHERE s.share_type = 'user' 
                  AND s.share_target = ? 
                  AND s.integration_instance_id IS NOT NULL
                  AND i.type IN (${placeholders})
            `).all(userId, ...compatibleTypesList) as { integration_instance_id: string }[];

            // Revoke each one
            for (const row of currentShares) {
                await integrationSharesDb.unshareIntegrationInstance(
                    row.integration_instance_id,
                    'user',
                    [userId]
                );
            }
        }

        // Sync integration shares for users who remain
        // For each user in userShares, set their integrations to exactly what's in integrationShares
        // CRITICAL: Only compare/remove integrations that are compatible with THIS widget type
        // Otherwise saving shares for Widget A would accidentally remove shares for Widget B
        // (compatibleTypesList already computed above)

        for (const userId of userShares) {
            const newInstanceIds: string[] = (integrationShares as Record<string, string[]>)[userId] || [];

            // Get current integration shares for this user - ONLY compatible types
            let currentInstanceIds: string[] = [];

            if (compatibleTypesList.length > 0) {
                const placeholders = compatibleTypesList.map(() => '?').join(',');
                const currentShares = db.prepare(`
                    SELECT DISTINCT s.integration_instance_id 
                    FROM integration_shares s
                    JOIN integration_instances i ON s.integration_instance_id = i.id
                    WHERE s.share_type = 'user' 
                      AND s.share_target = ? 
                      AND s.integration_instance_id IS NOT NULL
                      AND i.type IN (${placeholders})
                `).all(userId, ...compatibleTypesList) as { integration_instance_id: string }[];
                currentInstanceIds = currentShares.map(r => r.integration_instance_id);
            }

            // Remove integrations not in new list (only from compatible types)
            const toRemove = currentInstanceIds.filter(id => !newInstanceIds.includes(id));
            for (const instanceId of toRemove) {
                await integrationSharesDb.unshareIntegrationInstance(instanceId, 'user', [userId]);
            }

            // Add integrations in new list but not in current
            const toAdd = newInstanceIds.filter(id => !currentInstanceIds.includes(id));
            for (const instanceId of toAdd) {
                const instance = await integrationInstancesDb.getInstanceById(instanceId);
                if (!instance) continue;

                await integrationSharesDb.shareIntegrationInstance(
                    instanceId,
                    instance.type,
                    'user',
                    [userId],
                    adminId
                );
            }

            // Phase 24: Broadcast to user if their integration access changed
            // This enables real-time UI updates for integration dropdown changes
            if (toRemove.length > 0 || toAdd.length > 0) {
                invalidateUserSettings(userId, 'permissions');
                invalidateUserSettings(userId, 'notifications');  // Also update notification settings
            }
        }

        logger.info(`[WidgetSharesAPI] Updated: widget=${widgetType} users=${userShares.length} groups=${groupShares.length} everyone=${everyoneShare}`);

        // P1 Phase 8: Broadcast permission changes to affected users
        // Users who gained access
        const addedUsers = (userShares as string[]).filter((id: string) => !previousUserIds.includes(id));
        for (const userId of addedUsers) {
            invalidateUserSettings(userId, 'permissions');
            invalidateUserSettings(userId, 'notifications');  // Also update notification settings
        }
        // Users who lost access
        for (const userId of removedUsers) {
            invalidateUserSettings(userId, 'permissions');
            invalidateUserSettings(userId, 'notifications');  // Also update notification settings
        }

        // Broadcast to all admins so their Shared Widgets page updates
        invalidateSystemSettings('widget-shares');

        res.json({ success: true });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to update: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update widget shares' });
    }
});

/**
 * DELETE /api/widget-shares/:widgetType
 * Revoke all shares for a widget type (admin only)
 */
router.delete('/:widgetType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { widgetType } = req.params;

        // P1 Phase 8: Get affected users BEFORE deletion for broadcasting
        const existingShares = await widgetSharesDb.getWidgetShares(widgetType);
        const affectedUserIds = existingShares
            .filter(s => s.shareType === 'user' && s.shareTarget)
            .map(s => s.shareTarget as string);

        const revoked = await widgetSharesDb.unshareWidgetType(widgetType);

        // Broadcast to all affected users
        for (const userId of affectedUserIds) {
            invalidateUserSettings(userId, 'permissions');
            invalidateUserSettings(userId, 'notifications');  // Also update notification settings
        }

        // Broadcast to all admins so their Shared Widgets page updates
        invalidateSystemSettings('widget-shares');

        logger.info(`[WidgetSharesAPI] Revoked: widget=${widgetType} count=${revoked}`);
        res.json({ success: true, revoked });
    } catch (error) {
        logger.error(`[WidgetSharesAPI] Failed to revoke: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to revoke widget shares' });
    }
});

export default router;
