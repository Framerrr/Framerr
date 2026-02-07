/**
 * Radarr Webhook Plugin Handler
 * 
 * Migrated from routes/webhooks/radarr.ts to plugin architecture.
 * All Radarr events are admin-only (no per-user context).
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

interface RadarrWebhookPayload {
    eventType: string;
    movie?: { title: string; year?: number };
    release?: { quality: string };
    message?: string;
    isHealthRestored?: boolean;
}

// ============================================================================
// Event Definitions
// ============================================================================

const events: WebhookEventDefinition[] = [
    { key: 'grab', label: 'Movie Grabbed', category: 'download', defaultAdmin: true },
    { key: 'download', label: 'Movie Downloaded', category: 'download', defaultAdmin: true },
    { key: 'upgrade', label: 'Movie Upgraded', category: 'download' },
    { key: 'importComplete', label: 'Import Complete', category: 'download' },
    { key: 'rename', label: 'Movie Renamed', category: 'library' },
    { key: 'movieAdded', label: 'Movie Added', category: 'library' },
    { key: 'movieDelete', label: 'Movie Removed', category: 'library' },
    { key: 'movieFileDelete', label: 'Movie File Deleted', category: 'library' },
    { key: 'healthIssue', label: 'Health Issue', category: 'system', defaultAdmin: true },
    { key: 'healthRestored', label: 'Health Restored', category: 'system' },
    { key: 'applicationUpdate', label: 'Update Available', category: 'system' },
    { key: 'manualInteractionRequired', label: 'Manual Action Required', category: 'system', defaultAdmin: true },
    { key: 'test', label: 'Test Notification', category: 'system', defaultAdmin: true, defaultUser: false },
];

// Map Radarr's event names to our keys
const EVENT_MAP: Record<string, string> = {
    'Grab': 'grab',
    'Download': 'download',
    'Upgrade': 'upgrade',
    'ImportComplete': 'importComplete',
    'Rename': 'rename',
    'MovieAdded': 'movieAdded',
    'MovieDelete': 'movieDelete',
    'MovieFileDelete': 'movieFileDelete',
    'MovieFileDeleteForUpgrade': 'movieFileDelete',
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
    const data = payload as RadarrWebhookPayload;

    logger.debug(`[Webhook] Radarr processing: instanceId=${instance.id} event=${data.eventType}`);

    // Map event type
    let eventKey = EVENT_MAP[data.eventType];

    if (data.eventType === 'Health' && data.isHealthRestored) {
        eventKey = 'healthRestored';
    }

    if (!eventKey) {
        logger.debug(`[Webhook] Unknown Radarr event: type=${data.eventType}`);
        return { success: true, message: 'Unknown event type, ignored' };
    }

    // Check if event is enabled (test events always bypass this check)
    if (eventKey !== 'test' && !webhookSettings.enabledEvents.includes(eventKey)) {
        return { success: true, message: 'Event type not enabled' };
    }

    // Build notification
    const movie = data.movie?.title || 'Unknown Movie';
    const year = data.movie?.year || null;
    const quality = data.release?.quality || null;
    const { title, message } = buildNotification(data.eventType, movie, year, quality, data, instance.name);

    const webhookConfig = instance.config.webhookConfig as { adminEvents?: string[]; userEvents?: string[] } | undefined;

    const result = await processWebhookNotification({
        service: 'radarr',
        eventKey,
        username: null,
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
            topic: `radarr:${instance.id}`,
            data: { event: eventKey, payload: data }
        }
    };
}

// ============================================================================
// Notification Builder
// ============================================================================

function buildNotification(
    eventType: string,
    movie: string,
    year: number | null,
    quality: string | null,
    payload: RadarrWebhookPayload,
    instanceName?: string
): { title: string; message: string } {
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

    // Use instance display name directly (defaults to integration type name if not customized)
    const displayName = instanceName || 'Radarr';
    const eventName = titleMap[eventType] || 'Notification';
    const title = `${displayName}: ${eventName}`;
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

// ============================================================================
// URL Builder
// ============================================================================

function buildExternalUrl(instance: PluginInstance, token: string): string {
    return `/api/webhooks/radarr/${instance.id}/${token}`;
}

// ============================================================================
// Export
// ============================================================================

export const webhook: WebhookConfig = {
    events,
    handle,
    buildExternalUrl,
};
