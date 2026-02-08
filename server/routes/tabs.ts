import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getUserTabs, addUserTab, updateUserTab, deleteUserTab, reorderUserTabs } from '../db/userConfig';
import logger from '../utils/logger';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface TabBody {
    name?: string;
    url?: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
}

interface ReorderBody {
    orderedIds: string[];
}

interface TabUpdate {
    name?: string;
    url?: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
}

/**
 * GET /api/tabs
 * Get current user's personal tabs
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const tabs = await getUserTabs(authReq.user!.id);
        res.json({ tabs });
    } catch (error) {
        logger.error(`[Tabs] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch tabs' });
    }
});

/**
 * PUT /api/tabs/reorder
 * Reorder user's tabs
 */
router.put('/reorder', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { orderedIds } = req.body as ReorderBody;

        if (!Array.isArray(orderedIds)) {
            res.status(400).json({ error: 'orderedIds must be an array' });
            return;
        }

        const tabs = await reorderUserTabs(authReq.user!.id, orderedIds);
        invalidateUserSettings(authReq.user!.id, 'tabs');

        res.json({ tabs });
    } catch (error) {
        logger.error(`[Tabs] Failed to reorder: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reorder tabs' });
    }
});

/**
 * GET /api/tabs/:id
 * Get specific tab by ID (user must own it)
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const tabs = await getUserTabs(authReq.user!.id);
        const tab = tabs.find(t => t.id === req.params.id);

        if (!tab) {
            res.status(404).json({ error: 'Tab not found' });
            return;
        }

        res.json({ tab });
    } catch (error) {
        logger.error(`[Tabs] Failed to get: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch tab' });
    }
});

/**
 * POST /api/tabs
 * Create new personal tab
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, url, icon, groupId, enabled } = req.body as TabBody;

        if (!name || !url) {
            res.status(400).json({ error: 'Name and URL are required' });
            return;
        }

        const tab = await addUserTab(authReq.user!.id, { name, url, icon, groupId, enabled });
        invalidateUserSettings(authReq.user!.id, 'tabs');

        res.status(201).json({ tab });
    } catch (error) {
        logger.error(`[Tabs] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create tab' });
    }
});

/**
 * PUT /api/tabs/:id
 * Update personal tab
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, url, icon, groupId, enabled } = req.body as TabBody;

        const updates: TabUpdate = {};
        if (name !== undefined) updates.name = name;
        if (url !== undefined) updates.url = url;
        if (icon !== undefined) updates.icon = icon;
        if (groupId !== undefined) updates.groupId = groupId;
        if (enabled !== undefined) updates.enabled = enabled;

        const tab = await updateUserTab(authReq.user!.id, req.params.id, updates);
        invalidateUserSettings(authReq.user!.id, 'tabs');

        res.json({ tab });
    } catch (error) {
        logger.error(`[Tabs] Failed to update: error="${(error as Error).message}"`);
        if ((error as Error).message === 'Tab not found') {
            res.status(404).json({ error: (error as Error).message });
            return;
        }
        res.status(500).json({ error: 'Failed to update tab' });
    }
});

/**
 * DELETE /api/tabs/:id
 * Delete personal tab
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        await deleteUserTab(authReq.user!.id, req.params.id);
        invalidateUserSettings(authReq.user!.id, 'tabs');
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Tabs] Failed to delete: error="${(error as Error).message}"`);
        if ((error as Error).message === 'Tab not found') {
            res.status(404).json({ error: (error as Error).message });
            return;
        }
        res.status(500).json({ error: 'Failed to delete tab' });
    }
});

export default router;

