/**
 * NotificationContext Types
 * Types for notification and toast state management
 */

import type {
    Notification,
    Toast,
    NotificationType,
    ToastOptions,
    NotificationFilters,
    PushSubscriptionRecord
} from '../../../shared/types/notification';

/**
 * NotificationContext value provided to consumers
 */
export interface NotificationContextValue {
    // ============================================
    // Toast State & Methods
    // ============================================

    /**
     * Active toast notifications
     */
    toasts: Toast[];

    /**
     * Show a toast notification
     */
    showToast: (
        type: NotificationType,
        title: string,
        message: string,
        options?: ToastOptions
    ) => string;

    /**
     * Dismiss a toast by ID
     */
    dismissToast: (id: string) => void;

    /**
     * Convenience: show success toast
     */
    success: (title: string, message: string, options?: ToastOptions) => string;

    /**
     * Convenience: show error toast
     */
    error: (title: string, message: string, options?: ToastOptions) => string;

    /**
     * Convenience: show warning toast
     */
    warning: (title: string, message: string, options?: ToastOptions) => string;

    /**
     * Convenience: show info toast
     */
    info: (title: string, message: string, options?: ToastOptions) => string;

    // ============================================
    // Notification Center State & Methods
    // ============================================

    /**
     * Persistent notifications from server
     */
    notifications: Notification[];

    /**
     * Count of unread notifications
     */
    unreadCount: number;

    /**
     * True while fetching notifications
     */
    loading: boolean;

    /**
     * Fetch notifications from server
     */
    fetchNotifications: (filters?: NotificationFilters) => Promise<void>;

    /**
     * Add a notification to local state (from SSE)
     */
    addNotification: (notification: Notification) => void;

    /**
     * Mark a notification as read
     */
    markAsRead: (id: string) => Promise<void>;

    /**
     * Delete a notification
     */
    deleteNotification: (id: string) => Promise<void>;

    /**
     * Mark all notifications as read
     */
    markAllAsRead: () => Promise<void>;

    /**
     * Delete all notifications
     */
    clearAll: () => Promise<void>;

    /**
     * Handle approve/decline action on request notification
     */
    handleRequestAction: (id: string, action: 'approve' | 'decline') => Promise<unknown>;

    // ============================================
    // Notification Center UI State
    // ============================================

    /**
     * Whether notification center panel is open
     */
    notificationCenterOpen: boolean;

    /**
     * Set notification center open state
     */
    setNotificationCenterOpen: (open: boolean) => void;

    /**
     * Open the notification center
     */
    openNotificationCenter: () => void;

    // ============================================
    // SSE Connection State (Phase 7: Managed by unified useRealtimeSSE)
    // ============================================

    /**
     * Whether SSE connection is active (from unified useRealtimeSSE)
     */
    connected: boolean;

    // ============================================
    // Web Push State & Methods
    // ============================================

    /**
     * Whether browser supports web push
     */
    pushSupported: boolean;

    /**
     * Current push permission state
     */
    pushPermission: NotificationPermission;

    /**
     * Whether push is enabled for this device
     */
    pushEnabled: boolean;

    /**
     * All push subscriptions for current user
     */
    pushSubscriptions: PushSubscriptionRecord[];

    /**
     * Current device's push endpoint (if subscribed)
     */
    currentEndpoint: string | null;

    /**
     * Whether push is enabled globally (admin setting)
     */
    globalPushEnabled: boolean;

    /**
     * Request push notification permission
     */
    requestPushPermission: () => Promise<NotificationPermission>;

    /**
     * Subscribe this device to push notifications
     */
    subscribeToPush: (deviceName?: string) => Promise<boolean>;

    /**
     * Unsubscribe this device from push
     */
    unsubscribeFromPush: () => Promise<void>;

    /**
     * Remove a push subscription by ID
     */
    removePushSubscription: (id: string) => Promise<void>;

    /**
     * Send a test push notification
     */
    testPushNotification: () => Promise<boolean>;

    /**
     * Fetch push subscriptions from server
     */
    fetchPushSubscriptions: () => Promise<void>;

    /**
     * Fetch global push enabled status
     */
    fetchGlobalPushStatus: () => Promise<void>;
}

/**
 * NotificationProvider props
 */
export interface NotificationProviderProps {
    children: React.ReactNode;
}
