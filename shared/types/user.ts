/**
 * User Types
 * Shared between frontend (AuthContext, Sidebar) and backend (auth routes, middleware)
 */

// User permission groups
export type UserGroup = 'admin' | 'user' | 'guest';

/**
 * Core User entity
 * Used throughout the application for authenticated user state
 */
export interface User {
    id: string;
    username: string;
    email?: string;
    displayName?: string;
    isAdmin: boolean;
    avatarUrl?: string;
    group: UserGroup;
    plexUserId?: string;
    plexUsername?: string;
    preferences?: UserPreferences;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * User preferences stored in the database
 */
export interface UserPreferences {
    theme?: string;
    flattenUI?: boolean;
    customColors?: Record<string, string>;
    greeting?: string;
    [key: string]: unknown;
}

/**
 * Session information
 */
export interface Session {
    id: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    expiresAt: string;
}

/**
 * Result of a login attempt
 */
export interface LoginResult {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
    // Plex account setup flow
    needsAccountSetup?: boolean;  // New Plex user needs to create/link account
    setupToken?: string;          // Token for /plex-setup page
    needsPasswordSetup?: boolean; // Migrating user needs to set local password
    // Admin password reset flow
    requirePasswordChange?: boolean; // User must change password before accessing app
}

/**
 * Public user info (safe to expose to other users)
 */
export interface PublicUserInfo {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
}
