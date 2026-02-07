/**
 * Overseerr Actions Routes
 * 
 * Handles approve/decline actions for Overseerr media requests:
 * - /:id/actions/approve/:notificationId - Approve via notification
 * - /:id/actions/decline/:notificationId - Decline via notification
 * - /:id/actions/direct - Approve/decline directly (no notification)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth, requireAdmin } from '../../../middleware/auth';
import { getNotificationById, deleteNotification } from '../../../db/notifications';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import logger from '../../../utils/logger';

const router = Router();

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
 * POST /:id/actions/:action/:notificationId
 * Approve or decline an Overseerr request via notification
 */
router.post('/:id/actions/:action/:notificationId', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const { id, action, notificationId } = req.params;
    const userId = req.user!.id;

    // Validate action
    if (!['approve', 'decline'].includes(action)) {
        res.status(400).json({ error: 'Invalid action. Must be "approve" or "decline"' });
        return;
    }

    // Get integration instance
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Overseerr integration not configured' });
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

        // Call Overseerr API
        const apiUrl = `${url.replace(/\/$/, '')}/api/v1/request/${requestId}/${action}`;

        logger.info(`[Overseerr Actions] Calling API: action=${action} requestId=${requestId}`);

        try {
            await axios.post(apiUrl, {}, {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            // Success - delete the notification
            await deleteNotification(notificationId, userId);

            logger.info(`[Overseerr Actions] Success: action=${action} requestId=${requestId} notificationId=${notificationId}`);

            res.json({
                success: true,
                action,
                requestId,
                message: `Request ${action}d successfully`
            });

        } catch (apiError) {
            const axiosError = apiError as { response?: { status?: number; data?: { message?: string } }; message?: string };
            const status = axiosError.response?.status;
            const errorMessage = axiosError.response?.data?.message || axiosError.message;

            logger.warn(`[Overseerr Actions] API error: action=${action} requestId=${requestId} status=${status} error="${errorMessage}"`);

            // If already handled, delete notification and return success
            if (status === 404 || status === 400 || status === 409) {
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

            res.status(502).json({
                success: false,
                error: `Overseerr error: ${errorMessage}`
            });
        }

    } catch (error) {
        logger.error(`[Overseerr Actions] Failed to process: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to process request action' });
    }
});

/**
 * POST /:id/actions/direct
 * Approve or decline an Overseerr request directly (from widget modal)
 */
router.post('/:id/actions/direct', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { requestId, action } = req.body;

    // Validate required fields
    if (!requestId || !action) {
        res.status(400).json({ error: 'Missing required fields: requestId, action' });
        return;
    }

    // Validate action
    if (!['approve', 'decline'].includes(action)) {
        res.status(400).json({ error: 'Invalid action. Must be "approve" or "decline"' });
        return;
    }

    // Get integration instance
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Overseerr integration not configured' });
        return;
    }

    try {
        const apiUrl = `${url.replace(/\/$/, '')}/api/v1/request/${requestId}/${action}`;

        logger.info(`[Overseerr Actions] Calling API (direct): action=${action} requestId=${requestId}`);

        await axios.post(apiUrl, {}, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        logger.info(`[Overseerr Actions] Direct success: action=${action} requestId=${requestId}`);

        res.json({
            success: true,
            action,
            requestId,
            message: `Request ${action}d successfully`
        });

    } catch (apiError) {
        const axiosError = apiError as { response?: { status?: number; data?: { message?: string } }; message?: string };
        const status = axiosError.response?.status;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;

        logger.warn(`[Overseerr Actions] API error (direct): action=${action} requestId=${requestId} status=${status} error="${errorMessage}"`);

        if (status === 404 || status === 400 || status === 409) {
            res.json({
                success: true,
                alreadyHandled: true,
                action,
                requestId,
                message: 'Request was already handled'
            });
            return;
        }

        res.status(502).json({
            success: false,
            error: `Overseerr error: ${errorMessage}`
        });
    }
});

export default router;
