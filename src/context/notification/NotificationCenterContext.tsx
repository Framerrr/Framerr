/**
 * NotificationCenterContext - Notification center state management
 * 
 * Extracted from NotificationContext as part of P3 Phase 3 split.
 * Manages persistent notifications, SSE delivery, and notification center UI.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from '../AuthContext';
import { useToasts } from './ToastContext';
import logger from '../../utils/logger';
import { useRealtimeSSE, type NotificationEvent } from '../../hooks/useRealtimeSSE';
import { notificationsApi } from '../../api/endpoints/notifications';
import { unlockAudio, playNotificationSound } from '../../utils/notificationSound';
import { useNotificationPreferences } from '../../api/hooks/useSettings';
import type {
    Notification,
    NotificationType,
    ToastOptions,
    NotificationFilters
} from '../../../shared/types/notification';

// ============================================
// Types
// ============================================

export interface NotificationCenterContextValue {
    /** Persistent notifications from server */
    notifications: Notification[];

    /** Count of unread notifications */
    unreadCount: number;

    /** True while fetching notifications */
    loading: boolean;

    /** Fetch notifications from server */
    fetchNotifications: (filters?: NotificationFilters) => Promise<void>;

    /** Add a notification to local state (from SSE) */
    addNotification: (notification: Notification) => void;

    /** Mark a notification as read */
    markAsRead: (id: string) => Promise<void>;

    /** Delete a notification */
    deleteNotification: (id: string) => Promise<void>;

    /** Mark all notifications as read */
    markAllAsRead: () => Promise<void>;

    /** Delete all notifications */
    clearAll: () => Promise<void>;

    /** Handle approve/decline action on request notification */
    handleRequestAction: (id: string, action: 'approve' | 'decline') => Promise<unknown>;

    /** Whether notification center panel is open */
    notificationCenterOpen: boolean;

    /** Set notification center open state */
    setNotificationCenterOpen: (open: boolean) => void;

    /** Open the notification center */
    openNotificationCenter: () => void;

    /** Whether SSE connection is active */
    connected: boolean;

    /** Show toast for a specific notification ID (used by push click handling) */
    showToastForNotification: (notificationId: string) => void;
}

// ============================================
// Context
// ============================================

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface NotificationCenterProviderProps {
    children: ReactNode;
}

export const NotificationCenterProvider = ({ children }: NotificationCenterProviderProps): React.JSX.Element => {
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToasts();

    // Notification center state
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    // SSE connection from unified hook
    const { isConnected: connected, onNotification } = useRealtimeSSE();

    // Sound preference
    const { data: notifPrefs } = useNotificationPreferences();
    const soundEnabledRef = useRef(false);
    soundEnabledRef.current = notifPrefs?.sound ?? false;

    // Unlock AudioContext on first user interaction (iOS requirement)
    useEffect(() => {
        const handler = () => {
            unlockAudio();
            document.removeEventListener('click', handler, true);
            document.removeEventListener('touchstart', handler, true);
        };
        document.addEventListener('click', handler, true);
        document.addEventListener('touchstart', handler, true);
        return () => {
            document.removeEventListener('click', handler, true);
            document.removeEventListener('touchstart', handler, true);
        };
    }, []);

    // Notification center open state
    const [notificationCenterOpen, setNotificationCenterOpen] = useState<boolean>(false);
    const openNotificationCenter = useCallback((): void => {
        setNotificationCenterOpen(true);
        window.dispatchEvent(new CustomEvent('openNotificationCenter'));
    }, []);

    // Fetch notifications from backend
    const fetchNotifications = useCallback(async (filters: NotificationFilters = {}): Promise<void> => {
        if (!isAuthenticated) return;

        setLoading(true);
        try {
            const response = await notificationsApi.getAll(filters);

            setNotifications(response.notifications || []);
            setUnreadCount(response.unreadCount || 0);

            logger.debug('Notifications fetched', {
                count: response.notifications?.length,
                unread: response.unreadCount
            });
        } catch (error) {
            logger.error('Failed to fetch notifications', { error: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Add notification to center (from backend or SSE)
    const addNotification = useCallback((notification: Notification): void => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);

        logger.debug('Notification added to center', {
            id: notification.id,
            type: notification.type
        });
    }, []);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await notificationsApi.markRead(notificationId);

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));

            logger.debug('Notification marked as read', { id: notificationId });
        } catch (error) {
            logger.error('Failed to mark notification as read', { error: (error as Error).message });
        }
    }, []);

    // Delete notification
    const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await notificationsApi.delete(notificationId);

            const notification = notifications.find(n => n.id === notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }

            logger.debug('Notification deleted', { id: notificationId });
        } catch (error) {
            logger.error('Failed to delete notification', { error: (error as Error).message });
        }
    }, [notifications]);

    // Mark all as read
    const markAllAsRead = useCallback(async (): Promise<void> => {
        try {
            await notificationsApi.markAllRead();

            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            );
            setUnreadCount(0);

            logger.info('All notifications marked as read');
        } catch (error) {
            logger.error('Failed to mark all as read', { error: (error as Error).message });
        }
    }, []);

    // Clear all notifications
    const clearAll = useCallback(async (): Promise<void> => {
        try {
            await notificationsApi.clearAll();

            setNotifications([]);
            setUnreadCount(0);

            logger.info('All notifications cleared');
        } catch (error) {
            logger.error('Failed to clear all notifications', { error: (error as Error).message });
        }
    }, []);

    // Handle request action (approve/decline for Overseerr)
    const handleRequestAction = useCallback(async (notificationId: string, action: 'approve' | 'decline'): Promise<unknown> => {
        try {
            const response = action === 'approve'
                ? await notificationsApi.approveRequest(notificationId)
                : await notificationsApi.declineRequest(notificationId);

            setNotifications(prev => {
                const notification = prev.find(n => n.id === notificationId);
                if (notification && !notification.read) {
                    setUnreadCount(count => Math.max(0, count - 1));
                }
                return prev.filter(n => n.id !== notificationId);
            });

            if (response.alreadyHandled) {
                showToast('info', 'Already Handled', 'This request was already handled in Overseerr.');
            } else {
                showToast(
                    'success',
                    action === 'approve' ? 'Request Approved' : 'Request Declined',
                    response.message || `Request ${action}d successfully`
                );
            }

            return response;
        } catch (error) {
            logger.error('Failed to process request action', { error: (error as Error).message });
            const errResponse = (error as { response?: { data?: { error?: string } } })?.response?.data;
            showToast('error', 'Action Failed', errResponse?.error || 'Failed to process request');
            throw error;
        }
    }, [showToast]);

    // Show toast for a specific notification ID (used by push click)
    const showToastForNotification = useCallback((notificationId: string): void => {
        logger.info('[Push Click] showToastForNotification called', { notificationId });

        setTimeout(() => {
            setNotifications(prevNotifications => {
                const notification = prevNotifications.find(n => n.id === notificationId);

                if (!notification) {
                    logger.warn('[Push Click] Notification not found', { notificationId, count: prevNotifications.length });
                    return prevNotifications;
                }

                logger.info('[Push Click] Creating toast for notification', { notificationId, title: notification.title });

                const toastOptions: ToastOptions = {
                    iconId: notification.iconId || undefined,
                    duration: 5000,
                    onBodyClick: openNotificationCenter,
                    notificationId: notification.id
                };

                if (notification.metadata?.actionable && notification.metadata?.requestId) {
                    toastOptions.actions = [
                        { label: 'Approve', variant: 'success', onClick: () => handleRequestAction(notification.id, 'approve') },
                        { label: 'Decline', variant: 'danger', onClick: () => handleRequestAction(notification.id, 'decline') }
                    ];
                }

                showToast((notification.type as NotificationType) || 'info', notification.title, notification.message, toastOptions);

                return prevNotifications;
            });
        }, 50);
    }, [handleRequestAction, openNotificationCenter, showToast]);

    // Load notifications on mount and when auth changes
    useEffect(() => {
        if (isAuthenticated && user) {
            fetchNotifications({ limit: 50 });
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, user, fetchNotifications]);

    // SSE notifications via unified useRealtimeSSE hook
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const unsubscribe = onNotification((data: NotificationEvent) => {
            // Handle sync events (cross-tab synchronization)
            if (data.type === 'sync' && data.action) {
                logger.debug('[SSE Unified] Sync event received', { action: data.action, notificationId: data.notificationId });

                switch (data.action) {
                    case 'markRead':
                        setNotifications(prev => prev.map(n =>
                            n.id === data.notificationId ? { ...n, read: true } : n
                        ));
                        setUnreadCount(prev => Math.max(0, prev - 1));
                        break;
                    case 'delete':
                        setNotifications(prev => {
                            const notification = prev.find(n => n.id === data.notificationId);
                            if (notification && !notification.read) {
                                setUnreadCount(count => Math.max(0, count - 1));
                            }
                            return prev.filter(n => n.id !== data.notificationId);
                        });
                        break;
                    case 'markAllRead':
                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        setUnreadCount(0);
                        break;
                    case 'clearAll':
                        setNotifications([]);
                        setUnreadCount(0);
                        break;
                }
                return;
            }

            // Handle regular notification events
            if (data.type === 'connected') {
                logger.debug('[SSE Unified] Connection confirmed');
                return;
            }

            logger.debug('[SSE Unified] Notification received', {
                id: data.id,
                title: data.title,
                actionable: data.metadata?.actionable
            });

            // Add to notification center
            addNotification(data as Notification);

            // Play notification sound if enabled
            if (soundEnabledRef.current) {
                playNotificationSound();
            }

            // Show toast
            const toastOptions: ToastOptions = {
                iconId: data.iconId ?? undefined,
                iconIds: data.iconIds,
                metadata: data.metadata,
                duration: 5000,
                onBodyClick: openNotificationCenter
            };

            if (data.metadata?.actionable && data.metadata?.requestId) {
                toastOptions.actions = [
                    {
                        label: 'Approve',
                        variant: 'success',
                        onClick: () => handleRequestAction(data.id!, 'approve')
                    },
                    {
                        label: 'Decline',
                        variant: 'danger',
                        onClick: () => handleRequestAction(data.id!, 'decline')
                    }
                ];
                toastOptions.notificationId = data.id;
            }

            showToast((data.type as NotificationType) || 'info', data.title || '', data.message || '', toastOptions);
        });

        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, onNotification]);

    // Memoize context value
    const value: NotificationCenterContextValue = useMemo(() => ({
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        addNotification,
        markAsRead,
        deleteNotification,
        markAllAsRead,
        clearAll,
        handleRequestAction,
        notificationCenterOpen,
        setNotificationCenterOpen,
        openNotificationCenter,
        connected,
        showToastForNotification
    }), [
        notifications, unreadCount, loading,
        fetchNotifications, addNotification, markAsRead, deleteNotification, markAllAsRead, clearAll, handleRequestAction,
        notificationCenterOpen, openNotificationCenter, connected, showToastForNotification
    ]);

    return (
        <NotificationCenterContext.Provider value={value}>
            {children}
        </NotificationCenterContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useNotificationCenter = (): NotificationCenterContextValue => {
    const context = useContext(NotificationCenterContext);
    if (!context) {
        throw new Error('useNotificationCenter must be used within a NotificationCenterProvider');
    }
    return context;
};

export { NotificationCenterContext };
