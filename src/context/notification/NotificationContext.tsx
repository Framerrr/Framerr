/**
 * NotificationContext - Unified notification system entry point
 * 
 * P3 Phase 3: Split into focused sub-contexts for better performance.
 * This thin wrapper composes all sub-contexts and provides backwards-compatible
 * useNotifications() hook that returns the full interface.
 */

import React, { useMemo, ReactNode } from 'react';
import { ToastProvider, useToasts, type ToastContextValue } from './ToastContext';
import { NotificationCenterProvider, useNotificationCenter, type NotificationCenterContextValue } from './NotificationCenterContext';
import { PushProvider, usePush, type PushContextValue } from './PushContext';
import type { NotificationContextValue } from '../../types/context/notification';

// ============================================
// Composing Provider
// ============================================

interface NotificationProviderProps {
    children: ReactNode;
}

/**
 * Notification provider that composes all sub-contexts.
 * Provides backwards-compatible access via useNotifications().
 */
export const NotificationProvider = ({ children }: NotificationProviderProps): React.JSX.Element => {
    return (
        <ToastProvider>
            <NotificationCenterProvider>
                <PushProvider>
                    {children}
                </PushProvider>
            </NotificationCenterProvider>
        </ToastProvider>
    );
};

// ============================================
// Backwards-Compatible Hook
// ============================================

/**
 * Unified notification hook (backwards-compatible).
 * Composes values from all sub-contexts into the original interface.
 */
export const useNotifications = (): NotificationContextValue => {
    const toast = useToasts();
    const center = useNotificationCenter();
    const push = usePush();

    // Memoize the combined value to prevent unnecessary re-renders
    const value: NotificationContextValue = useMemo(() => ({
        // Toast state & actions
        toasts: toast.toasts,
        showToast: toast.showToast,
        dismissToast: toast.dismissToast,
        success: toast.success,
        error: toast.error,
        warning: toast.warning,
        info: toast.info,

        // Notification center state & actions
        notifications: center.notifications,
        unreadCount: center.unreadCount,
        loading: center.loading,
        fetchNotifications: center.fetchNotifications,
        addNotification: center.addNotification,
        markAsRead: center.markAsRead,
        deleteNotification: center.deleteNotification,
        markAllAsRead: center.markAllAsRead,
        clearAll: center.clearAll,
        handleRequestAction: center.handleRequestAction,

        // Notification center UI state
        notificationCenterOpen: center.notificationCenterOpen,
        setNotificationCenterOpen: center.setNotificationCenterOpen,
        openNotificationCenter: center.openNotificationCenter,

        // SSE connection state
        connected: center.connected,

        // Web Push state & actions
        pushSupported: push.pushSupported,
        pushPermission: push.pushPermission,
        pushEnabled: push.pushEnabled,
        pushSubscriptions: push.pushSubscriptions,
        currentEndpoint: push.currentEndpoint,
        globalPushEnabled: push.globalPushEnabled,
        requestPushPermission: push.requestPushPermission,
        subscribeToPush: push.subscribeToPush,
        unsubscribeFromPush: push.unsubscribeFromPush,
        removePushSubscription: push.removePushSubscription,
        testPushNotification: push.testPushNotification,
        fetchPushSubscriptions: push.fetchPushSubscriptions,
        fetchGlobalPushStatus: push.fetchGlobalPushStatus
    }), [toast, center, push]);

    return value;
};

// Re-export sub-context hooks for direct access
export { useToasts } from './ToastContext';
export { useNotificationCenter } from './NotificationCenterContext';
export { usePush } from './PushContext';

// Re-export types
export type { ToastContextValue } from './ToastContext';
export type { NotificationCenterContextValue } from './NotificationCenterContext';
export type { PushContextValue } from './PushContext';
