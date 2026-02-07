/**
 * PushContext - Web Push notification state management
 * 
 * Extracted from NotificationContext as part of P3 Phase 3 split.
 * Manages service worker registration, push subscriptions, and push permissions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '../AuthContext';
import { useNotificationCenter } from './NotificationCenterContext';
import logger from '../../utils/logger';
import { notificationsApi } from '../../api/endpoints/notifications';
import type { PushSubscriptionRecord } from '../../../shared/types/notification';

// ============================================
// Helpers
// ============================================

/** Auto-detect device name from user agent */
function detectDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
}

/** Convert VAPID key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ============================================
// Types
// ============================================

export interface PushContextValue {
    /** Whether browser supports web push */
    pushSupported: boolean;

    /** Current push permission state */
    pushPermission: NotificationPermission;

    /** Whether push is enabled for this device */
    pushEnabled: boolean;

    /** All push subscriptions for current user */
    pushSubscriptions: PushSubscriptionRecord[];

    /** Current device's push endpoint (if subscribed) */
    currentEndpoint: string | null;

    /** Whether push is enabled globally (admin setting) */
    globalPushEnabled: boolean;

    /** Request push notification permission */
    requestPushPermission: () => Promise<NotificationPermission>;

    /** Subscribe this device to push notifications */
    subscribeToPush: (deviceName?: string | null) => Promise<boolean>;

    /** Unsubscribe this device from push */
    unsubscribeFromPush: () => Promise<void>;

    /** Remove a push subscription by ID */
    removePushSubscription: (id: string) => Promise<void>;

    /** Send a test push notification */
    testPushNotification: () => Promise<boolean>;

    /** Fetch push subscriptions from server */
    fetchPushSubscriptions: () => Promise<void>;

    /** Fetch global push enabled status */
    fetchGlobalPushStatus: () => Promise<void>;
}

// ============================================
// Context
// ============================================

const PushContext = createContext<PushContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface PushProviderProps {
    children: ReactNode;
}

export const PushProvider = ({ children }: PushProviderProps): React.JSX.Element => {
    const { isAuthenticated, user } = useAuth();
    const { showToastForNotification } = useNotificationCenter();

    // Web Push state
    const [pushSupported, setPushSupported] = useState<boolean>(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [pushEnabled, setPushEnabled] = useState<boolean>(false);
    const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionRecord[]>([]);
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
    const [globalPushEnabled, setGlobalPushEnabled] = useState<boolean>(true);

    // Check if Web Push is supported
    useEffect(() => {
        const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        setPushSupported(isSupported);

        if (isSupported) {
            setPushPermission(Notification.permission);
        }
    }, []);

    // Register Service Worker on mount
    useEffect(() => {
        if (!pushSupported) return;

        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                logger.info('[Push] Service Worker registered');
                setSwRegistration(registration);

                registration.pushManager.getSubscription()
                    .then((subscription) => {
                        setPushEnabled(!!subscription);
                        setCurrentEndpoint(subscription?.endpoint || null);
                    });
            })
            .catch((error: Error) => {
                logger.error('[Push] Service Worker registration failed', { error: error.message });
            });
    }, [pushSupported]);

    // Fetch push subscriptions when authenticated
    const fetchPushSubscriptions = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) return;

        try {
            const response = await notificationsApi.getPushSubscriptions();
            setPushSubscriptions(response.subscriptions || []);
        } catch (error) {
            logger.error('[Push] Failed to fetch subscriptions', { error: (error as Error).message });
        }
    }, [isAuthenticated]);

    // Fetch global push status
    const fetchGlobalPushStatus = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) return;

        try {
            const response = await notificationsApi.getWebPushStatus();
            setGlobalPushEnabled(response.enabled !== false);
        } catch (error) {
            logger.error('[Push] Failed to fetch global push status', { error: (error as Error).message });
            setGlobalPushEnabled(true);
        }
    }, [isAuthenticated]);

    // Request push notification permission
    const requestPushPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!pushSupported) {
            throw new Error('Push notifications not supported');
        }

        const permission = await Notification.requestPermission();
        setPushPermission(permission);

        if (permission !== 'granted') {
            throw new Error('Push notification permission denied');
        }

        return permission;
    }, [pushSupported]);

    // Subscribe to push notifications
    const subscribeToPush = useCallback(async (deviceName: string | null = null): Promise<boolean> => {
        if (!pushSupported || !swRegistration) {
            throw new Error('Push notifications not supported or SW not ready');
        }

        if (pushPermission !== 'granted') {
            await requestPushPermission();
        }

        try {
            const vapidResponse = await notificationsApi.getVapidKey();
            const publicKey = vapidResponse.publicKey;

            const applicationServerKey = urlBase64ToUint8Array(publicKey);

            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey.buffer as ArrayBuffer
            });

            const autoDeviceName = deviceName || detectDeviceName();

            await notificationsApi.subscribeToPush(subscription.toJSON(), autoDeviceName);

            setPushEnabled(true);
            setCurrentEndpoint(subscription.endpoint);
            await fetchPushSubscriptions();

            logger.info('[Push] Subscribed successfully', { deviceName: autoDeviceName });

            return true;
        } catch (error) {
            logger.error('[Push] Subscription failed', { error: (error as Error).message });
            throw error;
        }
    }, [pushSupported, swRegistration, pushPermission, requestPushPermission, fetchPushSubscriptions]);

    // Unsubscribe THIS device from push notifications
    const unsubscribeFromPush = useCallback(async (): Promise<void> => {
        if (!swRegistration) return;

        try {
            const subscription = await swRegistration.pushManager.getSubscription();
            if (subscription) {
                const endpoint = subscription.endpoint;

                const matchingSub = pushSubscriptions.find(s => s.endpoint === endpoint);

                await subscription.unsubscribe();

                if (matchingSub) {
                    await notificationsApi.removePushSubscription(matchingSub.id);
                    setPushSubscriptions(prev => prev.filter(s => s.id !== matchingSub.id));
                }
            }

            setPushEnabled(false);
            setCurrentEndpoint(null);
            logger.info('[Push] Unsubscribed this device successfully');
        } catch (error) {
            logger.error('[Push] Unsubscribe failed', { error: (error as Error).message });
            throw error;
        }
    }, [swRegistration, pushSubscriptions]);

    // Remove a specific push subscription
    const removePushSubscription = useCallback(async (subscriptionId: string): Promise<void> => {
        try {
            const subToRemove = pushSubscriptions.find(s => s.id === subscriptionId);
            const isThisDevice = subToRemove && subToRemove.endpoint === currentEndpoint;

            await notificationsApi.removePushSubscription(subscriptionId);

            setPushSubscriptions(prev => prev.filter(s => s.id !== subscriptionId));

            if (isThisDevice) {
                setPushEnabled(false);
                setCurrentEndpoint(null);

                if (swRegistration) {
                    const browserSub = await swRegistration.pushManager.getSubscription();
                    if (browserSub) {
                        await browserSub.unsubscribe();
                    }
                }

                logger.info('[Push] This device subscription removed');
            } else {
                logger.info('[Push] Other device subscription removed', { subscriptionId });
            }
        } catch (error) {
            logger.error('[Push] Failed to remove subscription', { error: (error as Error).message });
            throw error;
        }
    }, [swRegistration, pushSubscriptions, currentEndpoint]);

    // Send test push notification
    const testPushNotification = useCallback(async (): Promise<boolean> => {
        try {
            await notificationsApi.testPush();
            logger.info('[Push] Test notification sent');
            return true;
        } catch (error) {
            logger.error('[Push] Test notification failed', { error: (error as Error).message });
            throw error;
        }
    }, []);

    // Load push subscriptions and global status when authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            fetchPushSubscriptions();
            fetchGlobalPushStatus();
        } else {
            setPushSubscriptions([]);
            setGlobalPushEnabled(true);
        }
    }, [isAuthenticated, user, fetchPushSubscriptions, fetchGlobalPushStatus]);

    // Listen for service worker messages (push click handling)
    useEffect(() => {
        const handleMessage = (event: MessageEvent): void => {
            if (event.data?.type === 'NOTIFICATION_CLICK') {
                logger.info('[SW Message] Notification click received', { notificationId: event.data.notificationId });
                if (event.data.notificationId) {
                    showToastForNotification(event.data.notificationId);
                }
            }
        };

        navigator.serviceWorker?.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
    }, [showToastForNotification]);

    // Check URL hash on mount for notification ID
    useEffect(() => {
        const checkNotificationHash = (): void => {
            const hash = window.location.hash;
            const match = hash.match(/#notification=([a-f0-9-]+)/i);

            if (match) {
                const notificationId = match[1];
                logger.info('[URL Hash] Notification ID found', { notificationId });

                window.history.replaceState(null, '', window.location.pathname);

                setTimeout(() => {
                    showToastForNotification(notificationId);
                }, 500);
            }
        };

        if (isAuthenticated && user) {
            checkNotificationHash();
        }
    }, [isAuthenticated, user, showToastForNotification]);

    // Memoize context value
    const value: PushContextValue = useMemo(() => ({
        pushSupported,
        pushPermission,
        pushEnabled,
        pushSubscriptions,
        currentEndpoint,
        globalPushEnabled,
        requestPushPermission,
        subscribeToPush,
        unsubscribeFromPush,
        removePushSubscription,
        testPushNotification,
        fetchPushSubscriptions,
        fetchGlobalPushStatus
    }), [
        pushSupported, pushPermission, pushEnabled, pushSubscriptions, currentEndpoint, globalPushEnabled,
        requestPushPermission, subscribeToPush, unsubscribeFromPush, removePushSubscription, testPushNotification, fetchPushSubscriptions, fetchGlobalPushStatus
    ]);

    return (
        <PushContext.Provider value={value}>
            {children}
        </PushContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const usePush = (): PushContextValue => {
    const context = useContext(PushContext);
    if (!context) {
        throw new Error('usePush must be used within a PushProvider');
    }
    return context;
};

export { PushContext };
