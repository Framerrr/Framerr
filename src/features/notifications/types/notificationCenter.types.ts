import type { Notification } from '../../../../shared/types/notification';

// --- Types extracted from NotificationCenter.tsx ---

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationSource = 'overseerr' | 'sonarr' | 'radarr' | 'system';
export type FilterType = 'all' | 'unread' | 'read';

/** Backwards-compatible alias (re-exported from barrel) */
export type NotificationFilterType = FilterType;

export interface FilterTabConfig {
    id: FilterType;
    label: string;
    count: number;
}

export interface SourceGroupedNotifications {
    overseerr: Notification[];
    sonarr: Notification[];
    radarr: Notification[];
    system: Notification[];
}

export interface NotificationCenterProps {
    isMobile?: boolean;
    onClose?: () => void;
    /** When true, the header (title, filters, actions) is not rendered — use NotificationCenterHeader separately */
    excludeHeader?: boolean;
    /** Controlled filter state — when provided, overrides internal state */
    activeFilter?: FilterType;
    /** Callback when filter changes — required when activeFilter is provided */
    onFilterChange?: (filter: FilterType) => void;
}

// --- Types/constants extracted from NotificationGroup.tsx ---

export interface NotificationGroupProps {
    source: NotificationSource;
    notifications: Notification[];
    renderNotification: (notification: Notification, index: number) => React.ReactNode;
    onClearGroup: (source: NotificationSource) => void;
    onMarkAllAsRead: (source: NotificationSource) => void;
}

/** Source display names and colors */
export const SOURCE_CONFIG: Record<NotificationSource, { label: string; color: string }> = {
    overseerr: { label: 'Overseerr', color: 'var(--accent)' },
    sonarr: { label: 'Sonarr', color: '#3fc1c9' },
    radarr: { label: 'Radarr', color: '#ffc230' },
    system: { label: 'System', color: 'var(--text-secondary)' }
};
