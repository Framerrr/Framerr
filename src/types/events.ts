/**
 * Custom Event Types
 * DOM CustomEvent types for cross-component communication
 */

// ============================================
// Custom Event Detail Types
// ============================================

/**
 * Profile picture update event detail
 */
export interface ProfilePictureUpdatedDetail {
    profilePicture: string;
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

// ============================================
// Custom Event Types
// ============================================

/**
 * Tabs updated event (sidebar/navigation)
 */
export interface TabsUpdatedEvent extends CustomEvent<undefined> {
    type: 'tabs-updated';
}

/**
 * Profile picture updated event
 */
export interface ProfilePictureUpdatedEvent extends CustomEvent<ProfilePictureUpdatedDetail> {
    type: 'profile-picture-updated';
}

/**
 * Open notification center event
 */
export interface OpenNotificationCenterEvent extends CustomEvent<undefined> {
    type: 'open-notification-center';
}

/**
 * System config updated event
 */
export interface SystemConfigUpdatedEvent extends CustomEvent<SystemConfigUpdatedDetail> {
    type: 'system-config-updated';
}

/**
 * Integrations updated event
 */
export interface IntegrationsUpdatedEvent extends CustomEvent<IntegrationsUpdatedDetail> {
    type: 'integrations-updated';
}

/**
 * Notification received from SSE
 */
export interface NotificationReceivedEvent extends CustomEvent<NotificationReceivedDetail> {
    type: 'notification-received';
}

// ============================================
// Event Name Constants
// ============================================

/**
 * Custom event names used in the application
 */
export const CustomEventNames = {
    TABS_UPDATED: 'tabs-updated',
    PROFILE_PICTURE_UPDATED: 'profile-picture-updated',
    OPEN_NOTIFICATION_CENTER: 'open-notification-center',
    SYSTEM_CONFIG_UPDATED: 'system-config-updated',
    INTEGRATIONS_UPDATED: 'integrations-updated',
    NOTIFICATION_RECEIVED: 'notification-received',
} as const;

export type CustomEventName = typeof CustomEventNames[keyof typeof CustomEventNames];

// ============================================
// Helper Functions
// ============================================

/**
 * Type-safe event dispatcher
 */
export function dispatchCustomEvent<T>(
    name: CustomEventName,
    detail?: T
): void {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Type-safe event listener adder
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
