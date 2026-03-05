/**
 * Notification Producer Gateway
 *
 * Unified ingress point for all notification creation.
 * Wraps createNotification with validation and source-tagged telemetry.
 *
 * All producers MUST use produceNotification() instead of calling
 * createNotification() from db/notifications directly.
 */
import { createNotification } from '../db/notifications';
import type { NotificationData, Notification } from '../db/notifications';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type NotificationSource =
    | 'webhook'
    | 'batcher'
    | 'api'
    | 'template-sharing'
    | 'service-monitor'
    | 'test';

const VALID_TYPES = ['success', 'error', 'warning', 'info'] as const;

// ============================================================================
// Gateway Function
// ============================================================================

/**
 * Produce a notification through the gateway.
 *
 * Validates required fields and delegates to createNotification for
 * DB persistence and SSE/push delivery.
 *
 * @param data - Notification payload (same shape as createNotification)
 * @param source - Producer identifier for telemetry/debugging
 * @returns The created Notification
 */
export async function produceNotification(
    data: NotificationData,
    source: NotificationSource
): Promise<Notification> {
    // Validate required fields
    if (!data.userId) throw new Error('Notification missing userId');
    if (!data.title) throw new Error('Notification missing title');
    // Allow empty-string message (used by serviceMonitors/actions.ts)
    if (!data.message && data.message !== '') throw new Error('Notification missing message');

    // Validate type if provided
    if (data.type && !(VALID_TYPES as readonly string[]).includes(data.type)) {
        throw new Error(`Invalid notification type: ${data.type}`);
    }

    logger.debug(`[NotificationGateway] Producing: source=${source} user=${data.userId} type=${data.type || 'info'} title="${data.title}"`);

    const notification = await createNotification(data);

    logger.debug(`[NotificationGateway] Produced: id=${notification.id} source=${source}`);

    return notification;
}

// Re-export types for consumer convenience
export type { NotificationData, Notification } from '../db/notifications';
