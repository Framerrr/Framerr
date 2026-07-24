import { useMemo } from 'react';
import { useToasts } from './useToasts';
import { useNotificationCenter } from './useNotificationCenter';
import { usePush } from './usePush';
import type { NotificationContextValue } from '../../types/context/notification';

/**
 * Unified notification hook (backwards-compatible).
 * Composes values from all sub-contexts into the original interface.
 */
export const useNotifications = (): NotificationContextValue => {
    const toast = useToasts();
    const center = useNotificationCenter();
    const push = usePush();

    const value: NotificationContextValue = useMemo(() => ({
        toasts: toast.toasts,
        showToast: toast.showToast,
        dismissToast: toast.dismissToast,
        success: toast.success,
        error: toast.error,
        warning: toast.warning,
        info: toast.info,
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
        notificationCenterOpen: center.notificationCenterOpen,
        setNotificationCenterOpen: center.setNotificationCenterOpen,
        openNotificationCenter: center.openNotificationCenter,
        connected: center.connected,
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
