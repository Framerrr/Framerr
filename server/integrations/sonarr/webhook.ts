/**
 * Sonarr Webhook Plugin Handler
 * 
 * Migrated from routes/webhooks/sonarr.ts to plugin architecture.
 * All Sonarr events are admin-only (no per-user context).
 */
import type {
    WebhookConfig,
    WebhookEventDefinition,
    WebhookResult,
    PluginInstance,
    WebhookSettings
} from '../types';
import { processWebhookNotification } from '../../routes/webhooks/_shared';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SonarrEpisodeInfo {
    seasonNumber: number;
    episodeNumber: number;
    title?: string;
}

interface SonarrWebhookPayload {
    eventType: string;
    series?: { title: string };
    episodes?: SonarrEpisodeInfo[];
    release?: { quality: string };
    message?: string;
    isHealthRestored?: boolean;
}

// ============================================================================
// Event Definitions (for schema/frontend)
// ============================================================================

const events: WebhookEventDefinition[] = [
    { key: 'grab', label: 'Episode Grabbed', category: 'download', defaultAdmin: true },
    { key: 'download', label: 'Episode Downloaded', category: 'download', defaultAdmin: true },
    { key: 'upgrade', label: 'Episode Upgraded', category: 'download' },
    { key: 'importComplete', label: 'Import Complete', category: 'download' },
    { key: 'rename', label: 'Episode Renamed', category: 'library' },
    { key: 'seriesAdd', label: 'Series Added', category: 'library' },
    { key: 'seriesDelete', label: 'Series Removed', category: 'library' },
    { key: 'episodeFileDelete', label: 'Episode Deleted', category: 'library' },
    { key: 'healthIssue', label: 'Health Issue', category: 'system', defaultAdmin: true },
    { key: 'healthRestored', label: 'Health Restored', category: 'system' },
    { key: 'applicationUpdate', label: 'Update Available', category: 'system' },
    { key: 'manualInteractionRequired', label: 'Manual Action Required', category: 'system', defaultAdmin: true },
    { key: 'test', label: 'Test Notification', category: 'system', defaultAdmin: true, defaultUser: false },
];

// Map Sonarr's event names to our keys
const EVENT_MAP: Record<string, string> = {
    'Grab': 'grab',
    'Download': 'download',
    'Upgrade': 'upgrade',
    'ImportComplete': 'importComplete',
    'Rename': 'rename',
    'SeriesAdd': 'seriesAdd',
    'SeriesDelete': 'seriesDelete',
    'EpisodeFileDelete': 'episodeFileDelete',
    'EpisodeFileDeleteForUpgrade': 'episodeFileDelete',
    'Health': 'healthIssue',
    'HealthRestored': 'healthRestored',
    'ApplicationUpdate': 'applicationUpdate',
    'ManualInteractionRequired': 'manualInteractionRequired',
    'Test': 'test',
};

// ============================================================================
// Handler
// ============================================================================

async function handle(
    payload: unknown,
    instance: PluginInstance,
    webhookSettings: WebhookSettings
): Promise<WebhookResult> {
    const data = payload as SonarrWebhookPayload;

    logger.debug(`[Webhook] Sonarr processing: instanceId=${instance.id} event=${data.eventType}`);

    // Map event type
    let eventKey = EVENT_MAP[data.eventType];

    // Special handling for restored health
    if (data.eventType === 'Health' && data.isHealthRestored) {
        eventKey = 'healthRestored';
    }

    if (!eventKey) {
        logger.debug(`[Webhook] Unknown Sonarr event: type=${data.eventType}`);
        return { success: true, message: 'Unknown event type, ignored' };
    }

    // Check if event is enabled (test events always bypass this check)
    if (eventKey !== 'test' && !webhookSettings.enabledEvents.includes(eventKey)) {
        return { success: true, message: 'Event type not enabled' };
    }

    // Build notification content
    const series = data.series?.title || 'Unknown Series';
    const episodes = data.episodes || [];
    const quality = data.release?.quality || null;
    const { title, message } = buildNotification(data.eventType, series, episodes, quality, data, instance.name);

    // Get webhook config from instance
    const webhookConfig = instance.config.webhookConfig as { adminEvents?: string[]; userEvents?: string[] } | undefined;

    // Process and send notifications
    const result = await processWebhookNotification({
        service: 'sonarr',
        eventKey,
        username: null, // No user association for Sonarr
        title,
        message,
        webhookConfig: {
            webhookEnabled: true,
            webhookToken: webhookSettings.token,
            adminEvents: webhookConfig?.adminEvents || [],
            userEvents: webhookConfig?.userEvents || [],
        },
        adminOnly: true
    });

    return {
        success: true,
        message: `Sent ${result.notificationsSent} notifications`,
        broadcast: {
            topic: `sonarr:${instance.id}`,
            data: { event: eventKey, payload: data }
        }
    };
}

// ============================================================================
// Notification Builder
// ============================================================================

function buildNotification(
    eventType: string,
    series: string,
    episodes: SonarrEpisodeInfo[],
    quality: string | null,
    payload: SonarrWebhookPayload,
    instanceDisplayName?: string
): { title: string; message: string } {
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

    // Use instance display name directly (defaults to integration type name if not customized)
    const displayName = instanceDisplayName || 'Sonarr';
    const eventName = titleMap[eventType] || 'Notification';
    const title = `${displayName}: ${eventName}`;

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

// ============================================================================
// URL Builder
// ============================================================================

function buildExternalUrl(instance: PluginInstance, token: string): string {
    // This builds the URL format for configuring in Sonarr's settings
    // The base URL should come from system config (set by admin)
    return `/api/webhooks/sonarr/${instance.id}/${token}`;
}

// ============================================================================
// Export
// ============================================================================

export const webhook: WebhookConfig = {
    events,
    handle,
    buildExternalUrl,
};
