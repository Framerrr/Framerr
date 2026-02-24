/**
 * Overseerr Webhook Plugin Handler
 * 
 * Migrated from routes/webhooks/overseerr.ts to plugin architecture.
 * Overseerr has both admin events (pending, issues) and user events (approved, available).
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

interface OverseerrWebhookPayload {
    event?: string;
    notification_type?: string;
    notificationType?: string;
    type?: string;
    subject?: string;
    message?: string;
    media?: { title: string };
    request?: {
        id?: number;
        request_id?: number;
        requestId?: number;
        requestedBy_username?: string;
    };
    issue?: {
        reportedBy_username?: string;
    };
}

// ============================================================================
// Event Definitions
// ============================================================================

const events: WebhookEventDefinition[] = [
    // Request events
    { key: 'requestPending', label: 'Request Pending', category: 'request', adminOnly: true, defaultAdmin: true },
    { key: 'requestApproved', label: 'Request Approved', category: 'request', defaultAdmin: true, defaultUser: true },
    { key: 'requestAutoApproved', label: 'Auto-Approved', category: 'request', defaultAdmin: true, defaultUser: true },
    { key: 'requestAvailable', label: 'Now Available', category: 'request', defaultAdmin: true, defaultUser: true },
    { key: 'requestDeclined', label: 'Request Declined', category: 'request', defaultUser: true },
    { key: 'requestFailed', label: 'Request Failed', category: 'request', adminOnly: true, defaultAdmin: true },
    { key: 'requestProcessing', label: 'Processing Started', category: 'request' },
    // Issue events
    { key: 'issueReported', label: 'Issue Reported', category: 'issue', defaultAdmin: true },
    { key: 'issueComment', label: 'Issue Comment', category: 'issue' },
    { key: 'issueResolved', label: 'Issue Resolved', category: 'issue' },
    { key: 'issueReopened', label: 'Issue Reopened', category: 'issue' },
    // System
    { key: 'test', label: 'Test Notification', category: 'system', adminOnly: true, defaultAdmin: true, defaultUser: false },
];

// Map Overseerr event names to our keys
const EVENT_MAP: Record<string, string> = {
    'media.pending': 'requestPending',
    'media.approved': 'requestApproved',
    'media.auto_approved': 'requestAutoApproved',
    'media.available': 'requestAvailable',
    'media.declined': 'requestDeclined',
    'media.failed': 'requestFailed',
    'media.processing': 'requestProcessing',
    'issue.created': 'issueReported',
    'issue.comment': 'issueComment',
    'issue.resolved': 'issueResolved',
    'issue.reopened': 'issueReopened',
    'test': 'test',
    // Alternative event names from different Overseerr/Jellyseerr versions
    'MEDIA_PENDING': 'requestPending',
    'MEDIA_APPROVED': 'requestApproved',
    'MEDIA_AUTO_APPROVED': 'requestAutoApproved',
    'MEDIA_AVAILABLE': 'requestAvailable',
    'MEDIA_DECLINED': 'requestDeclined',
    'MEDIA_FAILED': 'requestFailed',
    'TEST_NOTIFICATION': 'test',
};

// ============================================================================
// Handler
// ============================================================================

async function handle(
    payload: unknown,
    instance: PluginInstance,
    webhookSettings: WebhookSettings
): Promise<WebhookResult> {
    const data = payload as OverseerrWebhookPayload;
    const eventType = data.event || data.notification_type || data.notificationType || data.type;

    logger.debug(`[Webhook] Overseerr processing: instanceId=${instance.id} event=${eventType}`);

    const eventKey = eventType ? EVENT_MAP[eventType] : undefined;

    if (!eventKey) {
        logger.debug(`[Webhook] Unknown Overseerr event: type=${eventType}`);
        return { success: true, message: 'Unknown event type, ignored' };
    }

    // Check if event is enabled (test events always bypass this check)
    if (eventKey !== 'test' && !webhookSettings.enabledEvents.includes(eventKey)) {
        return { success: true, message: 'Event type not enabled' };
    }

    // Extract username
    let username: string | null = null;
    if (data.request?.requestedBy_username) {
        username = data.request.requestedBy_username;
    } else if (data.issue?.reportedBy_username) {
        username = data.issue.reportedBy_username;
    }

    // Build notification
    const mediaTitle = data.subject || data.media?.title || 'Unknown';
    const { title, message } = buildNotification(eventKey, mediaTitle, username, data, instance.name);

    // Extract requestId for actionable notifications
    const requestId = data.request?.id || data.request?.request_id || data.request?.requestId || null;
    const metadata = requestId && eventKey === 'requestPending' ? {
        requestId,
        service: 'overseerr',
        actionable: true,
        mediaTitle
    } : null;

    const webhookConfig = instance.config.webhookConfig as { adminEvents?: string[]; userEvents?: string[] } | undefined;

    // Determine if admin only based on event definition
    const eventDef = events.find(e => e.key === eventKey);
    const adminOnly = eventDef?.adminOnly ?? false;

    const result = await processWebhookNotification({
        service: 'overseerr',
        eventKey,
        username,
        title,
        message,
        webhookConfig: {
            webhookEnabled: true,
            webhookToken: webhookSettings.token,
            adminEvents: webhookConfig?.adminEvents || [],
            userEvents: webhookConfig?.userEvents || [],
        },
        metadata,
        adminOnly
    });

    return {
        success: true,
        message: `Sent ${result.notificationsSent} notifications`,
        broadcast: {
            topic: `overseerr:${instance.id}`,
            data: { event: eventKey, payload: data }
        }
    };
}

// ============================================================================
// Notification Builder
// ============================================================================

function buildNotification(
    eventKey: string,
    mediaTitle: string,
    username: string | null,
    payload: OverseerrWebhookPayload,
    instanceName?: string
): { title: string; message: string } {
    const titleMap: Record<string, string> = {
        'requestPending': 'Request Pending',
        'requestApproved': 'Request Approved',
        'requestAutoApproved': 'Request Auto-Approved',
        'requestAvailable': 'Now Available',
        'requestDeclined': 'Request Declined',
        'requestFailed': 'Request Failed',
        'requestProcessing': 'Processing Started',
        'issueReported': 'Issue Reported',
        'issueComment': 'New Comment',
        'issueResolved': 'Issue Resolved',
        'issueReopened': 'Issue Reopened',
        'test': 'Test Notification'
    };

    // Use instance display name directly (defaults to integration type name if not customized)
    const displayName = instanceName || 'Seerr';
    const eventLabel = titleMap[eventKey] || 'Notification';
    const title = `${displayName}: ${eventLabel}`;

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
        case 'requestProcessing':
            message = `Request for "${mediaTitle}" is now processing`;
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

// ============================================================================
// URL Builder
// ============================================================================

function buildExternalUrl(instance: PluginInstance, token: string): string {
    return `/api/webhooks/overseerr/${instance.id}/${token}`;
}

// ============================================================================
// Export
// ============================================================================

export const webhook: WebhookConfig = {
    events,
    handle,
    buildExternalUrl,
};
