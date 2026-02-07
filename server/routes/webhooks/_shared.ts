/**
 * Shared Webhook Utilities
 * 
 * Token validation and notification routing logic shared across all webhook handlers.
 */
import * as integrationInstancesDb from '../../db/integrationInstances';
import { createNotification } from '../../db/notifications';
import { resolveUserByUsername, getAdminsWithReceiveUnmatched, userWantsEvent } from '../../services/webhookUserResolver';
import { getSystemIconIdForService } from '../../services/systemIcons';
import { listUsers } from '../../db/users';
import logger from '../../utils/logger';
import type {
    WebhookService,
    WebhookConfig,
    TokenValidationResult,
    ProcessNotificationParams,
    NotificationSent,
    User
} from './types';

/**
 * Validate webhook token against stored config
 */
export async function validateToken(service: WebhookService, token: string): Promise<TokenValidationResult> {
    try {
        // Get integration instance from new table
        const instance = integrationInstancesDb.getFirstEnabledByType(service);

        if (!instance) {
            return { valid: false, reason: 'Integration not configured or disabled' };
        }

        const webhookConfig = instance.config.webhookConfig as WebhookConfig | undefined;

        if (!webhookConfig?.webhookEnabled) {
            return { valid: false, reason: 'Webhook not enabled' };
        }

        if (webhookConfig.webhookToken !== token) {
            return { valid: false, reason: 'Invalid token' };
        }

        return { valid: true, webhookConfig };
    } catch (error) {
        logger.error(`[Webhook] Token validation error: error="${(error as Error).message}"`);
        return { valid: false, reason: 'Validation error' };
    }
}

/**
 * Process webhook and create notifications for appropriate users
 * 
 * Routing logic:
 * - Admin events (requestPending, issues) → Admins
 * - User events (approved, available, declined) → User who requested
 * - Failed events → Both user and admins
 * - Test events → All admins
 */
export async function processWebhookNotification({
    service,
    eventKey,
    username,
    title,
    message,
    webhookConfig,
    metadata = null,
    adminOnly = false
}: ProcessNotificationParams): Promise<{ notificationsSent: number }> {
    const notificationsSent: NotificationSent[] = [];

    // Get the system icon ID for this service
    const iconId = getSystemIconIdForService(service);

    // Always include service in metadata for proper grouping
    // Merge with any additional actionable metadata (like requestId)
    const mergedMetadata = metadata
        ? { ...metadata, service: metadata.service || service }
        : { service };

    // Define event routing
    const ADMIN_EVENTS = ['requestPending', 'issueReported', 'issueReopened'];
    const USER_EVENTS = ['requestApproved', 'requestAvailable', 'requestDeclined', 'issueResolved', 'issueComment'];
    const BOTH_EVENTS = ['requestFailed', 'requestAutoApproved'];

    const isTestEvent = eventKey === 'test';
    const isAdminEvent = ADMIN_EVENTS.includes(eventKey);
    const isUserEvent = USER_EVENTS.includes(eventKey);
    const isBothEvent = BOTH_EVENTS.includes(eventKey);

    logger.info(`[Webhook] Processing: service=${service} event=${eventKey} user="${username}" test=${isTestEvent} admin=${isAdminEvent}`);

    // Helper: Get all admins
    const getAdmins = async (): Promise<User[]> => {
        const users = await listUsers();
        return users.filter(u => u.group === 'admin') as User[];
    };

    // Helper: Send to admins (with preference check)
    const sendToAdmins = async (titleOverride: string | null = null, messageOverride: string | null = null): Promise<void> => {
        const admins = await getAdmins();

        for (const admin of admins) {
            const wantsEvent = await userWantsEvent(admin.id, service, eventKey, true, webhookConfig);

            if (wantsEvent) {
                await createNotification({
                    userId: admin.id,
                    type: 'info',
                    title: titleOverride || title,
                    message: messageOverride || message,
                    iconId,
                    metadata: mergedMetadata
                });
                notificationsSent.push({ userId: admin.id, username: admin.username, role: 'admin' });
                logger.debug(`[Webhook] Admin notification sent: admin=${admin.id} event=${eventKey}`);
            }
        }
    };

    // Helper: Send to specific user
    const sendToUser = async (user: User): Promise<void> => {
        const isAdmin = user.group === 'admin';
        const wantsEvent = await userWantsEvent(user.id, service, eventKey, isAdmin, webhookConfig);

        if (wantsEvent) {
            await createNotification({
                userId: user.id,
                type: 'info',
                title,
                message,
                iconId,
                metadata: mergedMetadata
            });
            notificationsSent.push({ userId: user.id, username: user.username, role: 'user' });
            logger.debug(`[Webhook] User notification sent: user=${user.id} event=${eventKey}`);
        }
    };

    // ============================================
    // ROUTING LOGIC
    // ============================================

    if (isTestEvent) {
        // Test notifications - always send to all admins
        const admins = await getAdmins();

        for (const admin of admins) {
            await createNotification({
                userId: admin.id,
                type: 'success',
                title: `[Test] ${title}`,
                message: message || 'Test notification received successfully!',
                iconId,
                metadata: { service } // Include service for proper grouping, but not actionable
            });
            notificationsSent.push({ userId: admin.id, username: admin.username, test: true });
        }

        // Also send to users if 'test' is in userEvents
        const userEvents = webhookConfig?.userEvents || [];
        if (userEvents.includes('test')) {
            const users = await listUsers();
            const nonAdmins = users.filter(u => u.group !== 'admin') as User[];

            for (const user of nonAdmins) {
                const wantsEvent = await userWantsEvent(user.id, service, 'test', false, webhookConfig);
                if (wantsEvent) {
                    await createNotification({
                        userId: user.id,
                        type: 'success',
                        title: `[Test] ${title}`,
                        message: message || 'Test notification received successfully!',
                        iconId,
                        metadata: { service }
                    });
                    notificationsSent.push({ userId: user.id, username: user.username, test: true });
                }
            }
        }

        logger.info(`[Webhook] Test notifications sent: count=${notificationsSent.length}`);
        return { notificationsSent: notificationsSent.length };
    }

    if (adminOnly) {
        // Admin-only notifications (Sonarr/Radarr system events)
        await sendToAdmins();
        logger.info(`[Webhook] Admin-only: service=${service} event=${eventKey} count=${notificationsSent.length}`);
        return { notificationsSent: notificationsSent.length };
    }

    if (isAdminEvent) {
        // Events that should go to admins (request pending, new issues)
        await sendToAdmins();
        logger.info(`[Webhook] Admin event sent: event=${eventKey} count=${notificationsSent.length}`);
        return { notificationsSent: notificationsSent.length };
    }

    if (isUserEvent && username) {
        // Events that should go to the user who triggered them
        const user = await resolveUserByUsername(username, service);

        if (user) {
            await sendToUser(user as User);
            logger.info(`[Webhook] User event sent: user=${user.id} event=${eventKey}`);
        } else {
            // User not found - send to admins with receiveUnmatched
            logger.debug('[Webhook] User not found, sending to admins with receiveUnmatched');
            const admins = await getAdminsWithReceiveUnmatched();

            for (const admin of admins) {
                const wantsEvent = await userWantsEvent(admin.id, service, eventKey, true, webhookConfig);

                if (wantsEvent) {
                    await createNotification({
                        userId: admin.id,
                        type: 'info',
                        title: `[Unmatched] ${title}`,
                        message: `From: ${username}\n${message}`,
                        iconId,
                        metadata: { service } // Include service for proper grouping
                    });
                    notificationsSent.push({ userId: admin.id, username: admin.username, unmatched: true });
                }
            }
        }
        return { notificationsSent: notificationsSent.length };
    }

    if (isBothEvent && username) {
        // Events that should go to BOTH user and admins
        const user = await resolveUserByUsername(username, service);

        // Send to user if found
        if (user) {
            await sendToUser(user as User);
        }

        // Send to admins, but skip the user if they already received it (avoid duplicate)
        // This prevents admins from getting the notification twice when they are also the requester
        const skipUserId = user?.id || null;
        const admins = await getAdmins();

        for (const admin of admins) {
            // Skip if this admin is the user who already received the notification
            if (skipUserId && admin.id === skipUserId) {
                logger.debug(`[Webhook] Skipping admin (already requester): admin=${admin.id}`);
                continue;
            }

            const wantsEvent = await userWantsEvent(admin.id, service, eventKey, true, webhookConfig);

            if (wantsEvent) {
                await createNotification({
                    userId: admin.id,
                    type: 'info',
                    title,
                    message,
                    iconId,
                    metadata: mergedMetadata
                });
                notificationsSent.push({ userId: admin.id, username: admin.username, role: 'admin' });
                logger.debug(`[Webhook] Admin notification sent: admin=${admin.id} event=${eventKey}`);
            }
        }

        logger.info(`[Webhook] Both sent: event=${eventKey} count=${notificationsSent.length}`);
        return { notificationsSent: notificationsSent.length };
    }

    // Fallback: If we can't determine routing, send to admins
    logger.warn(`[Webhook] Unknown routing, falling back to admins: event=${eventKey}`);
    await sendToAdmins();

    return { notificationsSent: notificationsSent.length };
}
