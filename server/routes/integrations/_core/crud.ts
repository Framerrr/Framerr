/**
 * Integration Instance CRUD Routes
 * 
 * REST API for managing integration instances (admin operations).
 * 
 * Endpoints:
 * - GET / - Get all integration instances (admin only)
 * - GET /types - Get enabled integration types
 * - GET /by-type/:type - Get instances of a specific type
 * - GET /shared - Get user's accessible integrations
 * - GET /:id - Get single instance (admin only)
 * - POST / - Create instance (admin only)
 * - PUT /:id - Update instance (admin only)
 * - DELETE /:id - Delete instance (admin only)
 * 
 * NOTE: Integration-specific status endpoints (e.g., /overseerr/status) are in their
 * respective integration folders (e.g., integrations/overseerr/).
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../../middleware/auth';
import { invalidateSystemSettings } from '../../../utils/invalidateUserSettings';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import logger from '../../../utils/logger';
import type { AuthenticatedRequest } from './types';
import { redactConfig, mergeConfigWithExisting } from './redact';

const router = Router();

/**
 * GET /
 * Get all integration instances (ADMIN ONLY)
 */
router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const instances = integrationInstancesDb.getAllInstances();
        // Redact password-type fields so secrets never appear in browser network tab
        const redacted = instances.map(inst => ({
            ...inst,
            config: redactConfig(inst.config, inst.type)
        }));
        res.json({ integrations: redacted });
    } catch (error) {
        logger.error(`[Integrations] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});

/**
 * GET /types
 * Get list of enabled integration types (for widget gallery)
 */
router.get('/types', requireAuth, async (_req: Request, res: Response) => {
    try {
        const types = integrationInstancesDb.getEnabledTypes();
        res.json({ types });
    } catch (error) {
        logger.error(`[Integrations] Failed to get types: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch integration types' });
    }
});

/**
 * GET /by-type/:type
 * Get enabled instances of a specific type (for widget gallery)
 * Returns minimal info: id, displayName, type
 */
router.get('/by-type/:type', requireAuth, async (req: Request, res: Response) => {
    try {
        const instances = integrationInstancesDb.getInstancesByType(req.params.type)
            .filter(i => i.enabled)
            .map(i => ({
                id: i.id,
                displayName: i.displayName,
                type: i.type
            }));
        res.json({ instances });
    } catch (error) {
        logger.error(`[Integrations] Failed to get by type: type=${req.params.type} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch instances' });
    }
});

// ============================================================================
// IMPORTANT: Static routes MUST come before parameterized routes (/:id)
// Otherwise Express will match /shared as an ID
// ============================================================================

/**
 * GET /shared
 * Get integration instances shared with the current user (non-admin)
 * Returns integration details for widgets to use
 */
router.get('/shared', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const userGroup = authReq.user!.group;

        // Admins get all, but this endpoint is mainly for non-admins
        // Redirect admins to use /api/integrations instead
        if (userGroup === 'admin') {
            // For admins, return all enabled integrations
            const allInstances = integrationInstancesDb.getAllInstances()
                .filter(i => i.enabled)
                .map(i => ({
                    id: i.id,
                    type: i.type,
                    displayName: i.displayName,
                    enabled: true,
                    createdAt: i.createdAt,
                    updatedAt: i.updatedAt,
                    // Legacy fields for widget compatibility
                    name: i.type,
                    sharedBy: 'system'
                }));
            res.json({ integrations: allInstances });
            return;
        }

        // Import integration shares db dynamically to avoid circular deps
        const integrationSharesDb = await import('../../../db/integrationShares');
        const usersDb = await import('../../../db/users');

        // Get accessible instance IDs for this user
        const accessibleIds = await integrationSharesDb.getUserAccessibleIntegrationInstances(userId, userGroup);

        // Get full instance data for each accessible ID, with sharedBy username
        const sharedIntegrations = [];
        for (const instanceId of accessibleIds) {
            const instance = integrationInstancesDb.getInstanceById(instanceId);
            if (instance && instance.enabled) {
                // Look up the share record to get the sharedBy user ID
                const share = await integrationSharesDb.getInstanceShareForUser(instanceId, userId, userGroup);
                let sharedByUsername = 'admin'; // Fallback

                if (share?.sharedBy) {
                    const sharer = await usersDb.getUserById(share.sharedBy);
                    if (sharer?.username) {
                        sharedByUsername = sharer.username;
                    }
                }

                sharedIntegrations.push({
                    id: instance.id,
                    type: instance.type,
                    displayName: instance.displayName,
                    enabled: true,
                    createdAt: instance.createdAt,
                    updatedAt: instance.updatedAt,
                    // Legacy fields for widget compatibility
                    name: instance.type,
                    sharedBy: sharedByUsername
                });
            }
        }

        res.json({ integrations: sharedIntegrations });
    } catch (error) {
        logger.error(`[Integrations] Failed to get shared: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch shared integrations' });
    }
});

/**
 * GET /:id
 * Get a single integration instance (ADMIN ONLY)
 */
router.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const instance = integrationInstancesDb.getInstanceById(req.params.id);

        if (!instance) {
            res.status(404).json({ error: 'Integration not found' });
            return;
        }

        res.json({ integration: { ...instance, config: redactConfig(instance.config, instance.type) } });
    } catch (error) {
        logger.error(`[Integrations] Failed to get: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch integration' });
    }
});

/**
 * POST /
 * Create a new integration instance (ADMIN ONLY)
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { type, displayName, name, config, enabled } = req.body;

        // Accept both displayName (preferred) or name (legacy frontend) 
        const finalDisplayName = displayName || name;

        if (!type || !finalDisplayName || !config) {
            res.status(400).json({ error: 'type, displayName (or name), and config are required' });
            return;
        }

        const instance = integrationInstancesDb.createInstance({
            type,
            displayName: finalDisplayName,
            config,
            enabled: enabled !== false
        });

        logger.info(`[Integrations] Created: id=${instance.id} type=${type} name="${finalDisplayName}" by=${authReq.user?.id}`);

        // Notify IntegrationManager of the creation (for auto-starting library sync, etc.)
        const { onIntegrationCreated } = await import('../../../services/IntegrationManager');
        await onIntegrationCreated(instance);

        res.status(201).json({ integration: instance });
    } catch (error) {
        logger.error(`[Integrations] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create integration' });
    }
});

/**
 * PUT /:id
 * Update an integration instance (ADMIN ONLY)
 */
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { displayName, name, config, enabled } = req.body;

        // Accept both displayName (preferred) or name (legacy frontend)
        const finalDisplayName = displayName || name;

        // Capture previous config BEFORE update for transition detection
        const previousInstance = integrationInstancesDb.getInstanceById(req.params.id);
        const previousConfig = previousInstance?.config;

        // Merge sentinel values with existing DB values for password fields
        const mergedConfig = config && previousConfig
            ? mergeConfigWithExisting(config, previousConfig, previousInstance!.type)
            : config;

        const instance = integrationInstancesDb.updateInstance(req.params.id, {
            displayName: finalDisplayName,
            config: mergedConfig,
            enabled
        });

        if (!instance) {
            res.status(404).json({ error: 'Integration not found' });
            return;
        }

        logger.info(`[Integrations] Updated: id=${req.params.id} by=${authReq.user?.id}`);

        // Notify IntegrationManager of the update (for library sync cleanup, etc.)
        const { onIntegrationUpdated } = await import('../../../services/IntegrationManager');
        await onIntegrationUpdated(instance, {
            enabled: enabled !== undefined,
            config: config !== undefined,
            previousConfig  // Pass previous config for transition detection
        });

        // Broadcast invalidation for real-time updates on user notification settings
        // If webhookConfig changed, users need to refresh their shared integrations
        if (config?.webhookConfig) {
            invalidateSystemSettings('integrations');
        }

        // Notify metric history service of integration save (triggers re-probe)
        try {
            const { metricHistoryService } = await import('../../../services/MetricHistoryService');
            await metricHistoryService.onIntegrationSaved(req.params.id);
        } catch {
            // Non-critical — metric history may not be enabled
        }

        res.json({ integration: { ...instance, config: redactConfig(instance.config, instance.type) } });
    } catch (error) {
        logger.error(`[Integrations] Failed to update: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update integration' });
    }
});

/**
 * DELETE /:id
 * Delete an integration instance (ADMIN ONLY)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;

        // Get instance BEFORE deletion (need type for cleanup routing)
        const instance = integrationInstancesDb.getInstanceById(req.params.id);

        const deleted = integrationInstancesDb.deleteInstance(req.params.id);

        if (!deleted) {
            res.status(404).json({ error: 'Integration not found' });
            return;
        }

        // Cleanup: library sync data, cached images, SSE connections
        if (instance) {
            const { onIntegrationDeleted } = await import('../../../services/IntegrationManager');
            await onIntegrationDeleted(req.params.id, instance.type);

            // Cleanup: metric history data + source records (always, even if feature disabled)
            const { metricHistoryService } = await import('../../../services/MetricHistoryService');
            await metricHistoryService.clearForIntegration(req.params.id);
            logger.debug(`[Integrations] Cleared metric history for deleted integration: id=${req.params.id}`);
        }

        // Notify all widgets to refetch integration data
        // This triggers single-integration widgets to auto-fallback
        // and multi-integration widgets to drop the deleted ID
        invalidateSystemSettings('integrations');
        invalidateSystemSettings('media-search-sync');

        logger.info(`[Integrations] Deleted: id=${req.params.id} type=${instance?.type} by=${authReq.user?.id}`);

        res.json({ success: true });
    } catch (error) {
        logger.error(`[Integrations] Failed to delete: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete integration' });
    }
});

export default router;
