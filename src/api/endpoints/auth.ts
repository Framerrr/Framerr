/**
 * Auth API Endpoints
 * Login, logout, session management
 */
import { api } from '../client';

// Import shared User type for consistency
import type { User } from '../../../shared/types/user';

// Re-export for convenience
export type { User };

export interface LoginCredentials {
    username: string;
    password: string;
    rememberMe?: boolean;
}

export interface LoginResponse {
    user: User;
    requirePasswordChange?: boolean;
}

export interface SessionResponse {
    user: User;
    requirePasswordChange?: boolean;
}


export interface SetupStatusResponse {
    needsSetup: boolean;
}

export interface PlexLoginCredentials {
    plexToken: string;
    plexUserId: string;
}

export interface PlexLoginResponse {
    user?: User;
    needsAccountSetup?: boolean;
    setupToken?: string;
}

/**
 * Setup restore response — discriminated union.
 * Plain ZIP restores complete immediately; encrypted files require a password step.
 */
export type SetupRestoreResponse =
    | { success: true; encrypted?: never; restoreId?: never;[key: string]: unknown }
    | { encrypted: true; restoreId: string; success?: never };

// Endpoints
export const authApi = {
    /**
     * Login with username/password
     */
    login: (credentials: LoginCredentials) =>
        api.post<LoginResponse>('/api/auth/login', credentials),

    /**
     * Login with Plex OAuth
     */
    loginWithPlex: (credentials: PlexLoginCredentials) =>
        api.post<PlexLoginResponse>('/api/auth/plex-login', credentials),

    /**
     * Logout current session
     * Note: For proxy auth compatibility, prefer window.location.href = '/api/auth/logout'
     */
    logout: () =>
        api.post<void>('/api/auth/logout'),

    /**
     * Get current session/user
     */
    getSession: () =>
        api.get<SessionResponse>('/api/auth/me'),

    /**
     * Verify session is still valid (lightweight check)
     */
    verifySession: () =>
        api.get<SessionResponse>('/api/auth/me'),

    /**
     * Check if app needs initial setup
     */
    checkSetupStatus: () =>
        api.get<SetupStatusResponse>('/api/auth/setup/status'),

    /**
     * Alias for checkSetupStatus (used by useAuth hook)
     */
    checkSetup: () =>
        api.get<SetupStatusResponse>('/api/auth/setup/status'),

    /**
         * Create initial admin account during setup
         */
    createAdminAccount: (data: {
        username: string;
        password: string;
        confirmPassword: string;
        displayName?: string;
    }) =>
        api.post<{ user: User }>('/api/auth/setup', data),

    /**
     * Restore from backup during setup (uses FormData)
     * Returns discriminated union: plain ZIP -> { success: true }, encrypted -> { encrypted: true, restoreId }
     */
    setupRestore: (formData: FormData, onProgress?: (percent: number) => void) =>
        api.post<SetupRestoreResponse>('/api/auth/setup/restore', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            }
        }),

    /**
     * Decrypt an encrypted backup during setup (second step of two-step restore)
     */
    setupRestoreDecrypt: (password: string, restoreId: string) =>
        api.post<{ success: true }>('/api/auth/setup/restore/decrypt', { password, restoreId }),
    /**
     * Force-change password (after admin reset)
     */
    changePassword: (data: { newPassword: string }) =>
        api.post<{ success: boolean; user: User }>('/api/auth/change-password', data),

    /**
     * Get SSO configuration (which SSO methods are available)
     */
    getSSOConfig: () =>
        api.get<SSOConfigResponse>('/api/auth/sso-config'),

    /**
     * Initiate OIDC login — returns redirect URL to IdP
     */
    oidcLogin: () =>
        api.post<{ redirectUrl: string }>('/api/auth/oidc/login'),

    /**
     * Initiate OIDC account linking (authenticated user)
     */
    oidcConnect: () =>
        api.post<{ redirectUrl: string }>('/api/auth/oidc/connect'),

    /**
     * Disconnect OIDC account from current user
     */
    oidcDisconnect: () =>
        api.post<{ success: boolean }>('/api/auth/oidc/disconnect'),
};

export interface SSOConfigResponse {
    plex: { enabled: boolean };
    oidc: { enabled: boolean; displayName: string; buttonIcon: string };
}

export default authApi;
