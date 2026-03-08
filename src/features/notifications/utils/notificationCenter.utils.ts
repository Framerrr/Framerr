import type { Notification } from '../../../../shared/types/notification';
import type { NotificationSource } from '../types/notificationCenter.types';

/**
 * Format time in iOS style
 * now, 3m, 2h, Yesterday, Monday, Dec 31
 */
export const formatTime = (dateString: string): string => {
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
export const getNotificationSource = (notification: Notification): NotificationSource => {
    const service = notification.metadata?.service;
    if (service === 'overseerr' || service === 'sonarr' || service === 'radarr') {
        return service;
    }
    return 'system';
};

// Swipe thresholds (iOS-style) — shared between SwipeableStack and SwipeableNotification
export const REVEAL_THRESHOLD = 25;   // Start showing action button (more lenient)
export const SNAP_THRESHOLD = 90;     // If released here, snap to show full button (matches BUTTON_WIDTH)
export const COMMIT_THRESHOLD = 180;  // If swiped this far, execute action immediately (harder)
export const BUTTON_WIDTH = 90;       // Width to snap to when showing button (80px button + padding)
