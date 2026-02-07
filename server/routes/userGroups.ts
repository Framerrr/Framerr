/**
 * User Groups API Routes
 * 
 * Admin-only routes for managing custom user groups.
 * Groups are used in sharing workflows for bulk user selection.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    deleteGroup,
    getGroupMembers,
    addUserToGroup,
    removeUserFromGroup
} from '../db/userGroups';
import { getUserById, listUsers } from '../db/users';
import logger from '../utils/logger';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';

const router = Router();

// ============================================================================
// Group CRUD Routes
// ============================================================================

/**
 * GET /api/user-groups
 * Get all user groups with member counts.
 * Available to all authenticated users (needed for sharing UI).
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const groups = await getGroups();
        res.json({ groups });
    } catch (error) {
        logger.error(`[UserGroups] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

/**
 * GET /api/user-groups/:id
 * Get a single group with details.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const group = await getGroupById(req.params.id);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        res.json({ group });
    } catch (error) {
        logger.error(`[UserGroups] Failed to get: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

/**
 * POST /api/user-groups
 * Create a new user group.
 * Admin only.
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'Group name is required' });
            return;
        }

        if (name.trim().length > 50) {
            res.status(400).json({ error: 'Group name must be 50 characters or less' });
            return;
        }

        const group = await createGroup(name);
        invalidateSystemSettings('groups');
        res.status(201).json({ group });
    } catch (error) {
        const message = (error as Error).message;
        if (message.includes('already exists')) {
            res.status(409).json({ error: message });
            return;
        }
        logger.error(`[UserGroups] Failed to create: error="${message}"`);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

/**
 * PUT /api/user-groups/:id
 * Update a group's name.
 * Admin only.
 */
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'Group name is required' });
            return;
        }

        if (name.trim().length > 50) {
            res.status(400).json({ error: 'Group name must be 50 characters or less' });
            return;
        }

        const group = await updateGroup(req.params.id, name);
        invalidateSystemSettings('groups');
        res.json({ group });
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Group not found') {
            res.status(404).json({ error: message });
            return;
        }
        if (message.includes('already exists')) {
            res.status(409).json({ error: message });
            return;
        }
        logger.error(`[UserGroups] Failed to update: error="${message}"`);
        res.status(500).json({ error: 'Failed to update group' });
    }
});

/**
 * DELETE /api/user-groups/:id
 * Delete a group.
 * Admin only. Members are automatically removed via cascade.
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        await deleteGroup(req.params.id);
        invalidateSystemSettings('groups');
        res.json({ success: true });
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Group not found') {
            res.status(404).json({ error: message });
            return;
        }
        logger.error(`[UserGroups] Failed to delete: error="${message}"`);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

// ============================================================================
// Membership Routes
// ============================================================================

/**
 * GET /api/user-groups/:id/members
 * Get all members of a group with user details.
 */
router.get('/:id/members', requireAuth, async (req: Request, res: Response) => {
    try {
        // Verify group exists
        const group = await getGroupById(req.params.id);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }

        // Get member user IDs
        const memberIds = await getGroupMembers(req.params.id);

        // Fetch user details for each member
        const members = await Promise.all(
            memberIds.map(async (userId) => {
                const user = await getUserById(userId);
                if (user) {
                    // Return safe user data (no password hash)
                    return {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        group: user.group
                    };
                }
                return null;
            })
        );

        // Filter out any null values (deleted users)
        const validMembers = members.filter(m => m !== null);

        res.json({ members: validMembers });
    } catch (error) {
        logger.error(`[UserGroups] Failed to get members: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch group members' });
    }
});

/**
 * POST /api/user-groups/:id/members
 * Add a user to a group.
 * Admin only.
 */
router.post('/:id/members', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        if (!userId || typeof userId !== 'string') {
            res.status(400).json({ error: 'userId is required' });
            return;
        }

        // Verify group exists
        const group = await getGroupById(req.params.id);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }

        // Verify user exists
        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await addUserToGroup(userId, req.params.id);
        invalidateSystemSettings('groups');
        res.json({ success: true });
    } catch (error) {
        logger.error(`[UserGroups] Failed to add member: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

/**
 * DELETE /api/user-groups/:id/members/:userId
 * Remove a user from a group.
 * Admin only.
 */
router.delete('/:id/members/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        // Verify group exists
        const group = await getGroupById(req.params.id);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }

        await removeUserFromGroup(req.params.userId, req.params.id);
        invalidateSystemSettings('groups');
        res.json({ success: true });
    } catch (error) {
        logger.error(`[UserGroups] Failed to remove member: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

/**
 * GET /api/user-groups/with-users
 * Get all groups with full user data for each member.
 * Useful for the sharing UI that needs to display users hierarchically.
 * Admin only.
 */
router.get('/with-users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const groups = await getGroups();
        const allUsers = await listUsers();

        // Build groups with members
        const groupsWithMembers = await Promise.all(
            groups.map(async (group) => {
                const memberIds = await getGroupMembers(group.id);
                const members = allUsers
                    .filter(u => memberIds.includes(u.id))
                    .map(u => ({
                        id: u.id,
                        username: u.username,
                        displayName: u.displayName,
                        group: u.group
                    }));

                return {
                    ...group,
                    members
                };
            })
        );

        // Also include ungrouped users
        const allMemberIds = new Set(
            (await Promise.all(groups.map(g => getGroupMembers(g.id)))).flat()
        );
        const ungroupedUsers = allUsers
            .filter(u => !allMemberIds.has(u.id))
            .map(u => ({
                id: u.id,
                username: u.username,
                displayName: u.displayName,
                group: u.group
            }));

        res.json({
            groups: groupsWithMembers,
            ungrouped: ungroupedUsers
        });
    } catch (error) {
        logger.error(`[UserGroups] Failed to get groups with users: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch groups with users' });
    }
});

export default router;
