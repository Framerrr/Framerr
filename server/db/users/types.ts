/**
 * User & Session Types
 * 
 * Type definitions for user management and session handling.
 */

// ============================================================================
// Database Row Types (raw from SQLite)
// ============================================================================

export interface UserRow {
    id: string;
    username: string;
    passwordHash?: string;
    displayName: string;
    group: string;
    isSetupAdmin: number;
    createdAt: number;
    lastLogin: number | null;
    preferences?: string;
    requirePasswordReset?: number;
}

export interface SessionRow {
    id: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: number;
    expiresAt: number;
}

// ============================================================================
// Domain Types (application layer)
// ============================================================================

export interface User {
    id: string;
    username: string;
    passwordHash?: string;
    displayName: string;
    group: string;
    isSetupAdmin: boolean;
    createdAt: number;
    lastLogin: number | null;
    preferences?: Record<string, unknown>;
}

export interface Session {
    id: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: number;
    expiresAt: number;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateUserData {
    username: string;
    passwordHash: string;
    email?: string;
    group?: string;
    isSetupAdmin?: boolean;
    hasLocalPassword?: boolean;  // Whether user set their own password (vs auto-generated)
}

export interface UpdateUserData {
    username?: string;
    passwordHash?: string;
    displayName?: string;
    group?: string;
    lastLogin?: number;
    id?: string;
    createdAt?: number;
}

export interface SessionData {
    ipAddress?: string;
    userAgent?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PREFERENCES = {
    theme: 'dark',
    locale: 'en',
    sidebarCollapsed: false
};
