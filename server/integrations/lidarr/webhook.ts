/**
 * Lidarr Webhook Plugin Handler
 * 
 * Migrated from routes/webhooks/sonarr.ts to plugin architecture.
 * All Lidarr events are admin-only (no per-user context).
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

interface LidarrAlbumInfo {
    title?: string;
    albumType?: string;
}

interface LidarrWebhookPayload {
    eventType: string;
    artist?: { artistName: string };
    albums?: LidarrAlbumInfo[];
    release?: { quality: string };
    message?: string;
    isHealthRestored?: boolean;
}

// ============================================================================
// Event Definitions (for schema/frontend)
// ============================================================================

const events: WebhookEventDefinition[] = [
    { key: 'grab', label: 'Album Grabbed', category: 'download', defaultAdmin: true },
    { key: 'download', label: 'Album Downloaded', category: 'download', defaultAdmin: true },
    { key: 'rename', label: 'Album Renamed', category: 'library' },
    { key: 'retag', label: 'Album Retagged', category: 'library' },
    { key: 'artistAdd', label: 'Artist Added', category: 'library' },
    { key: 'artistDelete', label: 'Artist Removed', category: 'library' },
    { key: 'albumDelete', label: 'Album Removed', category: 'library' },
    { key: 'trackFileDelete', label: 'Track Deleted', category: 'library' },
    { key: 'healthIssue', label: 'Health Issue', category: 'system', defaultAdmin: true },
    { key: 'healthRestored', label: 'Health Restored', category: 'system' },
    { key: 'applicationUpdate', label: 'Update Available', category: 'system' },
    { key: 'manualInteractionRequired', label: 'Manual Action Required', category: 'system', defaultAdmin: true },
    { key: 'test', label: 'Test Notification', category: 'system', defaultAdmin: true, defaultUser: false },
];

// Map Lidarr's event names to our keys
const EVENT_MAP: Record<string, string> = {
    'Grab': 'grab',
    'Download': 'download',
    'AlbumImport': 'download',
    'Rename': 'rename',
    'Retag': 'retag',
    'ArtistAdd': 'artistAdd',
    'ArtistDelete': 'artistDelete',
    'AlbumDelete': 'albumDelete',
    'TrackFileDelete': 'trackFileDelete',
    'TrackFileDeleteForUpgrade': 'trackFileDelete',
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
    const data = payload as LidarrWebhookPayload;

    logger.debug(`[Webhook] Lidarr processing: instanceId=${instance.id} event=${data.eventType}`);

    // Map event type
    let eventKey = EVENT_MAP[data.eventType];

    // Special handling for restored health
    if (data.eventType === 'Health' && data.isHealthRestored) {
        eventKey = 'healthRestored';
    }

    if (!eventKey) {
        logger.debug(`[Webhook] Unknown Lidarr event: type=${data.eventType}`);
        return { success: true, message: 'Unknown event type, ignored' };
    }

    // Check if event is enabled (test events always bypass this check)
    if (eventKey !== 'test' && !webhookSettings.enabledEvents.includes(eventKey)) {
        return { success: true, message: 'Event type not enabled' };
    }

    // Build notification content
    const artist = data.artist?.artistName || 'Unknown Artist';
    const albums = data.albums || [];
    const quality = data.release?.quality || null;
    const { title, message } = buildNotification(data.eventType, artist, albums, quality, data, instance.name);

    // Get webhook config from instance
    const webhookConfig = instance.config.webhookConfig as { adminEvents?: string[]; userEvents?: string[] } | undefined;

    // Process and send notifications
    const result = await processWebhookNotification({
        service: 'lidarr',
        eventKey,
        username: null, // No user association for Lidarr
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
            topic: `lidarr:${instance.id}`,
            data: { event: eventKey, payload: data }
        }
    };
}

// ============================================================================
// Notification Builder
// ============================================================================

function buildNotification(
    eventType: string,
    artist: string,
    albums: LidarrAlbumInfo[],
    quality: string | null,
    payload: LidarrWebhookPayload,
    instanceDisplayName?: string
): { title: string; message: string } {
    const titleMap: Record<string, string> = {
        'Grab': 'Album Grabbed',
        'Download': 'Album Downloaded',
        'AlbumImport': 'Album Imported',
        'Rename': 'Album Renamed',
        'Retag': 'Album Retagged',
        'ArtistAdd': 'Artist Added',
        'ArtistDelete': 'Artist Removed',
        'AlbumDelete': 'Album Removed',
        'TrackFileDelete': 'Track Deleted',
        'TrackFileDeleteForUpgrade': 'Track Deleted for Upgrade',
        'Health': 'Health Warning',
        'HealthRestored': 'Health Restored',
        'ApplicationUpdate': 'Update Available',
        'ManualInteractionRequired': 'Action Required',
        'Test': 'Test Notification'
    };

    // Use instance display name directly (defaults to integration type name if not customized)
    const displayName = instanceDisplayName || 'Lidarr';
    const eventName = titleMap[eventType] || 'Notification';
    const title = `${displayName}: ${eventName}`;

    // Build album info
    let albumInfo = '';
    if (albums && albums.length > 0) {
        const album = albums[0];
        albumInfo = album.title || '';
    }

    let message: string;
    switch (eventType) {
        case 'Grab':
            message = albumInfo
                ? `${artist} — ${albumInfo} grabbed${quality ? ` in ${quality}` : ''}`
                : `${artist} grabbed${quality ? ` in ${quality}` : ''}`;
            break;
        case 'Download':
        case 'AlbumImport':
            message = albumInfo
                ? `${artist} — ${albumInfo} downloaded`
                : `${artist} downloaded`;
            break;
        case 'Rename':
            message = albumInfo
                ? `${artist} — ${albumInfo} renamed`
                : `${artist} album renamed`;
            break;
        case 'Retag':
            message = albumInfo
                ? `${artist} — ${albumInfo} retagged`
                : `${artist} album retagged`;
            break;
        case 'ArtistAdd':
            message = `${artist} added to library`;
            break;
        case 'ArtistDelete':
            message = `${artist} removed from library`;
            break;
        case 'AlbumDelete':
            message = albumInfo
                ? `${artist} — ${albumInfo} removed from library`
                : `${artist} album removed from library`;
            break;
        case 'TrackFileDelete':
        case 'TrackFileDeleteForUpgrade':
            message = albumInfo
                ? `${artist} — ${albumInfo} track file deleted`
                : `${artist} track file deleted`;
            break;
        case 'Health':
            message = payload.message || 'A health issue was detected';
            break;
        case 'HealthRestored':
            message = 'All health issues resolved';
            break;
        case 'ApplicationUpdate':
            message = 'A new version of Lidarr is available';
            break;
        case 'ManualInteractionRequired':
            message = `${artist} requires manual intervention`;
            break;
        case 'Test':
            message = 'Successfully connected to Framerr';
            break;
        default:
            message = `Event received for ${artist}`;
    }

    return { title, message };
}

// ============================================================================
// URL Builder
// ============================================================================

function buildExternalUrl(instance: PluginInstance, token: string): string {
    // This builds the URL format for configuring in Lidarr's settings
    // The base URL should come from system config (set by admin)
    return `/api/webhooks/lidarr/${instance.id}/${token}`;
}

// ============================================================================
// Export
// ============================================================================

export const webhook: WebhookConfig = {
    events,
    handle,
    buildExternalUrl,
};
