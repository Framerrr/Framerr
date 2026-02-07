/**
 * Template Sharing Routes
 * 
 * Share templates with other users, check conflicts, and manage shares.
 * All sharing operations are admin-only.
 * 
 * Endpoints:
 * - GET /:id/shares - Get current shares for template
 * - POST /:id/check-conflicts - Check for widget conflicts before sharing
 * - POST /:id/share - Share a template with user(s)
 * - DELETE /:id/share/:userId - Revoke sharing
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as templateDb from '../../db/templates';
import * as integrationSharesDb from '../../db/integrationShares';
import { createNotification } from '../../db/notifications';
import logger from '../../utils/logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

/**
 * GET /:id/shares
 * Get current shares for a template (admin only, owner only)
 * Returns actual copy owners and total non-admin users (for reality-based mode calculation)
 */
router.get('/:id/shares', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        // Get actual user copies (reality) and total non-admin users
        const copyOwners = await templateDb.getTemplateCopyOwners(req.params.id);

        // Get total non-admin users for mode calculation
        const { getAllUsers } = await import('../../db/users');
        const allUsers = await getAllUsers();
        const nonAdminUsers = allUsers.filter(u => u.group !== 'admin');

        res.json({
            // Actual users who have copies (for dropdown display)
            users: copyOwners.map(u => ({ id: u.userId, username: u.username })),
            // Total non-admin users (for "Everyone" calculation)
            totalNonAdminUsers: nonAdminUsers.length,
            // Also return all non-admin user list for checkbox population
            allUsers: nonAdminUsers.map(u => ({ id: u.id, username: u.username, group: u.group }))
        });
    } catch (error) {
        logger.error(`[Templates] Failed to get shares: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get shares' });
    }
});

/**
 * POST /:id/check-conflicts
 * Check for widget conflicts before sharing (admin only)
 * Returns which integrations are needed but not shared with target users
 * 
 * Uses the database-backed integration_shares table as the source of truth
 */
router.post('/:id/check-conflicts', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { userIds, shareMode } = req.body; // userIds: string[], shareMode: 'everyone' | 'users' | 'groups'

        const template = await templateDb.getTemplateById(req.params.id);
        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        // Get required integrations from template widgets using canonical mapping
        // Include both desktop and mobile widgets when mobileLayoutMode is 'independent'
        const { getRequiredIntegrations } = await import('../../../shared/widgetIntegrations');
        const desktopWidgetTypes = template.widgets.map(w => w.type);
        const mobileWidgetTypes = template.mobileLayoutMode === 'independent' && template.mobileWidgets
            ? template.mobileWidgets.map(w => w.type)
            : [];
        const allWidgetTypes = [...new Set([...desktopWidgetTypes, ...mobileWidgetTypes])];
        const requiredIntegrationsArray = getRequiredIntegrations(allWidgetTypes);
        const requiredIntegrations = new Set<string>(requiredIntegrationsArray);

        if (requiredIntegrations.size === 0) {
            res.json({ conflicts: [] });
            return;
        }

        interface ConflictResult {
            integration: string;
            integrationDisplayName: string;
            affectedUsers: { id: string; username: string }[];
        }

        const conflicts: ConflictResult[] = [];

        // Get target users based on share mode
        const { getAllUsers } = await import('../../db/users');
        const allUsers = await getAllUsers();
        const nonAdminUsers = allUsers.filter(u => u.group !== 'admin');

        const targetUsers = shareMode === 'everyone'
            ? nonAdminUsers
            : nonAdminUsers.filter(u => userIds?.includes(u.id));

        if (targetUsers.length === 0) {
            res.json({ conflicts: [] });
            return;
        }

        // For each required integration, check if users have access using the DB-backed system
        for (const integration of requiredIntegrations) {
            const affectedUsers: { id: string; username: string }[] = [];

            for (const user of targetUsers) {
                // Use the database-backed integration sharing check
                const hasAccess = await integrationSharesDb.userHasIntegrationAccess(
                    integration,
                    user.id,
                    user.group
                );

                if (!hasAccess) {
                    affectedUsers.push({ id: user.id, username: user.username });
                }
            }

            if (affectedUsers.length > 0) {
                const displayNames: Record<string, string> = {
                    'plex': 'Plex',
                    'sonarr': 'Sonarr',
                    'radarr': 'Radarr',
                    'overseerr': 'Overseerr',
                    'qbittorrent': 'qBittorrent',
                    'systemstatus': 'System Status'
                };

                conflicts.push({
                    integration,
                    integrationDisplayName: displayNames[integration] || integration,
                    affectedUsers
                });
            }
        }

        res.json({ conflicts });
    } catch (error) {
        logger.error(`[Templates] Failed to check conflicts: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to check conflicts' });
    }
});

/**
 * POST /:id/share
 * Share a template (admin only)
 * Creates a copy for the user with sharedFromId pointing to original
 * 
 * Options:
 * - sharedWith: 'everyone' or user ID (required)
 * - shareIntegrations: boolean - also share required integrations (optional)
 */
router.post('/:id/share', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { sharedWith, shareIntegrations } = req.body; // 'everyone' or user ID, plus optional flag

        if (!sharedWith) {
            res.status(400).json({ error: 'sharedWith is required' });
            return;
        }

        const template = await templateDb.getTemplateById(req.params.id);
        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        // Create share record
        const share = await templateDb.shareTemplate(req.params.id, sharedWith);

        // Get list of users to create copies for
        let usersToShare: string[] = [];

        if (sharedWith === 'everyone') {
            // Get all users (exclude all admins - they have inherent access)
            const { getAllUsers } = await import('../../db/users');
            const allUsers = await getAllUsers();
            usersToShare = allUsers
                .filter(u => u.group !== 'admin') // Exclude all admins, not just owner
                .map(u => u.id);
            logger.debug(`[Templates] Sharing with everyone: count=${usersToShare.length}`);
        } else {
            // Single user - but skip if trying to share with an admin
            const { getUserById } = await import('../../db/users');
            const targetUser = await getUserById(sharedWith);
            if (targetUser && targetUser.group !== 'admin') {
                usersToShare = [sharedWith];
            } else {
                logger.debug(`[Templates] Skipping admin user: id=${sharedWith}`);
            }
        }

        // Create user copies for each user using the consolidated helper
        let integrationsShared: string[] = [];
        let integrationsAlreadyShared: string[] = [];

        for (const userId of usersToShare) {
            try {
                const result = await templateDb.shareTemplateWithUser(
                    template,
                    userId,
                    authReq.user!.id,
                    {
                        stripConfigs: true,
                        shareIntegrations: !!shareIntegrations,
                        applyToDashboard: false,
                    }
                );

                // Aggregate integration results
                if (!result.skipped) {
                    integrationsShared = [...new Set([...integrationsShared, ...result.integrationsShared])];
                }

                logger.info(`[Templates] User copy created: template=${template.id} user=${userId} skipped=${result.skipped}`);
            } catch (copyError) {
                logger.error(`[Templates] Failed to create copy: template=${template.id} user=${userId} error="${(copyError as Error).message}"`);
            }

            // Send notification (only for specific user shares, not everyone)
            if (sharedWith !== 'everyone') {
                try {
                    await createNotification({
                        userId: userId,
                        type: 'info',
                        title: 'New template shared',
                        message: `${authReq.user!.username} shared template "${template.name}" with you`,
                        metadata: { templateId: template.id }
                    });
                } catch (notifyError) {
                    logger.warn(`[Templates] Notification failed: user=${userId} error="${(notifyError as Error).message}"`);
                }
            }
        }

        // Build integration share result for response
        const integrationShareResult = integrationsShared.length > 0 || integrationsAlreadyShared.length > 0
            ? { shared: integrationsShared, alreadyShared: integrationsAlreadyShared }
            : undefined;

        logger.info(`[Templates] Shared: id=${req.params.id} with=${sharedWith} users=${usersToShare.length}`);

        // Include integration share info in response if applicable
        const response: { share: typeof share; integrationShares?: typeof integrationShareResult } = { share };
        if (integrationShareResult) {
            response.integrationShares = integrationShareResult;
        }
        res.json(response);
    } catch (error) {
        logger.error(`[Templates] Failed to share: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to share template' });
    }
});

/**
 * DELETE /:id/share/:userId
 * Revoke sharing (admin only)
 */
router.delete('/:id/share/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const template = await templateDb.getTemplateById(req.params.id);

        if (!template || template.ownerId !== authReq.user!.id) {
            res.status(404).json({ error: 'Template not found or access denied' });
            return;
        }

        const unshared = await templateDb.unshareTemplate(req.params.id, req.params.userId);

        if (unshared && req.params.userId !== 'everyone') {
            await createNotification({
                userId: req.params.userId,
                type: 'info',
                title: 'Template access revoked',
                message: `${authReq.user!.username} revoked access to template "${template.name}"`,
            });
        }

        res.json({ success: unshared });
    } catch (error) {
        logger.error(`[Templates] Failed to unshare: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to revoke share' });
    }
});

export default router;
