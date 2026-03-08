import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';
import SwipeableNotification from './SwipeableNotification';
import NotificationGroup from './NotificationGroup';
import { NotificationCardContent } from './NotificationCard';
import { ConfirmButton } from '../../../shared/ui';
import logger from '../../../utils/logger';
import { getNotificationSource } from '../utils/notificationCenter.utils';
import type { Notification } from '../../../../shared/types/notification';
import type {
    NotificationType,
    NotificationSource,
    FilterType,
    FilterTabConfig,
    SourceGroupedNotifications,
    NotificationCenterProps,
} from '../types/notificationCenter.types';

/**
 * NotificationCenter Component
 * 
 * iOS-style notification center with source-based grouping
 */
const NotificationCenter = ({ isMobile = false, onClose, excludeHeader = false, activeFilter: controlledFilter, onFilterChange }: NotificationCenterProps): React.JSX.Element => {
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        deleteNotification,
        markAllAsRead,
        clearAll,
        handleRequestAction
    } = useNotifications();

    // Support both controlled and uncontrolled filter state
    const [internalFilter, setInternalFilter] = useState<FilterType>('all');
    const activeFilter = controlledFilter ?? internalFilter;
    const setActiveFilter = onFilterChange ?? setInternalFilter;

    // NOTE: Scroll lock is now managed by SharedSidebarContext based on isMobileMenuOpen state

    // Filter notifications
    const filteredNotifications = useMemo((): Notification[] => {
        if (activeFilter === 'unread') {
            return notifications.filter(n => !n.read);
        } else if (activeFilter === 'read') {
            return notifications.filter(n => n.read);
        }
        return notifications;
    }, [notifications, activeFilter]);

    // Compute counts
    const computedUnreadCount = useMemo(() =>
        notifications.filter(n => !n.read).length
        , [notifications]);
    const computedReadCount = useMemo(() =>
        notifications.filter(n => n.read).length
        , [notifications]);

    // Group notifications by source (iOS-style)
    const groupedNotifications = useMemo((): SourceGroupedNotifications => {
        const groups: SourceGroupedNotifications = {
            overseerr: [],
            sonarr: [],
            radarr: [],
            system: []
        };

        filteredNotifications.forEach(notification => {
            const source = getNotificationSource(notification);
            groups[source].push(notification);
        });

        // Sort each group by createdAt descending (newest first)
        Object.keys(groups).forEach(source => {
            groups[source as NotificationSource].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        });

        return groups;
    }, [filteredNotifications]);

    // Get sources that have notifications, sorted by most recent notification
    const activeSources = useMemo((): NotificationSource[] => {
        const sources: NotificationSource[] = ['overseerr', 'sonarr', 'radarr', 'system'];
        const sourcesWithNotifications = sources.filter(source => groupedNotifications[source].length > 0);

        // Sort by most recent notification timestamp (descending - newest first)
        return sourcesWithNotifications.sort((a, b) => {
            const aLatest = groupedNotifications[a][0]?.createdAt || '';
            const bLatest = groupedNotifications[b][0]?.createdAt || '';
            return new Date(bLatest).getTime() - new Date(aLatest).getTime();
        });
    }, [groupedNotifications]);

    const handleMarkAsRead = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await markAsRead(notificationId);
        } catch (error) {
            logger.error('Failed to mark notification as read', { error: (error as Error).message });
        }
    }, [markAsRead]);

    const handleDelete = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await deleteNotification(notificationId);
        } catch (error) {
            logger.error('Failed to delete notification', { error: (error as Error).message });
        }
    }, [deleteNotification]);

    const handleMarkAllRead = useCallback(async (): Promise<void> => {
        try {
            await markAllAsRead();
        } catch (error) {
            logger.error('Failed to mark all as read', { error: (error as Error).message });
        }
    }, [markAllAsRead]);

    const handleClearAll = useCallback(async (): Promise<void> => {
        try {
            await clearAll();
        } catch (error) {
            logger.error('Failed to clear all notifications', { error: (error as Error).message });
        }
    }, [clearAll]);

    const handleClearGroup = useCallback(async (source: NotificationSource): Promise<void> => {
        try {
            // Delete all notifications from this source
            const notificationsToDelete = groupedNotifications[source];
            await Promise.all(notificationsToDelete.map(n => deleteNotification(n.id)));
        } catch (error) {
            logger.error('Failed to clear group', { error: (error as Error).message });
        }
    }, [groupedNotifications, deleteNotification]);

    const handleMarkAllAsReadGroup = useCallback(async (source: NotificationSource): Promise<void> => {
        try {
            // Mark all unread notifications from this source as read
            const unreadInGroup = groupedNotifications[source].filter(n => !n.read);
            await Promise.all(unreadInGroup.map(n => markAsRead(n.id)));
        } catch (error) {
            logger.error('Failed to mark group as read', { error: (error as Error).message });
        }
    }, [groupedNotifications, markAsRead]);

    // Render notification with swipe wrapper
    const renderNotification = useCallback((notification: Notification, index: number): React.JSX.Element => {
        return (
            <div key={notification.id} className="mx-4 mb-3">
                <SwipeableNotification
                    onMarkAsRead={notification.read ? undefined : () => handleMarkAsRead(notification.id)}
                    onDelete={() => handleDelete(notification.id)}
                    isRead={notification.read}
                >
                    <NotificationCardContent
                        notification={notification}
                        handleRequestAction={handleRequestAction}
                    />
                </SwipeableNotification>
            </div>
        );
    }, [handleMarkAsRead, handleDelete, handleRequestAction]);

    const filterTabs: FilterTabConfig[] = [
        { id: 'all', label: 'All', count: notifications.length },
        { id: 'unread', label: 'Unread', count: computedUnreadCount },
        { id: 'read', label: 'Read', count: computedReadCount }
    ];

    return (
        <div
            className="flex-1 flex flex-col"
            style={{
                minHeight: 0,
                overflow: 'hidden',
                touchAction: 'pan-y pinch-zoom' // Prevent horizontal scroll from propagating
            }}
            onTouchMove={(e) => {
                // Prevent scroll-behind on mobile when touching notification center
                e.stopPropagation();
            }}
        >
            {/* Header — omitted when excludeHeader is true (mobile uses separate header slot) */}
            {!excludeHeader && (
                <div className={`border-b border-theme flex-shrink-0 ${isMobile ? 'p-4' : 'p-6'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-baseline gap-3">
                            <h2 className={`font-semibold text-theme-primary ${isMobile ? 'text-lg' : 'text-xl'}`}>
                                Notifications
                            </h2>
                            <span className="text-sm text-theme-secondary">
                                {unreadCount} unread
                            </span>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-theme-tertiary hover:text-theme-primary 
                                    transition-colors p-1"
                                aria-label="Close notifications"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 mb-3 bg-theme-tertiary/30 p-1 rounded-lg">
                        {filterTabs.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id)}
                                className="relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1"
                            >
                                {activeFilter === filter.id && (
                                    <motion.div
                                        layoutId="notificationFilterIndicator"
                                        className="absolute inset-0 bg-accent rounded-md"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className={`relative z-10 ${activeFilter === filter.id ? 'text-white' : 'text-theme-secondary'}`}>
                                    {filter.label} ({filter.count})
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    {notifications.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleMarkAllRead}
                                disabled={unreadCount === 0}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg
                                    bg-accent text-white hover:bg-accent-hover
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-colors"
                            >
                                Mark all read
                            </button>

                            <ConfirmButton
                                onConfirm={handleClearAll}
                                label="Clear All"
                                confirmMode="icon"
                                size="sm"
                                showTriggerIcon={false}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Notification List - Grouped by Source */}
            <div className="flex-1 overflow-hidden">
                <div
                    className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar py-4"
                    style={{
                        overscrollBehavior: 'contain',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-theme-secondary">Loading...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <div className="p-4 rounded-full bg-theme-tertiary/10 mb-4">
                                <Info size={32} className="text-theme-tertiary" />
                            </div>
                            <h3 className="text-lg font-semibold text-theme-primary mb-2">
                                No notifications
                            </h3>
                            <p className="text-sm text-theme-secondary">
                                {activeFilter === 'unread'
                                    ? "You're all caught up!"
                                    : activeFilter === 'read'
                                        ? 'No read notifications'
                                        : 'You have no notifications yet'}
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence mode="sync">
                            {activeSources.map(source => (
                                <NotificationGroup
                                    key={source}
                                    source={source}
                                    notifications={groupedNotifications[source]}
                                    renderNotification={renderNotification}
                                    onClearGroup={handleClearGroup}
                                    onMarkAllAsRead={handleMarkAllAsReadGroup}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationCenter;
export type { FilterType as NotificationFilterType };
