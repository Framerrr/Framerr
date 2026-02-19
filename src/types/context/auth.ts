/**
 * AuthContext Types
 * Types for authentication state and methods
 */

import type { User, LoginResult } from '../../../shared/types/user';

/**
 * AuthContext value provided to consumers
 */
export interface AuthContextValue {
    /**
     * Currently authenticated user, or null if not logged in
     */
    user: User | null;

    /**
     * True while checking authentication status
     */
    loading: boolean;

    /**
     * Error message from last auth operation
     */
    error: string | null;

    /**
     * True if initial setup is required (no admin user exists)
     */
    needsSetup: boolean;

    /**
     * True if user must change password before accessing app (admin reset)
     */
    requirePasswordChange: boolean;

    /**
     * Login with username and password.
     * Pass silent=true to skip the login splash (e.g., during setup wizard).
     */
    login: (username: string, password: string, rememberMe: boolean, silent?: boolean) => Promise<LoginResult>;

    /**
     * Login with Plex token
     */
    loginWithPlex: (plexToken: string, plexUserId: string) => Promise<LoginResult>;

    /**
     * Log out current user
     */
    logout: () => void;

    /**
     * Re-check authentication status
     */
    checkAuth: () => Promise<void>;

    /**
     * Check if initial setup is needed
     */
    checkSetupStatus: () => Promise<boolean>;

    /**
     * Clear the require password change flag (after successful change)
     */
    setRequirePasswordChange: (value: boolean) => void;

    /**
     * Convenience getter for authentication state
     */
    isAuthenticated: boolean;
}

/**
 * AuthProvider props
 */
export interface AuthProviderProps {
    children: React.ReactNode;
}
