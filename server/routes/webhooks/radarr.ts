/**
 * Radarr Webhook Handler
 * 
 * Receives webhooks from Radarr and creates notifications.
 * All Radarr events are admin-only (system events, no per-user context).
 * 
 * Endpoint: POST /api/webhooks/radarr/:token
 */
import { Router, Request, Response } from 'express';
import logger from '../../utils/logger';
import { validateToken, processWebhookNotification } from './_shared';
import {
    RADARR_EVENT_MAP,
    type RadarrWebhookPayload,
    type NotificationContent
} from './types';

const router = Router();

/**
 * POST /radarr/:token
 * Receive Radarr webhook
 */
router.post('/:token', async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const payload = req.body as RadarrWebhookPayload;

    logger.debug(`[Webhook] Received Radarr: event=${payload.eventType}`);

    const validation = await validateToken('radarr', token);
    if (!validation.valid) {
        logger.warn(`[Webhook] Invalid Radarr: reason="${validation.reason}"`);
        res.status(401).json({ error: validation.reason });
        return;
    }

    try {
        // Map Radarr event to Framerr event key
        let eventKey = RADARR_EVENT_MAP[payload.eventType];

        // Special handling for Health events
        if (payload.eventType === 'Health' && payload.isHealthRestored) {
            eventKey = 'healthRestored';
        }

        if (!eventKey) {
            logger.debug(`[Webhook] Unknown Radarr event: type=${payload.eventType}`);
            res.status(200).json({ status: 'ignored', reason: 'Unknown event type' });
            return;
        }

        // Build normalized notification content
        const movie = payload.movie?.title || 'Unknown Movie';
        const year = payload.movie?.year || null;
        const quality = payload.release?.quality || null;
        const { title, message } = buildRadarrNotification(payload.eventType, movie, year, quality, payload);

        // Radarr doesn't have per-user requests, notifications go to admins only
        const result = await processWebhookNotification({
            service: 'radarr',
            eventKey,
            username: null,
            title,
            message,
            webhookConfig: validation.webhookConfig!,
            adminOnly: true
        });

        res.status(200).json({ status: 'ok', ...result });
    } catch (error) {
        logger.error(`[Webhook] Radarr processing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

/**
 * Build normalized notification for Radarr events
 */
function buildRadarrNotification(
    eventType: string,
    movie: string,
    year: number | null,
    quality: string | null,
    payload: RadarrWebhookPayload
): NotificationContent {
    const titleMap: Record<string, string> = {
        'Grab': 'Movie Grabbed',
        'Download': 'Movie Downloaded',
        'Upgrade': 'Movie Upgraded',
        'ImportComplete': 'Import Complete',
        'Rename': 'Movie Renamed',
        'MovieAdded': 'Movie Added',
        'MovieDelete': 'Movie Removed',
        'MovieFileDelete': 'Movie Deleted',
        'MovieFileDeleteForUpgrade': 'Movie Deleted for Upgrade',
        'Health': 'Health Warning',
        'HealthRestored': 'Health Restored',
        'ApplicationUpdate': 'Update Available',
        'ManualInteractionRequired': 'Action Required',
        'Test': 'Test Notification'
    };

    const title = `Radarr: ${titleMap[eventType] || 'Notification'}`;
    const movieWithYear = year ? `${movie} (${year})` : movie;

    let message: string;
    switch (eventType) {
        case 'Grab':
            message = `${movieWithYear} grabbed${quality ? ` in ${quality}` : ''}`;
            break;
        case 'Download':
            message = `${movieWithYear} downloaded`;
            break;
        case 'Upgrade':
            message = `${movieWithYear} upgraded to ${quality || 'higher quality'}`;
            break;
        case 'ImportComplete':
            message = `${movieWithYear} import is complete`;
            break;
        case 'MovieAdded':
            message = `${movieWithYear} added to library`;
            break;
        case 'MovieDelete':
            message = `${movie} removed from library`;
            break;
        case 'MovieFileDelete':
        case 'MovieFileDeleteForUpgrade':
            message = `${movie} file deleted`;
            break;
        case 'Health':
            message = payload.message || 'A health issue was detected';
            break;
        case 'HealthRestored':
            message = 'All health issues resolved';
            break;
        case 'ApplicationUpdate':
            message = 'A new version of Radarr is available';
            break;
        case 'ManualInteractionRequired':
            message = `${movie} requires manual intervention`;
            break;
        case 'Test':
            message = 'Successfully connected to Framerr';
            break;
        default:
            message = `Event received for ${movie}`;
    }

    return { title, message };
}

export default router;
