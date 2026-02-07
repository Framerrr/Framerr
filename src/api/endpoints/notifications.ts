/**
 * Notifications API Endpoints
 * Notification management, push subscriptions, and request actions
 */
import { api } from '../client';
import type { Notification, PushSubscriptionRecord } from '../../../shared/types/notification';

// Types
export interface CreateNotificationData {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    userId?: string;
}

export interface NotificationFilters {
    unread?: boolean;
    limit?: number;
    offset?: number;
}

export interface NotificationsResponse {
    notifications?: Notification[];
    unreadCount?: number;
}

export interface PushSubscriptionsResponse {
    subscriptions?: PushSubscriptionRecord[];
}

export interface VapidKeyResponse {
    publicKey: string;
}

export interface WebPushStatusResponse {
    enabled?: boolean;
}

export interface RequestActionResponse {
    alreadyHandled?: boolean;
    message?: string;
    error?: string;
}

export interface VapidKeyResponse {
    publicKey: string;
}

export interface WebPushStatusResponse {
    enabled?: boolean;
}

export interface RequestActionResponse {
    alreadyHandled?: boolean;
    message?: string;
    error?: string;
}

// Endpoints
export const notificationsApi = {
    // =========================================================================
    // Notification CRUD
    // =========================================================================

    /**
     * Get notifications with optional filters
     */
    getAll: (filters: NotificationFilters = {}) => {
        const params = new URLSearchParams();
        if (filters.unread) params.append('unread', 'true');
        if (filters.limit) params.append('limit', String(filters.limit));
        if (filters.offset) params.append('offset', String(filters.offset));
        const query = params.toString();
        return api.get<NotificationsResponse>(`/api/notifications${query ? `?${query}` : ''}`);
    },

    /**
     * Create a new notification (test notification)
     */
    create: (data: CreateNotificationData) =>
        api.post<Notification>('/api/notifications', data),

    /**
     * Mark notification as read
     */
    markRead: (id: string) =>
        api.patch<void>(`/api/notifications/${id}/read`),

    /**
     * Delete a notification
     */
    delete: (id: string) =>
        api.delete<void>(`/api/notifications/${id}`),

    /**
     * Mark all notifications as read
     */
    markAllRead: () =>
        api.post<void>('/api/notifications/mark-all-read'),

    /**
     * Clear all notifications
     */
    clearAll: () =>
        api.delete<void>('/api/notifications/clear-all'),

    // =========================================================================
    // Push Notifications
    // =========================================================================

    /**
     * Get VAPID public key for push subscription
     */
    getVapidKey: () =>
        api.get<VapidKeyResponse>('/api/notifications/push/vapid-key'),

    /**
     * Get all push subscriptions for current user
     */
    getPushSubscriptions: () =>
        api.get<PushSubscriptionsResponse>('/api/notifications/push/subscriptions'),

    /**
     * Subscribe to push notifications
     */
    subscribeToPush: (subscription: PushSubscriptionJSON, deviceName: string) =>
        api.post<void>('/api/notifications/push/subscribe', { subscription, deviceName }),

    /**
     * Remove a push subscription
     */
    removePushSubscription: (subscriptionId: string) =>
        api.delete<void>(`/api/notifications/push/subscriptions/${subscriptionId}`),

    /**
     * Send test push notification
     */
    testPush: () =>
        api.post<void>('/api/notifications/push/test'),

    /**
     * Get global web push status
     */
    getWebPushStatus: () =>
        api.get<WebPushStatusResponse>('/api/config/web-push-status'),

    // =========================================================================
    // Request Actions (Overseerr approve/decline)
    // =========================================================================

    /**
     * Approve a request from notification
     */
    approveRequest: (notificationId: string) =>
        api.post<RequestActionResponse>(`/api/request-actions/overseerr/approve/${notificationId}`),

    /**
     * Decline a request from notification
     */
    declineRequest: (notificationId: string) =>
        api.post<RequestActionResponse>(`/api/request-actions/overseerr/decline/${notificationId}`),
};

export default notificationsApi;
