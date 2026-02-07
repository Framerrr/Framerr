/**
 * Notification Event Emitter
 * 
 * Handles real-time notification delivery via SSE (Server-Sent Events)
 * and Web Push notifications. Implements selective routing:
 * - If user has SSE connection → send SSE via unified sseStreamService
 * - If no SSE connection → send Web Push to subscribed devices
 * 
 * Phase 7: Migrated to use unified SSE - no longer manages its own connections.
 */

import { EventEmitter } from 'events';
import webpush from 'web-push';
import logger from '../utils/logger';
import { hasUserConnection, broadcastToUser } from './sseStreamService';

// Lazy-load imports to avoid circular dependencies
type PushSubscriptionsDb = typeof import('../db/pushSubscriptions');
type SystemConfigDb = typeof import('../db/systemConfig');

let pushSubscriptionsDb: PushSubscriptionsDb | null = null;
let systemConfigDb: SystemConfigDb | null = null;

function getPushSubscriptionsDb(): PushSubscriptionsDb {
    if (!pushSubscriptionsDb) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        pushSubscriptionsDb = require('../db/pushSubscriptions');
    }
    return pushSubscriptionsDb!;
}

function getSystemConfigDb(): SystemConfigDb {
    if (!systemConfigDb) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        systemConfigDb = require('../db/systemConfig');
    }
    return systemConfigDb!;
}

interface Notification {
    id?: string;
    type?: string;
    title?: string;
    message?: string;
    iconId?: string | null;
    metadata?: Record<string, unknown>;
}

interface SendOptions {
    forceWebPush?: boolean;
}

interface PushSubscription {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    device_name: string | null;
    created_at: number;
    last_used: number | null;
}

class NotificationEmitter extends EventEmitter {
    // Phase 7: Connection tracking moved to sseStreamService
    private vapidInitialized: boolean;

    constructor() {
        super();
        // VAPID keys initialized flag
        this.vapidInitialized = false;
    }

    /**
     * Initialize VAPID keys for Web Push
     * Called lazily on first push attempt
     */
    async initializeVapid(): Promise<void> {
        if (this.vapidInitialized) return;

        try {
            const { getSystemConfig, updateSystemConfig } = getSystemConfigDb();
            const config = await getSystemConfig();

            // Check if VAPID keys exist
            if (config.vapidKeys?.publicKey && config.vapidKeys?.privateKey) {
                webpush.setVapidDetails(
                    'mailto:noreply@framerr.app',
                    config.vapidKeys.publicKey,
                    config.vapidKeys.privateKey
                );
                this.vapidInitialized = true;
                logger.info('[WebPush] VAPID keys loaded from config');
                return;
            }

            // Generate new VAPID keys
            const vapidKeys = webpush.generateVAPIDKeys();
            await updateSystemConfig({
                vapidKeys: {
                    publicKey: vapidKeys.publicKey,
                    privateKey: vapidKeys.privateKey
                }
            });

            webpush.setVapidDetails(
                'mailto:noreply@framerr.app',
                vapidKeys.publicKey,
                vapidKeys.privateKey
            );

            this.vapidInitialized = true;
            logger.info('[WebPush] Generated new VAPID keys');
        } catch (error) {
            logger.error(`[WebPush] Failed to initialize VAPID: error="${(error as Error).message}"`);
        }
    }

    /**
     * Get VAPID public key for frontend
     */
    async getVapidPublicKey(): Promise<string | null> {
        await this.initializeVapid();
        try {
            const { getSystemConfig } = getSystemConfigDb();
            const config = await getSystemConfig();
            return config.vapidKeys?.publicKey || null;
        } catch (error) {
            logger.error(`[WebPush] Failed to get VAPID public key: error="${(error as Error).message}"`);
            return null;
        }
    }


    /**
     * Check if user has active SSE connection.
     * Phase 7: Delegates to sseStreamService.
     */
    hasConnection(userId: string): boolean {
        return hasUserConnection(userId);
    }

    /**
     * Send notification via SSE to a specific user.
     * Phase 7: Uses unified sseStreamService.broadcastToUser().
     */
    sendSSE(userId: string, notification: Notification): boolean {
        if (hasUserConnection(userId)) {
            broadcastToUser(userId, 'notification', notification);
            logger.debug(`[SSE Unified] Notification sent via sseStreamService: userId=${userId}`);
            return true;
        }
        return false;
    }

    /**
     * Send Web Push notification to a user's subscribed devices
     */
    async sendWebPush(userId: string, notification: Notification): Promise<void> {
        // Check if Web Push is globally enabled
        try {
            const { getSystemConfig } = getSystemConfigDb();
            const config = await getSystemConfig();
            if (config.webPushEnabled === false) {
                logger.debug('[WebPush] Web Push globally disabled, skipping');
                return;
            }
        } catch (configError) {
            logger.warn(`[WebPush] Could not check global config, proceeding: error="${(configError as Error).message}"`);
        }

        await this.initializeVapid();

        if (!this.vapidInitialized) {
            logger.warn('[WebPush] VAPID not initialized, skipping push');
            return;
        }

        try {
            const { getSubscriptionsByUser, deleteSubscriptionByEndpoint, updateLastUsed } = getPushSubscriptionsDb();
            const subscriptions = getSubscriptionsByUser(userId) as PushSubscription[];

            if (subscriptions.length === 0) {
                logger.debug(`[WebPush] No subscriptions for user: userId=${userId}`);
                return;
            }

            logger.debug(`[WebPush] Sending to subscriptions: userId=${userId} count=${subscriptions.length}`);

            const payload = JSON.stringify({
                title: notification.title,
                body: notification.message,
                type: notification.type,
                id: notification.id,
                timestamp: Date.now()
            });

            logger.debug(`[WebPush] Payload: ${payload}`);

            const pushPromises = subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                logger.debug(`[WebPush] Attempting push: endpoint=${sub.endpoint.slice(-30)} hasP256dh=${!!sub.p256dh} hasAuth=${!!sub.auth}`);

                try {
                    const result = await webpush.sendNotification(pushSubscription, payload);
                    updateLastUsed(sub.endpoint);
                    logger.debug(`[WebPush] Push sent successfully: userId=${userId} endpoint=${sub.endpoint.slice(-30)} statusCode=${result?.statusCode}`);
                } catch (pushError) {
                    const err = pushError as { statusCode?: number; body?: string; message?: string };
                    // Handle expired/invalid subscriptions
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        logger.info(`[WebPush] Subscription expired, removing: endpoint=${sub.endpoint.slice(-30)}`);
                        deleteSubscriptionByEndpoint(sub.endpoint);
                    } else {
                        logger.error(`[WebPush] Failed to send: userId=${userId} endpoint=${sub.endpoint.slice(-30)} statusCode=${err.statusCode} error="${err.message}"`);
                    }
                }
            });

            await Promise.allSettled(pushPromises);
        } catch (error) {
            logger.error(`[WebPush] Error sending push notifications: userId=${userId} error="${(error as Error).message}"`);
        }
    }

    /**
     * Send a notification to a specific user
     * Uses selective routing: SSE if connected, Web Push if not
     */
    async sendNotification(userId: string, notification: Notification, options: SendOptions = {}): Promise<void> {
        const { forceWebPush = false } = options;

        // Skip Web Push for sync events (SSE-only, used for cross-tab state sync)
        if (notification.type === 'sync') {
            if (this.hasConnection(userId)) {
                this.sendSSE(userId, notification);
            }
            return;
        }

        // If forcing Web Push (for testing), send push regardless of SSE
        if (forceWebPush) {
            await this.sendWebPush(userId, notification);
            return;
        }

        // Send to ALL channels for real notifications:
        // - SSE to any open browser tabs
        // - Web Push to all subscribed devices (phone, other browsers)
        if (this.hasConnection(userId)) {
            this.sendSSE(userId, notification);
        }
        await this.sendWebPush(userId, notification);
    }
}

// Singleton instance
const notificationEmitter = new NotificationEmitter();

export default notificationEmitter;
