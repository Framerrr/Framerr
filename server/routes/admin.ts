import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as users from '../db/users';
import * as userGroups from '../db/userGroups';
import { hashPassword } from '../auth/password';
import logger from '../utils/logger';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';

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

        // Enforce single-admin model: cannot create additional admins
        if (group === 'admin') {
            res.status(400).json({ error: 'Cannot create additional admin users. Only one admin is allowed.' });
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

        // Prevent admin from changing their own group
        if (id === authReq.user!.id && group && group !== authReq.user!.group) {
            res.status(400).json({ error: 'Cannot change your own permission group' });
            return;
        }

        // Enforce single-admin model: cannot promote users to admin
        if (group === 'admin') {
            const targetUser = await users.getUserById(id);
            if (targetUser && targetUser.group !== 'admin') {
                res.status(400).json({ error: 'Cannot promote users to admin. Only one admin is allowed.' });
                return;
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

        const updatedUser = await users.updateUser(id, updates);

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Broadcast to admins so user list updates
        invalidateSystemSettings('users');

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

        const allUsers = await users.getAllUsers();
        const adminUsers = allUsers.filter(u => u.group === 'admin');

        // Prevent deleting the last admin
        const userToDelete = allUsers.find(u => u.id === id);
        if (userToDelete && userToDelete.group === 'admin' && adminUsers.length <= 1) {
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

