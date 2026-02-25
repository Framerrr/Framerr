/**
 * Request Actions API
 * 
 * Handles approve/decline actions for Overseerr media requests
 * directly from Framerr notifications.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getNotificationById, deleteNotification } from '../db/notifications';
import * as integrationInstancesDb from '../db/integrationInstances';
import logger from '../utils/logger';
import { getPlugin } from '../integrations/registry';
import { toPluginInstance } from '../integrations/utils';
import { AdapterError } from '../integrations/errors';

const router = Router();
const adapter = getPlugin('overseerr')!.adapter;

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface NotificationMetadata {
    actionable?: boolean;
    service?: string;
    requestId?: string | number;
}

interface Notification {
    id: string;
    metadata?: NotificationMetadata;
}



/**
 * POST /api/request-actions/overseerr/:action/:notificationId
 * Approve or decline an Overseerr request via notification
 */
router.post('/overseerr/:action/:notificationId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { action, notificationId } = req.params;
    const userId = authReq.user!.id;

    // Validate action
    if (!['approve', 'decline'].includes(action)) {
        res.status(400).json({ error: 'Invalid action. Must be "approve" or "decline"' });
        return;
    }

    try {
        // Get the notification
        const notification = await getNotificationById(notificationId, userId) as Notification | null;

        if (!notification) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }

        // Verify it's an actionable Overseerr notification
        if (!notification.metadata?.actionable || notification.metadata?.service !== 'overseerr') {
            res.status(400).json({ error: 'Notification is not actionable' });
            return;
        }

        const requestId = notification.metadata.requestId;
        if (!requestId) {
            res.status(400).json({ error: 'No request ID found in notification' });
            return;
        }

        // Get Overseerr integration instance
        const instance = integrationInstancesDb.getFirstEnabledByType('overseerr');
        if (!instance) {
            res.status(400).json({ error: 'Overseerr integration not configured' });
            return;
        }

        const pluginInstance = toPluginInstance(instance);

        if (!pluginInstance.config.url || !pluginInstance.config.apiKey) {
            res.status(400).json({ error: 'Overseerr integration not configured' });
            return;
        }

        // Map action to Overseerr status
        const overseerrStatus = action === 'approve' ? 'approve' : 'decline';

        // Call Overseerr API via adapter
        logger.info(`[RequestActions] Calling Overseerr: action=${action} requestId=${requestId}`);

        try {
            await adapter.post!(pluginInstance, `/api/v1/request/${requestId}/${overseerrStatus}`, {}, {
                timeout: 10000,
            });

            // Success - delete the notification
            await deleteNotification(notificationId, userId);

            logger.info(`[RequestActions] Success: action=${action} requestId=${requestId} notificationId=${notificationId}`);

            res.json({
                success: true,
                action,
                requestId,
                message: `Request ${action}d successfully`
            });

        } catch (apiError) {
            // Handle Overseerr API errors
            const adapterErr = apiError as AdapterError;
            const status = (adapterErr.context?.status as number) || 0;
            const errorMessage = adapterErr.message;

            logger.warn(`[RequestActions] Overseerr API error: action=${action} requestId=${requestId} status=${status} error="${errorMessage}"`);

            // If 404 or other client error, the request may already be handled
            if (status === 404 || status === 400 || status === 409) {
                // Delete the notification anyway - it's stale
                await deleteNotification(notificationId, userId);

                res.json({
                    success: true,
                    alreadyHandled: true,
                    action,
                    requestId,
                    message: 'Request was already handled'
                });
                return;
            }

            // Other errors - keep notification, report error
            res.status(502).json({
                success: false,
                error: `Overseerr error: ${errorMessage}`
            });
        }

    } catch (error) {
        logger.error(`[RequestActions] Failed to process: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to process request action' });
    }
});

export default router;
