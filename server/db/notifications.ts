import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Lazy-load notificationEmitter to avoid circular dependency
let notificationEmitter: { sendNotification: (userId: string, notification: unknown) => void } | null = null;

function getEmitter() {
    if (!notificationEmitter) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require('../services/notificationEmitter');
        // Handle both CommonJS and ES module interop
        notificationEmitter = module.default || module;
    }
    return notificationEmitter!;
}

interface NotificationData {
    userId: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    iconId?: string | null;
    iconIds?: string[];  // For batched notifications
    metadata?: Record<string, unknown> | null;
    expiresAt?: string | null;
}

interface Notification {
    id: string;
    userId: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    iconId: string | null;
    iconIds: string[] | null;  // For batched notifications
    read: boolean;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    expiresAt: string | null;
}

interface NotificationRow {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    icon_id: string | null;
    icon_ids: string | null;  // JSON array string
    read: number;
    metadata: string | null;
    created_at: number;
}

interface NotificationFilters {
    unread?: boolean;
    limit?: number | string;
    offset?: number | string;
}

interface NotificationsResult {
    notifications: Notification[];
    unreadCount: number;
    total: number;
}

interface CountResult {
    count: number;
}

/**
 * Create a notification
 */
export async function createNotification(notificationData: NotificationData): Promise<Notification> {
    const notification: Notification = {
        id: uuidv4(),
        userId: notificationData.userId,
        type: notificationData.type || 'info',
        title: notificationData.title,
        message: notificationData.message,
        iconId: notificationData.iconId || null,
        iconIds: notificationData.iconIds || null,
        read: false,
        metadata: notificationData.metadata || null,
        createdAt: new Date().toISOString(),
        expiresAt: notificationData.expiresAt || null
    };

    try {
        const insert = getDb().prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, icon_id, icon_ids, metadata, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        `);

        insert.run(
            notification.id,
            notification.userId,
            notification.title,
            notification.message,
            notification.type,
            notification.iconId,
            notification.iconIds ? JSON.stringify(notification.iconIds) : null,
            notification.metadata ? JSON.stringify(notification.metadata) : null,
            notification.read ? 1 : 0
        );

        logger.debug(`[Notifications] Created: id=${notification.id} user=${notification.userId} type=${notification.type}`);

        try {
            getEmitter().sendNotification(notification.userId, notification);
        } catch (sseError) {
            logger.debug(`[Notifications] SSE emit failed: error="${(sseError as Error).message}"`);
        }

        return notification;
    } catch (error) {
        logger.error(`[Notifications] Failed to create: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: string, filters: NotificationFilters = {}): Promise<NotificationsResult> {
    try {
        const offset = parseInt(String(filters.offset)) || 0;
        const limit = parseInt(String(filters.limit)) || 50;

        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params: (string | number)[] = [userId];

        if (filters.unread === true) {
            query += ' AND read = 0';
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const notifications = getDb().prepare(query).all(...params) as NotificationRow[];

        let countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?';
        const countParams: string[] = [userId];

        if (filters.unread === true) {
            countQuery += ' AND read = 0';
        }

        const totalResult = getDb().prepare(countQuery).get(...countParams) as CountResult;
        const total = totalResult.count;

        const unreadResult = getDb().prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
        ).get(userId) as CountResult;
        const unreadCount = unreadResult.count;

        const formattedNotifications: Notification[] = notifications.map(n => {
            let parsedMetadata: Record<string, unknown> | null = null;
            if (n.metadata) {
                try {
                    parsedMetadata = JSON.parse(n.metadata);
                } catch {
                    logger.warn(`[Notifications] Failed to parse metadata: id=${n.id}`);
                }
            }
            return {
                id: n.id,
                userId: n.user_id,
                type: n.type as Notification['type'],
                title: n.title,
                message: n.message,
                iconId: n.icon_id || null,
                iconIds: n.icon_ids ? JSON.parse(n.icon_ids) : null,
                read: n.read === 1,
                metadata: parsedMetadata,
                createdAt: new Date(n.created_at * 1000).toISOString(),
                expiresAt: null
            };
        });

        return {
            notifications: formattedNotifications,
            unreadCount,
            total
        };
    } catch (error) {
        logger.error(`[Notifications] Failed to get: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    try {
        const update = getDb().prepare(`
            UPDATE notifications
            SET read = 1
            WHERE id = ? AND user_id = ?
        `);

        const result = update.run(notificationId, userId);

        if (result.changes === 0) {
            return null;
        }

        const notification = getDb().prepare(
            'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
        ).get(notificationId, userId) as NotificationRow;

        logger.debug(`[Notifications] Marked read: id=${notificationId} user=${userId}`);

        try {
            getEmitter().sendNotification(userId, {
                type: 'sync',
                action: 'markRead',
                notificationId
            });
        } catch (sseError) {
            logger.debug(`[Notifications] SSE sync emit failed: error="${(sseError as Error).message}"`);
        }

        return {
            id: notification.id,
            userId: notification.user_id,
            type: notification.type as Notification['type'],
            title: notification.title,
            message: notification.message,
            iconId: notification.icon_id || null,
            iconIds: notification.icon_ids ? JSON.parse(notification.icon_ids) : null,
            read: notification.read === 1,
            metadata: null,
            createdAt: new Date(notification.created_at * 1000).toISOString(),
            expiresAt: null
        };
    } catch (error) {
        logger.error(`[Notifications] Failed to mark read: id=${notificationId} user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
        const deleteStmt = getDb().prepare(`
            DELETE FROM notifications
            WHERE id = ? AND user_id = ?
        `);

        const result = deleteStmt.run(notificationId, userId);

        if (result.changes === 0) {
            return false;
        }

        logger.debug(`[Notifications] Deleted: id=${notificationId} user=${userId}`);

        try {
            getEmitter().sendNotification(userId, {
                type: 'sync',
                action: 'delete',
                notificationId
            });
        } catch (sseError) {
            logger.debug(`[Notifications] SSE sync emit failed: error="${(sseError as Error).message}"`);
        }

        return true;
    } catch (error) {
        logger.error(`[Notifications] Failed to delete: id=${notificationId} user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
    try {
        const update = getDb().prepare(`
            UPDATE notifications
            SET read = 1
            WHERE user_id = ? AND read = 0
        `);

        const result = update.run(userId);
        const updatedCount = result.changes;

        if (updatedCount > 0) {
            logger.info(`[Notifications] Marked all read: user=${userId} count=${updatedCount}`);

            try {
                getEmitter().sendNotification(userId, {
                    type: 'sync',
                    action: 'markAllRead'
                });
            } catch (sseError) {
                logger.debug(`[Notifications] SSE sync emit failed: error="${(sseError as Error).message}"`);
            }
        }

        return updatedCount;
    } catch (error) {
        logger.error(`[Notifications] Failed to mark all read: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Clear all notifications for a user
 */
export async function clearAll(userId: string): Promise<number> {
    try {
        const deleteStmt = getDb().prepare(`
            DELETE FROM notifications
            WHERE user_id = ?
        `);

        const result = deleteStmt.run(userId);
        const deletedCount = result.changes;

        if (deletedCount > 0) {
            logger.info(`[Notifications] Cleared all: user=${userId} count=${deletedCount}`);

            try {
                getEmitter().sendNotification(userId, {
                    type: 'sync',
                    action: 'clearAll'
                });
            } catch (sseError) {
                logger.debug(`[Notifications] SSE sync emit failed: error="${(sseError as Error).message}"`);
            }
        }

        return deletedCount;
    } catch (error) {
        logger.error(`[Notifications] Failed to clear all: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById(notificationId: string, userId: string): Promise<Notification | null> {
    try {
        const notification = getDb().prepare(
            'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
        ).get(notificationId, userId) as NotificationRow | undefined;

        if (!notification) {
            return null;
        }

        let parsedMetadata: Record<string, unknown> | null = null;
        if (notification.metadata) {
            try {
                parsedMetadata = JSON.parse(notification.metadata);
            } catch {
                logger.warn(`[Notifications] Failed to parse metadata: id=${notification.id}`);
            }
        }

        return {
            id: notification.id,
            userId: notification.user_id,
            type: notification.type as Notification['type'],
            title: notification.title,
            message: notification.message,
            iconId: notification.icon_id || null,
            iconIds: notification.icon_ids ? JSON.parse(notification.icon_ids) : null,
            read: notification.read === 1,
            metadata: parsedMetadata,
            createdAt: new Date(notification.created_at * 1000).toISOString(),
            expiresAt: null
        };
    } catch (error) {
        logger.error(`[Notifications] Failed to get by ID: id=${notificationId} user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Clean up expired notifications (no-op in current implementation)
 */
export async function cleanupExpiredNotifications(): Promise<void> {
    logger.debug('cleanupExpiredNotifications called (no-op in SQLite implementation)');
}
