/**
 * Template CRUD Routes
 * 
 * Core template create, read, update, delete operations.
 * 
 * Endpoints:
 * - GET / - Get all templates for user
 * - POST / - Create new template
 * - GET /:id - Get specific template
 * - PUT /:id - Update template
 * - DELETE /:id - Delete template
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * GET /
 * Get all templates for the current user (owned + shared)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const templates = await templateDb.getTemplatesForUser(authReq.user!.id);
        const categories = await templateDb.getCategories();

        res.json({ templates, categories });
    } catch (error) {
        logger.error(`[Templates] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * POST /
 * Create a new template
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, description, categoryId, widgets, thumbnail, isDraft, mobileLayoutMode, mobileWidgets } = req.body;

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'Template name is required' });
            return;
        }

        const template = await templateDb.createTemplate({
            ownerId: authReq.user!.id,
            name,
            description,
            categoryId,
            widgets: widgets || [],
            thumbnail,
            isDraft: isDraft || false,
            mobileLayoutMode: mobileLayoutMode || 'linked',
            mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined,
        });

        logger.info(`[Templates] Created: id=${template.id} name="${name}" user=${authReq.user!.id}`);
        res.status(201).json({ template });
    } catch (error) {
        logger.error(`[Templates] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

/**
 * GET /:id
 * Get a specific template
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }

        // Check access (owner or shared)
        const authReq = req as AuthenticatedRequest;
        const shares = await templateDb.getTemplateShares(template.id);
        const isOwner = template.ownerId === authReq.user!.id;
        const isShared = shares.some(s => s.sharedWith === authReq.user!.id || s.sharedWith === 'everyone');

        if (!isOwner && !isShared) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        res.json({ template, shares: isOwner ? shares : undefined });
    } catch (error) {
        logger.error(`[Templates] Failed to get: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

/**
 * PUT /:id
 * Update a template
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name, description, categoryId, widgets, thumbnail, isDraft, isDefault, mobileLayoutMode, mobileWidgets } = req.body;

        // Check if this is a shared copy - if so, mark as userModified
        const existing = await templateDb.getTemplateById(req.params.id);
        const isSharedCopy = existing?.sharedFromId ? true : false;

        const template = await templateDb.updateTemplate(req.params.id, authReq.user!.id, {
            name,
            description,
            categoryId,
            widgets,
            thumbnail,
            isDraft,
            isDefault,
            mobileLayoutMode: mobileLayoutMode || 'linked',
            mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : null,
            // Mark as user-modified if this is a shared copy
            ...(isSharedCopy && { userModified: true }),
        });

        if (!template) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        logger.info(`[Templates] Updated: id=${template.id} user=${authReq.user!.id} sharedCopy=${isSharedCopy}`);
        res.json({ template });
    } catch (error) {
        logger.error(`[Templates] Failed to update: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

/**
 * DELETE /:id
 * Delete a template
 * 
 * If the template is a shared copy (has sharedFromId), also removes
 * the share record so admin's share count updates correctly.
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;

        // First, check if this is a shared copy so we can clean up share records
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        // If this is a shared copy, remove the user's share record
        if (template.sharedFromId) {
            await templateDb.unshareTemplate(template.sharedFromId, authReq.user!.id);
            logger.debug(`[Templates] Share record removed: id=${req.params.id} parent=${template.sharedFromId} user=${authReq.user!.id}`);
        }

        const deleted = await templateDb.deleteTemplate(req.params.id, authReq.user!.id);

        if (!deleted) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        logger.info(`[Templates] Deleted: id=${req.params.id} user=${authReq.user!.id}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Templates] Failed to delete: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

export default router;
