/**
 * Push Subscriptions Database Module
 * 
 * Handles CRUD operations for Web Push notification subscriptions.
 * Each user can have multiple subscriptions (one per device/browser).
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface PushSubscriptionInput {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface PushSubscriptionRow {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    device_name: string | null;
    created_at: number;
    last_used: number | null;
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

/**
 * Create a new push subscription for a user
 */
export function createSubscription(
    userId: string,
    subscription: PushSubscriptionInput,
    deviceName: string | null = null
): PushSubscription | null {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    try {
        const existing = getDb().prepare(
            'SELECT id FROM push_subscriptions WHERE endpoint = ?'
        ).get(subscription.endpoint) as { id: string } | undefined;

        if (existing) {
            getDb().prepare(`
                UPDATE push_subscriptions 
                SET user_id = ?, p256dh = ?, auth = ?, device_name = ?, last_used = NULL
                WHERE endpoint = ?
            `).run(
                userId,
                subscription.keys.p256dh,
                subscription.keys.auth,
                deviceName,
                subscription.endpoint
            );

            logger.info(`[PushSubscriptions] Updated: user=${userId} id=${existing.id}`);

            return getSubscriptionById(existing.id);
        }

        getDb().prepare(`
            INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, device_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            userId,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
            deviceName,
            now
        );

        logger.info(`[PushSubscriptions] Created: user=${userId} id=${id}`);

        return getSubscriptionById(id);
    } catch (error) {
        logger.error(`[PushSubscriptions] Failed to create: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get a subscription by ID
 */
export function getSubscriptionById(id: string): PushSubscription | null {
    return getDb().prepare(
        'SELECT * FROM push_subscriptions WHERE id = ?'
    ).get(id) as PushSubscription | null;
}

/**
 * Get all subscriptions for a user
 */
export function getSubscriptionsByUser(userId: string): PushSubscription[] {
    return getDb().prepare(
        'SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as PushSubscription[];
}

/**
 * Get all active subscriptions (for broadcast scenarios)
 */
export function getAllSubscriptions(): PushSubscription[] {
    return getDb().prepare('SELECT * FROM push_subscriptions').all() as PushSubscription[];
}

/**
 * Delete a subscription by ID (user must own it)
 */
export function deleteSubscriptionById(id: string, userId: string): boolean {
    const result = getDb().prepare(
        'DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    if (result.changes > 0) {
        logger.info(`[PushSubscriptions] Deleted: id=${id} user=${userId}`);
        return true;
    }
    return false;
}

/**
 * Delete a subscription by endpoint (for cleanup on push failure)
 */
export function deleteSubscriptionByEndpoint(endpoint: string): boolean {
    const result = getDb().prepare(
        'DELETE FROM push_subscriptions WHERE endpoint = ?'
    ).run(endpoint);

    if (result.changes > 0) {
        logger.info('[PushSubscriptions] Deleted by endpoint (cleanup)');
        return true;
    }
    return false;
}

/**
 * Update the last_used timestamp for a subscription
 */
export function updateLastUsed(endpoint: string): void {
    const now = Math.floor(Date.now() / 1000);
    getDb().prepare(
        'UPDATE push_subscriptions SET last_used = ? WHERE endpoint = ?'
    ).run(now, endpoint);
}

/**
 * Get subscription by endpoint
 */
export function getSubscriptionByEndpoint(endpoint: string): PushSubscription | null {
    return getDb().prepare(
        'SELECT * FROM push_subscriptions WHERE endpoint = ?'
    ).get(endpoint) as PushSubscription | null;
}
