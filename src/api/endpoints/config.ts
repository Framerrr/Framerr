/**
 * Config API Endpoints
 * User preferences and system configuration
 */
import { api } from '../client';

// Types
export interface NotificationPreferences {
    enabled?: boolean;
    sound?: boolean;
    receiveUnmatched?: boolean;
    integrations?: Record<string, {
        enabled?: boolean;
        selectedEvents?: string[];
    }>;
}

export interface ThemeConfig {
    mode?: string;
    preset?: string;
    customColors?: Record<string, string>;
    lastSelectedTheme?: string;
}

export interface UIPreferences {
    flattenUI?: boolean;
}

export interface DashboardGreeting {
    enabled?: boolean;
    text?: string;
}

export interface UserPreferences {
    notifications?: NotificationPreferences;
    dashboardGreeting?: DashboardGreeting;
    ui?: UIPreferences;
    [key: string]: unknown;
}

export interface UserConfig {
    id?: string;
    theme?: ThemeConfig;
    preferences?: UserPreferences;
    [key: string]: unknown;
}

export interface ServerConfig {
    name?: string;
    icon?: string;
}

export interface GlobalSystemConfig {
    server?: ServerConfig;
    webhookBaseUrl?: string;
    appName?: string;
    tabGroups?: Array<{ id: string; name: string; order?: number }>;
    [key: string]: unknown;
}

export interface ProxyAuthConfig {
    enabled?: boolean;
    headerName?: string;
    emailHeaderName?: string;
    whitelist?: string[];
    overrideLogout?: boolean;
    logoutUrl?: string;
}

export interface IframeAuthConfig {
    enabled?: boolean;
    endpoint?: string;
    clientId?: string;
    redirectUri?: string;
    scopes?: string;
}

export interface AuthConfig {
    proxy?: ProxyAuthConfig;
    iframe?: IframeAuthConfig;
}

export interface FaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
    uploadedAt?: string;
    uploadedBy?: string;
}

// Endpoints
export const configApi = {
    /**
     * Get current user's config/preferences
     */
    getUser: () =>
        api.get<UserConfig>('/api/config/user'),

    /**
     * Update current user's config/preferences
     * NOTE: Backend expects theme at root level, preferences nested
     */
    updateUser: (data: { theme?: ThemeConfig; preferences?: Partial<UserPreferences> }) =>
        api.put<UserConfig>('/api/config/user', data),

    /**
     * Get system-wide configuration (admin only)
     */
    getSystem: () =>
        api.get<GlobalSystemConfig>('/api/config/system'),

    /**
     * Update system-wide configuration (admin only)
     */
    updateSystem: (data: Partial<GlobalSystemConfig>) =>
        api.put<GlobalSystemConfig>('/api/config/system', data),

    /**
     * Get auth configuration (admin only)
     */
    getAuth: () =>
        api.get<AuthConfig>('/api/config/auth'),

    /**
     * Update auth configuration (admin only)
     */
    updateAuth: (data: Partial<AuthConfig>) =>
        api.put<AuthConfig>('/api/config/auth', data),

    /**
     * Get favicon configuration
     */
    getFavicon: () =>
        api.get<FaviconConfig>('/api/config/favicon'),

    /**
     * Upload favicon (with HTML snippet)
     */
    uploadFavicon: (formData: FormData) =>
        api.post<void>('/api/config/favicon', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    /**
     * Toggle favicon enabled/disabled
     */
    toggleFavicon: (enabled: boolean) =>
        api.patch<void>('/api/config/favicon', { enabled }),

    /**
     * Delete custom favicon (reset to default)
     */
    deleteFavicon: () =>
        api.delete<void>('/api/config/favicon'),

    /**
     * Get app name for browser tab title
     */
    getAppName: () =>
        api.get<{ name?: string }>('/api/config/app-name'),
};

export default configApi;
