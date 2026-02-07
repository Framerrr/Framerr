/**
 * Overseerr Webhook Handler
 * 
 * Receives webhooks from Overseerr/Jellyseerr/Seerr and creates notifications.
 * 
 * Endpoint: POST /api/webhooks/overseerr/:token
 */
import { Router, Request, Response } from 'express';
import logger from '../../utils/logger';
import { validateToken, processWebhookNotification } from './_shared';
import {
    OVERSEERR_EVENT_MAP,
    type OverseerrWebhookPayload,
    type NotificationMetadata,
    type NotificationContent
} from './types';

const router = Router();

/**
 * POST /overseerr/:token
 * Receive Overseerr webhook
 */
router.post('/:token', async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const payload = req.body as OverseerrWebhookPayload;

    logger.debug(`[Webhook] Received Overseerr: event=${payload.event}`);

    const validation = await validateToken('overseerr', token);
    if (!validation.valid) {
        logger.warn(`[Webhook] Invalid Overseerr: reason="${validation.reason}"`);
        res.status(401).json({ error: validation.reason });
        return;
    }

    try {
        // Map Overseerr event to Framerr event key
        // Overseerr may use different field names depending on version/config
        const eventType = payload.event || payload.notification_type || payload.notificationType || payload.type;
        const eventKey = eventType ? OVERSEERR_EVENT_MAP[eventType] : undefined;

        logger.debug(`[Webhook] Overseerr event: type=${eventType} key=${eventKey}`);

        if (!eventKey) {
            logger.debug(`[Webhook] Unknown Overseerr event: type=${eventType}`);
            res.status(200).json({ status: 'ignored', reason: 'Unknown event type' });
            return;
        }

        // Extract username based on event type
        let username: string | null = null;
        if (payload.request?.requestedBy_username) {
            username = payload.request.requestedBy_username;
        } else if (payload.issue?.reportedBy_username) {
            username = payload.issue.reportedBy_username;
        }

        // Build normalized notification content
        const mediaTitle = payload.subject || payload.media?.title || 'Unknown';
        const { title, message } = buildOverseerrNotification(eventKey, mediaTitle, username, payload);

        // Extract requestId for actionable notifications
        // Try different field names used by Overseerr/Jellyseerr/Seerr
        const requestId = payload.request?.id || payload.request?.request_id || payload.request?.requestId || null;
        const metadata: NotificationMetadata | null = requestId && eventKey === 'requestPending' ? {
            requestId,
            service: 'overseerr',
            actionable: true,
            mediaTitle
        } : null;

        logger.info(`[Webhook] Overseerr metadata: requestId=${requestId} event=${eventKey} actionable=${!!metadata}`);

        // Process notification
        const result = await processWebhookNotification({
            service: 'overseerr',
            eventKey,
            username,
            title,
            message,
            webhookConfig: validation.webhookConfig!,
            metadata
        });

        res.status(200).json({ status: 'ok', ...result });
    } catch (error) {
        logger.error(`[Webhook] Overseerr processing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

/**
 * Build normalized notification for Overseerr events
 */
function buildOverseerrNotification(
    eventKey: string,
    mediaTitle: string,
    username: string | null,
    payload: OverseerrWebhookPayload
): NotificationContent {
    const titleMap: Record<string, string> = {
        'requestPending': 'Request Pending',
        'requestApproved': 'Request Approved',
        'requestAutoApproved': 'Request Auto-Approved',
        'requestAvailable': 'Now Available',
        'requestDeclined': 'Request Declined',
        'requestFailed': 'Request Failed',
        'issueReported': 'Issue Reported',
        'issueComment': 'New Comment',
        'issueResolved': 'Issue Resolved',
        'issueReopened': 'Issue Reopened',
        'test': 'Test Notification'
    };

    const title = `Overseerr: ${titleMap[eventKey] || 'Notification'}`;

    let message: string;
    switch (eventKey) {
        case 'requestPending':
            message = username
                ? `"${mediaTitle}" requested by ${username} is awaiting approval`
                : `"${mediaTitle}" is awaiting approval`;
            break;
        case 'requestApproved':
            message = `Your request for "${mediaTitle}" approved`;
            break;
        case 'requestAutoApproved':
            message = `"${mediaTitle}" was automatically approved`;
            break;
        case 'requestAvailable':
            message = `"${mediaTitle}" is now available to watch`;
            break;
        case 'requestDeclined':
            message = `Your request for "${mediaTitle}" was declined`;
            break;
        case 'requestFailed':
            message = `Failed to process request for "${mediaTitle}"`;
            break;
        case 'issueReported':
            message = `A new issue was reported for "${mediaTitle}"`;
            break;
        case 'issueComment':
            message = `New comment on issue for "${mediaTitle}"`;
            break;
        case 'issueResolved':
            message = `Issue for "${mediaTitle}" resolved`;
            break;
        case 'issueReopened':
            message = `Issue for "${mediaTitle}" reopened`;
            break;
        case 'test':
            message = 'Successfully connected to Framerr';
            break;
        default:
            message = payload.message || `Event received for "${mediaTitle}"`;
    }

    return { title, message };
}

export default router;
