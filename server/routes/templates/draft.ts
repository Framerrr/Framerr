/**
 * Template Draft Routes
 * 
 * Auto-save draft functionality for the template builder.
 * 
 * Endpoints:
 * - POST / - Auto-save draft (creates or updates)
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * POST /
 * Auto-save draft (creates or updates)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { templateId, name, description, categoryId, widgets, thumbnail, mobileLayoutMode, mobileWidgets } = req.body;

        let template;

        if (templateId) {
            // Check if template already exists and is finalized
            // This prevents late-arriving draft saves from overwriting finalized templates
            // (race condition: user saves, then draft save arrives after)
            const existing = await templateDb.getTemplateById(templateId);
            if (existing && existing.isDraft === false) {
                logger.debug(`[Templates] Draft save ignored - template already finalized: id=${templateId}`);
                res.json({ template: existing, ignored: true });
                return;
            }

            // Update existing draft
            template = await templateDb.updateTemplate(templateId, authReq.user!.id, {
                name,
                description,
                categoryId,
                widgets,
                thumbnail,
                isDraft: true,
                mobileLayoutMode: mobileLayoutMode || 'linked',
                mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : null,
            });

            if (!template) {
                res.status(404).json({ error: 'Draft not found' });
                return;
            }
        } else {
            // Create new draft
            template = await templateDb.createTemplate({
                ownerId: authReq.user!.id,
                name: name || 'Untitled Draft',
                description,
                categoryId,
                widgets: widgets || [],
                thumbnail,
                isDraft: true,
                mobileLayoutMode: mobileLayoutMode || 'linked',
                mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined,
            });
        }

        logger.debug(`[Templates] Draft saved: id=${template.id} user=${authReq.user!.id}`);
        res.json({ template });
    } catch (error) {
        logger.error(`[Templates] Failed to save draft: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to save draft' });
    }
});

export default router;
