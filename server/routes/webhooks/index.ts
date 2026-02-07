/**
 * Unified Webhook Router
 * 
 * Routes webhooks to the appropriate plugin handler based on type and instance.
 * 
 * New URL format: POST /api/webhooks/:type/:instanceId/:token
 * Legacy format:  POST /api/webhooks/:type/:token (deprecated, to be removed)
 * 
 * The router:
 * 1. Validates the instance exists and has webhooks enabled
 * 2. Verifies the token matches the instance's webhook token
 * 3. Delegates to the plugin's webhook handler
 * 4. Broadcasts results via SSE for real-time updates
 */
import { Router, Request, Response } from 'express';
import logger from '../../utils/logger';
import { getPlugin } from '../../integrations/registry';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { broadcastToTopic } from '../../services/sse';
import type { WebhookSettings } from '../../integrations/types';

// Legacy routers - kept for backwards compatibility during migration
import sonarrRouter from './sonarr';
import radarrRouter from './radarr';
import overseerrRouter from './overseerr';
import testRouter from './test';

const router = Router();

// ============================================================================
// New Multi-Instance Route
// ============================================================================

/**
 * POST /api/webhooks/:type/:instanceId/:token
 * Unified webhook endpoint for multi-instance support
 */
router.post('/:type/:instanceId/:token', async (req: Request, res: Response): Promise<void> => {
    const { type, instanceId, token } = req.params;
    const payload = req.body;

    logger.debug(`[Webhook] Received: type=${type} instanceId=${instanceId}`);

    try {
        // 1. Get the plugin from registry
        const plugin = getPlugin(type);

        if (!plugin) {
            logger.warn(`[Webhook] Unknown type: ${type}`);
            res.status(404).json({ error: 'Unknown integration type' });
            return;
        }

        if (!plugin.webhook) {
            logger.warn(`[Webhook] Plugin does not support webhooks: ${type}`);
            res.status(400).json({ error: 'Integration does not support webhooks' });
            return;
        }

        // 2. Get the instance from database
        const instance = integrationInstancesDb.getInstanceById(instanceId);

        if (!instance) {
            logger.warn(`[Webhook] Instance not found: ${instanceId}`);
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        if (!instance.enabled) {
            logger.warn(`[Webhook] Instance disabled: ${instanceId}`);
            res.status(403).json({ error: 'Instance is disabled' });
            return;
        }

        // 3. Validate webhook token
        const webhookConfig = instance.config.webhookConfig as {
            webhookEnabled?: boolean;
            webhookToken?: string;
            adminEvents?: string[];
            userEvents?: string[];
        } | undefined;

        if (!webhookConfig?.webhookEnabled) {
            logger.warn(`[Webhook] Webhooks not enabled for instance: ${instanceId}`);
            res.status(403).json({ error: 'Webhooks not enabled' });
            return;
        }

        if (webhookConfig.webhookToken !== token) {
            logger.warn(`[Webhook] Invalid token for instance: ${instanceId}`);
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        // 4. Build webhook settings for the handler
        const webhookSettings: WebhookSettings = {
            token,
            enabledEvents: [
                ...(webhookConfig.adminEvents || []),
                ...(webhookConfig.userEvents || [])
            ]
        };

        // 5. Convert to PluginInstance format
        const pluginInstance = {
            id: instance.id,
            type: instance.type,
            name: instance.displayName,
            config: instance.config
        };

        // 6. Call the plugin webhook handler
        const result = await plugin.webhook.handle(payload, pluginInstance, webhookSettings);

        // 7. Broadcast via SSE if handler returned broadcast data
        if (result.success && result.broadcast) {
            broadcastToTopic(result.broadcast.topic, result.broadcast.data);
            logger.debug(`[Webhook] Broadcast to topic: ${result.broadcast.topic}`);
        }

        res.status(200).json({
            status: 'ok',
            message: result.message
        });

    } catch (error) {
        logger.error(`[Webhook] Processing error: type=${type} instanceId=${instanceId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// ============================================================================
// Legacy Routes (Deprecated - for backwards compatibility)
// ============================================================================

// Mount legacy service-specific routers
// These use the old URL format: /api/webhooks/:type/:token
// TODO: Remove after migration period
router.use('/overseerr', overseerrRouter);
router.use('/sonarr', sonarrRouter);
router.use('/radarr', radarrRouter);

// Test endpoint (admin only, for development)
router.use('/test', testRouter);

export default router;

// Re-export types for consumers
export * from './types';
