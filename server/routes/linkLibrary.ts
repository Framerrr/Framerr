import { Router, Request, Response } from 'express';
import {
    getLibraryLinks,
    createLibraryLink,
    deleteLibraryLink
} from '../db/linkLibrary';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * GET /api/link-library
 * Get all library links for the authenticated user
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        const links = getLibraryLinks(userId);

        res.json({ links });
    } catch (error) {
        logger.error(`[LinkLibrary] Failed to fetch: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch library links' });
    }
});

/**
 * POST /api/link-library
 * Create a new library link
 */
router.post('/', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { title, icon, size, type, url, style, action } = req.body;

        if (!title) {
            res.status(400).json({ error: 'Missing required field: title' });
            return;
        }

        const link = createLibraryLink(userId, {
            title,
            icon: icon || 'Link',
            size: size || 'circle',
            type: type || 'link',
            url,
            style,
            action
        });

        logger.info(`[LinkLibrary] Created: id=${link.id} user=${userId} title="${title}"`);

        res.status(201).json(link);
    } catch (error) {
        logger.error(`[LinkLibrary] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create library link' });
    }
});

/**
 * DELETE /api/link-library/:id
 * Delete a library template
 */
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const linkId = req.params.id;

        const deleted = deleteLibraryLink(linkId, userId);

        if (!deleted) {
            res.status(404).json({ error: 'Library template not found' });
            return;
        }

        res.json({ deleted: true });
    } catch (error) {
        logger.error(`[LinkLibrary] Failed to delete: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete library template' });
    }
});

export default router;
