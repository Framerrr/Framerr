import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { ConfirmButton } from '../../shared/ui';
import type { NotificationFilterType } from './NotificationCenter';

interface FilterTabConfig {
    id: NotificationFilterType;
    label: string;
    count: number;
}

interface NotificationCenterHeaderProps {
    /** Current active filter */
    activeFilter: NotificationFilterType;
    /** Callback when filter changes */
    onFilterChange: (filter: NotificationFilterType) => void;
    /** Callback to close the notification center */
    onClose?: () => void;
}

/**
 * NotificationCenterHeader — Standalone header for the notification center.
 * 
 * Used in the mobile menu's header slot so it can transition independently
 * (horizontal slide) from the notification body (vertical rolodex).
 * 
 * Shares filter state with NotificationCenter via lifted state in MobileTabBar.
 */
const NotificationCenterHeader = ({
    activeFilter,
    onFilterChange,
    onClose,
}: NotificationCenterHeaderProps): React.JSX.Element => {
    const {
        notifications,
        unreadCount,
        markAllAsRead,
        clearAll,
    } = useNotifications();

    const computedUnreadCount = notifications.filter(n => !n.read).length;
    const computedReadCount = notifications.filter(n => n.read).length;

    const filterTabs: FilterTabConfig[] = [
        { id: 'all', label: 'All', count: notifications.length },
        { id: 'unread', label: 'Unread', count: computedUnreadCount },
        { id: 'read', label: 'Read', count: computedReadCount }
    ];

    const handleMarkAllRead = async (): Promise<void> => {
        try {
            await markAllAsRead();
        } catch {
            // Logged internally
        }
    };

    const handleClearAll = async (): Promise<void> => {
        try {
            await clearAll();
        } catch {
            // Logged internally
        }
    };

    return (
        <div className="border-b border-theme flex-shrink-0 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-3">
                    <h2 className="font-semibold text-theme-primary text-lg">
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
                        onClick={() => onFilterChange(filter.id)}
                        className="relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1"
                    >
                        {activeFilter === filter.id && (
                            <motion.div
                                layoutId="mobileNotificationFilterIndicator"
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
    );
};

export default NotificationCenterHeader;
