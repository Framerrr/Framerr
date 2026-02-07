/**
 * Template Operations Routes
 * 
 * Apply templates to dashboard and sync shared template copies.
 * 
 * Endpoints:
 * - POST /:id/apply - Apply template to user's dashboard
 * - POST /:id/sync - Sync shared copy with parent template
 * - POST /:id/set-default - Set as default for new users (admin)
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * POST /:id/apply
 * Apply a template to the user's dashboard
 */
router.post('/:id/apply', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }

        // Use canonical helper for template application
        // This handles: backup creation, widget conversion, config update
        const dashboardWidgets = await templateDb.applyTemplateToUser(
            template,
            authReq.user!.id,
            true // Create backup before applying
        );

        logger.info(`[Templates] Applied: id=${template.id} user=${authReq.user!.id} widgets=${dashboardWidgets.length}`);

        res.json({
            success: true,
            widgets: dashboardWidgets,
            message: 'Template applied. Your previous dashboard was backed up.'
        });
    } catch (error) {
        logger.error(`[Templates] Failed to apply: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to apply template' });
    }
});

/**
 * POST /:id/sync
 * Sync user's copy with the original parent template
 * User must own the template and it must have sharedFromId
 */
router.post('/:id/sync', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        if (!template.sharedFromId) {
            res.status(400).json({ error: 'This template is not a shared copy' });
            return;
        }

        // Get the parent template
        const parent = await templateDb.getTemplateById(template.sharedFromId);
        if (!parent) {
            res.status(404).json({ error: 'Original template no longer exists' });
            return;
        }

        // Strip sensitive config from parent widgets before syncing
        const { stripSensitiveConfig } = await import('../../../shared/widgetIntegrations');
        const sanitizedWidgets = parent.widgets.map(widget => ({
            ...widget,
            config: stripSensitiveConfig(widget.type, widget.config || {})
        }));

        // Sanitize mobile widgets if parent has independent mobile layout
        const sanitizedMobileWidgets = parent.mobileLayoutMode === 'independent' && parent.mobileWidgets
            ? parent.mobileWidgets.map(widget => ({
                ...widget,
                config: stripSensitiveConfig(widget.type, widget.config || {})
            }))
            : null;

        // Update user's copy with parent's data (sanitized) including mobile layout
        await templateDb.updateTemplate(req.params.id, authReq.user!.id, {
            name: parent.name,
            description: parent.description || undefined,
            widgets: sanitizedWidgets,
            userModified: false, // Reset since we're syncing
            mobileLayoutMode: parent.mobileLayoutMode,
            mobileWidgets: sanitizedMobileWidgets,
        });

        // Manually set version to match parent (bypassing increment)
        const { getDb } = await import('../../database/db');
        getDb().prepare(
            'UPDATE dashboard_templates SET version = ? WHERE id = ?'
        ).run(parent.version, req.params.id);

        logger.info(`[Templates] Synced: id=${req.params.id} parent=${parent.id} user=${authReq.user!.id}`);

        const updated = await templateDb.getTemplateById(req.params.id);
        res.json({ success: true, template: updated });
    } catch (error) {
        logger.error(`[Templates] Failed to sync: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to sync template' });
    }
});

/**
 * POST /:id/set-default
 * Set template as default for new users (admin only)
 */
router.post('/:id/set-default', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const success = await templateDb.setDefaultTemplate(req.params.id, authReq.user!.id);

        if (!success) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        logger.info(`[Templates] Default set: id=${req.params.id} by=${authReq.user!.id}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Templates] Failed to set default: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to set default template' });
    }
});

export default router;
