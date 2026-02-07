/**
 * Template Category Routes
 * 
 * CRUD operations for template categories (admin only for create/delete).
 * 
 * Endpoints:
 * - GET /categories - Get all categories
 * - POST /categories - Create category (admin)
 * - DELETE /categories/:id - Delete category (admin)
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * GET /categories
 * Get all categories
 */
router.get('/', requireAuth, async (_req: Request, res: Response) => {
    try {
        const categories = await templateDb.getCategories();
        res.json({ categories });
    } catch (error) {
        logger.error(`[Templates] Failed to get categories: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

/**
 * POST /categories
 * Create a new category (admin only)
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { name } = req.body;

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'Category name is required' });
            return;
        }

        const category = await templateDb.createCategory(name, authReq.user!.id);
        logger.info(`[Templates] Category created: id=${category.id} name="${name}" by=${authReq.user!.id}`);
        res.status(201).json({ category });
    } catch (error) {
        if ((error as Error).message.includes('UNIQUE constraint')) {
            res.status(409).json({ error: 'Category already exists' });
            return;
        }
        logger.error(`[Templates] Failed to create category: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

/**
 * DELETE /categories/:id
 * Delete a category (admin only)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const deleted = await templateDb.deleteCategory(req.params.id);

        if (!deleted) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }

        logger.info(`[Templates] Category deleted: id=${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Templates] Failed to delete category: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
