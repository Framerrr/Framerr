/**
 * Database Row Types
 * These types map directly to SQLite table structures
 * They differ from entity types (which are transformed for API responses)
 */

/**
 * Users table row
 */
export interface UserRow {
    id: string;
    username: string;
    passwordHash?: string;
    email?: string;
    displayName?: string;
    group: 'admin' | 'user' | 'guest';
    preferences: string;  // JSON string - parsed to UserPreferences
    plexUserId?: string;
    plexUsername?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Sessions table row
 */
export interface SessionRow {
    id: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    expiresAt: string;
}

/**
 * Notifications table row
 */
export interface NotificationRow {
    id: string;
    userId: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    iconId?: string;
    read: number;  // SQLite boolean: 0 = false, 1 = true
    metadata?: string;  // JSON string
    createdAt: string;
}

/**
 * Push subscriptions table row
 */
export interface PushSubscriptionRow {
    id: string;
    userId: string;
    endpoint: string;
    deviceName: string;
    p256dh: string;
    auth: string;
    createdAt: string;
}

/**
 * System config table row
 * Key-value store for system settings
 */
export interface SystemConfigRow {
    key: string;
    value: string;  // JSON string or plain value
    updatedAt: string;
}

/**
 * Tabs table row
 */
export interface TabRow {
    id: number;
    name: string;
    slug: string;
    url: string;
    icon?: string;
    groupId?: number;
    order: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * Tab groups table row
 */
export interface TabGroupRow {
    id: number;
    name: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * Widgets table row
 */
export interface WidgetRow {
    id: string;
    userId: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    config?: string;  // JSON string
    layouts?: string; // JSON string
    createdAt: string;
    updatedAt: string;
}

/**
 * Uploaded icons table row
 */
export interface UploadedIconRow {
    id: string;
    userId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
}

/**
 * User integrations table row
 */
export interface UserIntegrationRow {
    id: string;
    userId: string;
    integrationKey: string;
    config: string;  // JSON string
    createdAt: string;
    updatedAt: string;
}
