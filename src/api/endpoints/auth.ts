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
}

export interface SessionResponse {
    user: User;
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
    needsPasswordSetup?: boolean;
}

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
     * This is a special endpoint that requires the raw client for progress tracking
     */
    setupRestore: (formData: FormData, onProgress?: (percent: number) => void) =>
        api.post<void>('/api/auth/setup/restore', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            }
        }),
};

export default authApi;
