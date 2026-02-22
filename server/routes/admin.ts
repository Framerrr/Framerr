import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as users from '../db/users';
import * as userGroups from '../db/userGroups';
import { hashPassword } from '../auth/password';
import logger from '../utils/logger';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';
import { setHasLocalPassword } from '../db/users';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface CreateUserBody {
    username: string;
    email?: string;
    password: string;
    group?: string;
}

interface UpdateUserBody {
    username?: string;
    email?: string;
    password?: string;
    group?: string;
}

// All admin routes require authentication and admin privileges
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/users - List all users
router.get('/users', async (req: Request, res: Response) => {
    try {
        // Use listUsers which includes profilePictureUrl via JOIN
        const allUsers = await users.listUsers();

        res.json({ users: allUsers });
    } catch (error) {
        logger.error(`[Admin] Failed to fetch users: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/admin/users - Create new user
router.post('/users', async (req: Request, res: Response) => {
    try {
        const { username, email, password, group } = req.body as CreateUserBody;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        const newUser = await users.createUser({
            username,
            email,
            passwordHash,
            group: group || 'user'
        });

        // Broadcast to admins so user list updates
        invalidateSystemSettings('users');

        res.status(201).json({ user: newUser });
    } catch (error) {
        logger.error(`[Admin] Failed to create user: error="${(error as Error).message}"`);
        res.status(400).json({ error: (error as Error).message || 'Failed to create user' });
    }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { id } = req.params;
        const { username, email, password, group } = req.body as UpdateUserBody;

        // Guard: prevent demoting the last admin
        if (group && group !== 'admin') {
            const targetUser = await users.getUserById(id);
            if (targetUser && targetUser.group === 'admin') {
                const adminCount = users.getAdminCount();
                if (adminCount <= 1) {
                    res.status(400).json({ error: 'Cannot demote the last admin. Promote another user first.' });
                    return;
                }
            }
        }

        const updates: { username?: string; email?: string; group?: string; passwordHash?: string } = {
            username,
            email,
            group
        };

        // Only update password if provided
        if (password && password.trim() !== '') {
            updates.passwordHash = await hashPassword(password);
        }

        // Track if we're setting a password (to flip has_local_password after save)
        const isSettingPassword = !!(password && password.trim() !== '');

        // Capture old role before update (for session revocation)
        const oldUser = group ? await users.getUserById(id) : null;

        const updatedUser = await users.updateUser(id, updates);

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // If role changed, revoke all sessions so user re-authenticates with correct role
        if (oldUser && oldUser.group !== group) {
            await users.revokeAllUserSessions(id);
            logger.info(`[Admin] Role changed for user ${id}: ${oldUser.group} → ${group}, all sessions revoked`);
        }

        // If admin set a password, mark user as having a local password
        if (isSettingPassword) {
            setHasLocalPassword(id, true);
        }

        // Broadcast to admins so user list updates
        invalidateSystemSettings('users');
        invalidateSystemSettings('groups');

        res.json({ user: updatedUser });
    } catch (error) {
        logger.error(`[Admin] Failed to update user: error="${(error as Error).message}"`);
        res.status(400).json({ error: (error as Error).message || 'Failed to update user' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { id } = req.params;

        // Prevent deleting yourself
        if (id === authReq.user!.id) {
            res.status(400).json({ error: 'Cannot delete your own account' });
            return;
        }

        // Prevent deleting the last admin
        const userToDelete = await users.getUserById(id);
        if (userToDelete && userToDelete.group === 'admin' && users.getAdminCount() <= 1) {
            res.status(400).json({ error: 'Cannot delete the last admin user' });
            return;
        }

        const success = await users.deleteUser(id);

        if (!success) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Broadcast to admins so user list and widget shares update
        invalidateSystemSettings('users');
        invalidateSystemSettings('widget-shares');
        invalidateSystemSettings('groups');

        res.json({ success: true });
    } catch (error) {
        logger.error(`[Admin] Failed to delete user: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// POST /api/admin/users/:id/reset-password - Reset user password
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await users.resetUserPassword(id);

        res.json(result);
    } catch (error) {
        logger.error(`[Admin] Failed to reset password: error="${(error as Error).message}"`);
        res.status(400).json({ error: (error as Error).message || 'Failed to reset password' });
    }
});

// GET /api/admin/users/:id/groups - Get groups a user belongs to
router.get('/users/:id/groups', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Verify user exists
        const user = await users.getUserById(id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const groups = await userGroups.getUserGroups(id);
        res.json({ groups });
    } catch (error) {
        logger.error(`[Admin] Failed to fetch user groups: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch user groups' });
    }
});

// PUT /api/admin/users/:id/groups - Set groups a user belongs to
router.put('/users/:id/groups', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { groupIds } = req.body as { groupIds?: string[] };

        // Verify user exists
        const user = await users.getUserById(id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Set user's group memberships (replaces existing)
        await userGroups.setUserGroups(id, groupIds || []);

        res.json({ success: true });
    } catch (error) {
        logger.error(`[Admin] Failed to set user groups: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to set user groups' });
    }
});

export default router;

