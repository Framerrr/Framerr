/**
 * Sonarr Webhook Handler
 * 
 * Receives webhooks from Sonarr and creates notifications.
 * All Sonarr events are admin-only (system events, no per-user context).
 * 
 * Endpoint: POST /api/webhooks/sonarr/:token
 */
import { Router, Request, Response } from 'express';
import logger from '../../utils/logger';
import { validateToken, processWebhookNotification } from './_shared';
import {
    SONARR_EVENT_MAP,
    type SonarrWebhookPayload,
    type SonarrEpisodeInfo,
    type NotificationContent
} from './types';

const router = Router();

/**
 * POST /sonarr/:token
 * Receive Sonarr webhook
 */
router.post('/:token', async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const payload = req.body as SonarrWebhookPayload;

    logger.debug(`[Webhook] Received Sonarr: event=${payload.eventType}`);

    const validation = await validateToken('sonarr', token);
    if (!validation.valid) {
        logger.warn(`[Webhook] Invalid Sonarr: reason="${validation.reason}"`);
        res.status(401).json({ error: validation.reason });
        return;
    }

    try {
        // Map Sonarr event to Framerr event key
        let eventKey = SONARR_EVENT_MAP[payload.eventType];

        // Special handling for Health events
        if (payload.eventType === 'Health' && payload.isHealthRestored) {
            eventKey = 'healthRestored';
        }

        if (!eventKey) {
            logger.debug(`[Webhook] Unknown Sonarr event: type=${payload.eventType}`);
            res.status(200).json({ status: 'ignored', reason: 'Unknown event type' });
            return;
        }

        // Build normalized notification content
        const series = payload.series?.title || 'Unknown Series';
        const episodes = payload.episodes || [];
        const quality = payload.release?.quality || null;
        const { title, message } = buildSonarrNotification(payload.eventType, series, episodes, quality, payload);

        // Sonarr doesn't have per-user requests, so notifications go to admins only
        const result = await processWebhookNotification({
            service: 'sonarr',
            eventKey,
            username: null, // No user association for Sonarr
            title,
            message,
            webhookConfig: validation.webhookConfig!,
            adminOnly: true
        });

        res.status(200).json({ status: 'ok', ...result });
    } catch (error) {
        logger.error(`[Webhook] Sonarr processing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

/**
 * Build normalized notification for Sonarr events
 */
function buildSonarrNotification(
    eventType: string,
    series: string,
    episodes: SonarrEpisodeInfo[],
    quality: string | null,
    payload: SonarrWebhookPayload
): NotificationContent {
    const titleMap: Record<string, string> = {
        'Grab': 'Episode Grabbed',
        'Download': 'Episode Downloaded',
        'Upgrade': 'Episode Upgraded',
        'ImportComplete': 'Import Complete',
        'Rename': 'Episode Renamed',
        'SeriesAdd': 'Series Added',
        'SeriesDelete': 'Series Removed',
        'EpisodeFileDelete': 'Episode Deleted',
        'EpisodeFileDeleteForUpgrade': 'Episode Deleted for Upgrade',
        'Health': 'Health Warning',
        'HealthRestored': 'Health Restored',
        'ApplicationUpdate': 'Update Available',
        'ManualInteractionRequired': 'Action Required',
        'Test': 'Test Notification'
    };

    const title = `Sonarr: ${titleMap[eventType] || 'Notification'}`;

    // Build episode info
    let episodeInfo = '';
    if (episodes && episodes.length > 0) {
        const ep = episodes[0];
        episodeInfo = `Season ${ep.seasonNumber} Episode ${ep.episodeNumber}`;
    }

    let message: string;
    switch (eventType) {
        case 'Grab':
            message = episodeInfo
                ? `${series} ${episodeInfo} grabbed${quality ? ` in ${quality}` : ''}`
                : `${series} grabbed${quality ? ` in ${quality}` : ''}`;
            break;
        case 'Download':
            message = episodeInfo
                ? `${series} ${episodeInfo} downloaded`
                : `${series} downloaded`;
            break;
        case 'Upgrade':
            message = episodeInfo
                ? `${series} ${episodeInfo} upgraded to ${quality || 'higher quality'}`
                : `${series} upgraded to ${quality || 'higher quality'}`;
            break;
        case 'ImportComplete':
            message = episodeInfo
                ? `${series} ${episodeInfo} import is complete`
                : `${series} import is complete`;
            break;
        case 'SeriesAdd':
            message = `${series} added to library`;
            break;
        case 'SeriesDelete':
            message = `${series} removed from library`;
            break;
        case 'EpisodeFileDelete':
        case 'EpisodeFileDeleteForUpgrade':
            message = episodeInfo
                ? `${series} ${episodeInfo} file deleted`
                : `${series} episode file deleted`;
            break;
        case 'Health':
            message = payload.message || 'A health issue was detected';
            break;
        case 'HealthRestored':
            message = 'All health issues resolved';
            break;
        case 'ApplicationUpdate':
            message = 'A new version of Sonarr is available';
            break;
        case 'ManualInteractionRequired':
            message = `${series} requires manual intervention`;
            break;
        case 'Test':
            message = 'Successfully connected to Framerr';
            break;
        default:
            message = `Event received for ${series}`;
    }

    return { title, message };
}

export default router;
