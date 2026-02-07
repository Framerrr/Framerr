import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Check, XCircle, LucideIcon } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import SwipeableNotification from './SwipeableNotification';
import NotificationGroup from './NotificationGroup';
import StackedIcons from './StackedIcons';
import { getIconComponent, getIconUrl } from '../../utils/iconUtils';
import type { Notification } from '../../../shared/types/notification';
import { ConfirmButton } from '../../shared/ui';
import logger from '../../utils/logger';

type NotificationType = 'success' | 'error' | 'warning' | 'info';
type NotificationSource = 'overseerr' | 'sonarr' | 'radarr' | 'system';

const ICONS: Record<NotificationType, LucideIcon> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
};

type FilterType = 'all' | 'unread' | 'read';

interface FilterTabConfig {
    id: FilterType;
    label: string;
    count: number;
}

interface SourceGroupedNotifications {
    overseerr: Notification[];
    sonarr: Notification[];
    radarr: Notification[];
    system: Notification[];
}

export interface NotificationCenterProps {
    isMobile?: boolean;
    onClose?: () => void;
}

/**
 * Format time in iOS style
 * now, 3m, 2h, Yesterday, Monday, Dec 31
 */
const formatTime = (dateString: string): string => {
    if (!dateString) return 'now';

    const date = new Date(dateString);

    // Handle invalid dates
    if (isNaN(date.getTime())) return 'now';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Today
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24 && date.getDate() === now.getDate()) return `${diffHours}h`;

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()) {
        return 'Yesterday';
    }

    // Within last 7 days - show day name
    if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Older - show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get notification source from metadata
 */
const getNotificationSource = (notification: Notification): NotificationSource => {
    const service = notification.metadata?.service;
    if (service === 'overseerr' || service === 'sonarr' || service === 'radarr') {
        return service;
    }
    return 'system';
};

/**
 * NotificationCenter Component
 * 
 * iOS-style notification center with source-based grouping
 */
const NotificationCenter = ({ isMobile = false, onClose }: NotificationCenterProps): React.JSX.Element => {
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

    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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

    // Render individual notification card content
    const renderNotificationContent = useCallback((notification: Notification): React.JSX.Element => {
        const Icon = ICONS[notification.type as NotificationType] || Info;

        return (
            <div
                className={`
                    px-4 pt-4 pb-6 rounded-xl border border-theme
                    ${!notification.read ? 'bg-accent/5 glass-card' : 'bg-theme-secondary/40 opacity-70'}
                `}
            >
                <div className="flex items-start gap-3">
                    {/* Icon - stacked icons for batched, custom icon, lucide icon, or type-based icon */}
                    {notification.iconIds && notification.iconIds.length > 1 ? (
                        <StackedIcons
                            iconIds={notification.iconIds}
                            lucideIcons={(notification.metadata?.lucideIcons as string[] | undefined)}
                            status={notification.type}
                            size={40}
                        />
                    ) : notification.iconId ? (
                        <div
                            className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-theme-tertiary/50 flex items-center justify-center shadow-sm"
                            style={{ border: `2px solid var(--${notification.type})` }}
                        >
                            <img
                                src={getIconUrl(notification.iconId) || `/api/custom-icons/${notification.iconId}/file`}
                                alt=""
                                className="w-7 h-7 object-contain"
                            />
                        </div>
                    ) : (notification.metadata?.lucideIcon as string | undefined) ? (
                        (() => {
                            const LucideIconComponent = getIconComponent(notification.metadata?.lucideIcon as string);
                            return (
                                <div
                                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm"
                                    style={{
                                        backgroundColor: `color-mix(in srgb, var(--${notification.type}) 15%, transparent)`,
                                        border: `2px solid var(--${notification.type})`,
                                        color: `var(--${notification.type})`
                                    }}
                                >
                                    <LucideIconComponent size={22} />
                                </div>
                            );
                        })()
                    ) : (
                        <div
                            className="p-2.5 rounded-xl flex-shrink-0 shadow-sm"
                            style={{
                                backgroundColor: `color-mix(in srgb, var(--${notification.type}) 15%, transparent)`,
                                border: `1px solid color-mix(in srgb, var(--${notification.type}) 20%, transparent)`
                            }}
                        >
                            <Icon
                                size={18}
                                style={{ color: `var(--${notification.type})` }}
                            />
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-semibold leading-tight ${notification.read ? 'text-theme-secondary' : 'text-theme-primary'}`}>
                                {notification.title}
                            </h4>
                            <span className="text-xs text-theme-tertiary whitespace-nowrap font-medium">
                                {formatTime(notification.createdAt)}
                            </span>
                        </div>
                        <p className="text-sm text-theme-secondary mt-1.5 leading-relaxed">
                            {notification.message}
                        </p>
                        {/* Actionable notification buttons - removed from here, moved outside flex */}
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                    )}
                </div>

                {/* Actionable notification buttons - outside flex row for true centering */}
                {notification.metadata?.actionable && notification.metadata?.requestId && (
                    <div className="flex gap-2 mt-3 justify-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRequestAction(notification.id, 'approve');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
                                bg-success/20 text-success hover:bg-success/30 
                                border border-success/20 hover:border-success/40
                                transition-all duration-200 hover:scale-105"
                        >
                            <Check size={14} />
                            Approve
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRequestAction(notification.id, 'decline');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
                                bg-error/20 text-error hover:bg-error/30 
                                border border-error/20 hover:border-error/40
                                transition-all duration-200 hover:scale-105"
                        >
                            <XCircle size={14} />
                            Decline
                        </button>
                    </div>
                )}
            </div>
        );
    }, [handleRequestAction]);

    // Render collapsed notification card with "tap to expand" section built-in
    const renderCollapsedNotification = useCallback((notification: Notification, count: number): React.JSX.Element => {
        const Icon = ICONS[notification.type as NotificationType] || Info;

        return (
            <div className="mx-4 mb-3">
                <div
                    className={`
                        rounded-xl border border-theme
                        ${!notification.read ? 'bg-accent/5 glass-card' : 'bg-theme-secondary/40 opacity-70'}
                    `}
                >
                    {/* Main notification content */}
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            {/* Icon - stacked icons for batched, custom icon, or type-based icon */}
                            {notification.iconIds && notification.iconIds.length > 1 ? (
                                <StackedIcons iconIds={notification.iconIds} status={notification.type} size={40} />
                            ) : notification.iconId ? (
                                <div
                                    className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-theme-tertiary/50 flex items-center justify-center shadow-sm"
                                    style={{ border: `2px solid var(--${notification.type})` }}
                                >
                                    <img
                                        src={getIconUrl(notification.iconId) || `/api/custom-icons/${notification.iconId}/file`}
                                        alt=""
                                        className="w-7 h-7 object-contain"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="p-2.5 rounded-xl flex-shrink-0 shadow-sm"
                                    style={{
                                        backgroundColor: `color-mix(in srgb, var(--${notification.type}) 15%, transparent)`,
                                        border: `1px solid color-mix(in srgb, var(--${notification.type}) 20%, transparent)`
                                    }}
                                >
                                    <Icon
                                        size={18}
                                        style={{ color: `var(--${notification.type})` }}
                                    />
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className={`text-sm font-semibold leading-tight ${notification.read ? 'text-theme-secondary' : 'text-theme-primary'}`}>
                                        {notification.title}
                                    </h4>
                                    <span className="text-xs text-theme-tertiary whitespace-nowrap font-medium">
                                        {formatTime(notification.createdAt)}
                                    </span>
                                </div>
                                <p className="text-sm text-theme-secondary mt-1.5 leading-relaxed line-clamp-2">
                                    {notification.message}
                                </p>
                            </div>

                            {/* Unread indicator */}
                            {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                            )}
                        </div>
                    </div>

                    {/* Tap to expand section - separate from content */}
                    <div className="px-4 pb-3 pt-1">
                        <div className="flex items-center justify-center py-1.5 rounded-lg bg-theme-tertiary/20 border border-theme">
                            <span className="text-xs text-theme-secondary font-medium">
                                Tap to expand · {count} notifications
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }, []);

    // Render notification with swipe wrapper
    const renderNotification = useCallback((notification: Notification, index: number): React.JSX.Element => {
        return (
            <div key={notification.id} className="mx-4 mb-3">
                <SwipeableNotification
                    onMarkAsRead={notification.read ? undefined : () => handleMarkAsRead(notification.id)}
                    onDelete={() => handleDelete(notification.id)}
                    isRead={notification.read}
                >
                    {renderNotificationContent(notification)}
                </SwipeableNotification>
            </div>
        );
    }, [handleMarkAsRead, handleDelete, renderNotificationContent]);

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
            {/* Header */}
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
                                    renderNotificationContent={renderNotificationContent}
                                    renderCollapsedNotification={renderCollapsedNotification}
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
