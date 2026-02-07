/**
 * Tab Groups Routes
 * 
 * CRUD endpoints for per-user tab groups.
 * All routes use requireAuth (not requireAdmin) - users manage their own groups.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
    getUserTabGroups,
    createTabGroup,
    updateTabGroup,
    deleteTabGroup,
    reorderTabGroups,
    batchUpdateTabGroups,
} from '../db/tabGroups';
import logger from '../utils/logger';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface TabGroupBody {
    id?: string;
    name?: string;
    icon?: string;
    order?: number;
}

interface ReorderBody {
    orderedIds: string[];
}

interface BatchUpdateBody {
    tabGroups: Array<{ id: string; name: string; order?: number }>;
}

/**
 * GET /api/tab-groups
 * Get current user's tab groups
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const tabGroups = await getUserTabGroups(authReq.user!.id);
        res.json({ tabGroups });
    } catch (error) {
        logger.error(`[TabGroups] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch tab groups' });
    }
});

/**
 * POST /api/tab-groups
 * Create a new tab group
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, icon } = req.body as TabGroupBody;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }

        const tabGroup = await createTabGroup(authReq.user!.id, { name, icon });
        invalidateUserSettings(authReq.user!.id, 'tab-groups');

        res.status(201).json({ tabGroup });
    } catch (error) {
        logger.error(`[TabGroups] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create tab group' });
    }
});

/**
 * PUT /api/tab-groups/reorder
 * Reorder tab groups
 */
router.put('/reorder', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { orderedIds } = req.body as ReorderBody;

        if (!Array.isArray(orderedIds)) {
            res.status(400).json({ error: 'orderedIds must be an array' });
            return;
        }

        const tabGroups = await reorderTabGroups(authReq.user!.id, orderedIds);
        invalidateUserSettings(authReq.user!.id, 'tab-groups');

        res.json({ tabGroups });
    } catch (error) {
        logger.error(`[TabGroups] Failed to reorder: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reorder tab groups' });
    }
});

/**
 * PUT /api/tab-groups/batch
 * Batch update tab groups (create, update, delete in one call)
 * Used by the existing frontend pattern that sends the full array
 */
router.put('/batch', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { tabGroups } = req.body as BatchUpdateBody;

        if (!Array.isArray(tabGroups)) {
            res.status(400).json({ error: 'tabGroups must be an array' });
            return;
        }

        const result = await batchUpdateTabGroups(authReq.user!.id, tabGroups);
        invalidateUserSettings(authReq.user!.id, 'tab-groups');

        res.json({ tabGroups: result });
    } catch (error) {
        logger.error(`[TabGroups] Failed to batch update: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update tab groups' });
    }
});

/**
 * PUT /api/tab-groups/:id
 * Update a tab group
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, icon } = req.body as TabGroupBody;

        const tabGroup = await updateTabGroup(authReq.user!.id, req.params.id, { name, icon });
        invalidateUserSettings(authReq.user!.id, 'tab-groups');

        res.json({ tabGroup });
    } catch (error) {
        logger.error(`[TabGroups] Failed to update: error="${(error as Error).message}"`);
        if ((error as Error).message === 'Tab group not found') {
            res.status(404).json({ error: 'Tab group not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update tab group' });
    }
});

/**
 * DELETE /api/tab-groups/:id
 * Delete a tab group
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        await deleteTabGroup(authReq.user!.id, req.params.id);
        invalidateUserSettings(authReq.user!.id, 'tab-groups');

        res.json({ success: true });
    } catch (error) {
        logger.error(`[TabGroups] Failed to delete: error="${(error as Error).message}"`);
        if ((error as Error).message === 'Tab group not found') {
            res.status(404).json({ error: 'Tab group not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to delete tab group' });
    }
});

export default router;
