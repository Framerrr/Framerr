/**
 * Custom Event Types
 * DOM CustomEvent types for cross-component communication
 *
 * This is the SINGLE SOURCE OF TRUTH for all custom event names and detail types.
 * All event dispatchers should use dispatchCustomEvent() instead of raw window.dispatchEvent().
 */

// ============================================
// Custom Event Detail Types
// ============================================

/**
 * Profile picture update event detail
 */
export interface ProfilePictureUpdatedDetail {
    profilePicture: string | null;
}

/**
 * System config update event detail
 */
export interface SystemConfigUpdatedDetail {
    [key: string]: unknown;
}

/**
 * Integrations update event detail
 */
export interface IntegrationsUpdatedDetail {
    [key: string]: unknown;
}

/**
 * Notification received via SSE event detail
 */
export interface NotificationReceivedDetail {
    id: string;
    type: string;
    title: string;
    message: string;
    iconId?: string;
}

/**
 * Widget config changed event detail (config modal save or direct UI)
 */
export interface WidgetConfigChangedDetail {
    widgetId: string;
    config?: Record<string, unknown>;
    target?: 'desktop' | 'mobile';
}

/**
 * Widgets added event detail (from Widget Gallery)
 * Other dispatchers may send void/undefined detail
 */
export interface WidgetsAddedDetail {
    widgetType?: string;
    target?: 'desktop' | 'mobile';
}

/**
 * User preferences changed event detail
 */
export interface UserPreferencesChangedDetail {
    key: string;
    value: unknown;
}

/**
 * App name updated event detail
 */
export interface AppNameUpdatedDetail {
    appName: string;
}

/**
 * Greeting updated event detail (7 properties)
 */
export interface GreetingUpdatedDetail {
    mode: 'auto' | 'manual';
    text: string;
    headerVisible: boolean;
    taglineEnabled: boolean;
    taglineText: string;
    tones: string[];
    loadingMessages: boolean;
}

// ============================================
// Custom Event Types (extends CustomEvent)
// ============================================

/** Tabs updated event (sidebar/navigation) */
export interface TabsUpdatedEvent extends CustomEvent<undefined> {
    type: 'tabsUpdated';
}

/** Profile picture updated event */
export interface ProfilePictureUpdatedEvent extends CustomEvent<ProfilePictureUpdatedDetail> {
    type: 'profilePictureUpdated';
}

/** Open notification center event */
export interface OpenNotificationCenterEvent extends CustomEvent<undefined> {
    type: 'open-notification-center';
}

/** System config updated event */
export interface SystemConfigUpdatedEvent extends CustomEvent<SystemConfigUpdatedDetail> {
    type: 'systemConfigUpdated';
}

/** Integrations updated event */
export interface IntegrationsUpdatedEvent extends CustomEvent<IntegrationsUpdatedDetail> {
    type: 'integrationsUpdated';
}

/** Notification received from SSE */
export interface NotificationReceivedEvent extends CustomEvent<NotificationReceivedDetail> {
    type: 'notification-received';
}

// ============================================
// Event Name Constants
// ============================================

/**
 * Custom event names used in the application.
 * Strings MUST match the actual event names used in window.dispatchEvent() calls.
 */
export const CustomEventNames = {
    // Settings domain events
    WIDGETS_ADDED: 'widgets-added',
    WIDGET_CONFIG_CHANGED: 'widget-config-changed',
    WIDGET_CONFIG_UPDATED: 'widget-config-updated',
    WIDGETS_UPDATED: 'widgets-updated',
    USER_PREFERENCES_CHANGED: 'user-preferences-changed',
    PROFILE_PICTURE_UPDATED: 'profilePictureUpdated',
    INTEGRATIONS_UPDATED: 'integrationsUpdated',
    LINKED_ACCOUNTS_UPDATED: 'linkedAccountsUpdated',
    APP_NAME_UPDATED: 'appNameUpdated',
    GREETING_UPDATED: 'greetingUpdated',
    SYSTEM_CONFIG_UPDATED: 'systemConfigUpdated',
    AUTH_SETTINGS_UPDATED: 'authSettingsUpdated',
    TABS_UPDATED: 'tabsUpdated',
    TAB_GROUPS_UPDATED: 'tabGroupsUpdated',
    FAVICON_UPDATED: 'faviconUpdated',

    // App-wide events
    OPEN_NOTIFICATION_CENTER: 'open-notification-center',
    NOTIFICATION_RECEIVED: 'notification-received',
} as const;

export type CustomEventName = typeof CustomEventNames[keyof typeof CustomEventNames];

// ============================================
// Helper Functions
// ============================================

/**
 * Type-safe event dispatcher.
 * Wraps window.dispatchEvent(new CustomEvent(...)) for consistent usage.
 * CustomEvent extends Event, so this is backward-compatible with listeners
 * that expect raw Event objects.
 */
export function dispatchCustomEvent<T>(
    name: CustomEventName,
    detail?: T
): void {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Type-safe event listener adder.
 * Returns a cleanup function for use in useEffect teardown.
 */
export function addCustomEventListener<T>(
    name: CustomEventName,
    handler: (event: CustomEvent<T>) => void
): () => void {
    const wrappedHandler = (event: Event) => {
        handler(event as CustomEvent<T>);
    };
    window.addEventListener(name, wrappedHandler);
    return () => window.removeEventListener(name, wrappedHandler);
}
