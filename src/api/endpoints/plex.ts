/**
 * Plex API Endpoints
 * Plex SSO, PIN authentication, server management
 */
import { api } from '../client';

// Types
export interface PlexSSOStatusResponse {
    enabled: boolean;
}

export interface PlexPinResponse {
    pinId: number;
    authUrl: string;
}

export interface PlexTokenResponse {
    authToken?: string;
    user?: {
        id: string;
        username: string;
        email?: string;
    };
}

export interface PlexServer {
    machineId: string;
    name: string;
    owned: boolean;
    connections: Array<{
        uri: string;
        local: boolean;
    }>;
}

export interface PlexResourcesResponse {
    servers: PlexServer[];
}

export interface PlexTestResponse {
    success: boolean;
    serverName?: string;
    error?: string;
}

// Endpoints
export const plexApi = {
    /**
     * Check if Plex SSO is enabled
     */
    getSSOStatus: () =>
        api.get<PlexSSOStatusResponse>('/api/plex/sso/status'),

    /**
     * Create a Plex PIN for OAuth flow
     */
    createPin: (forwardUrl: string) =>
        api.post<PlexPinResponse>('/api/plex/auth/pin', { forwardUrl }),

    /**
     * Get auth token for a claimed PIN
     */
    getToken: (pinId: number | string) =>
        api.get<PlexTokenResponse>(`/api/plex/auth/token?pinId=${pinId}`),

    /**
     * Get user's Plex servers/resources
     * Note: Returns array directly, not { servers: [...] }
     */
    getResources: (token: string) =>
        api.get<PlexServer[]>(`/api/plex/resources?token=${token}`),

    /**
     * Test Plex server connection
     */
    testConnection: (url: string, token: string) =>
        api.get<PlexTestResponse>('/api/plex/test', { params: { url, token } }),

    /**
     * Configure Plex SSO settings
     */
    saveSSOConfig: (config: {
        enabled?: boolean;
        machineId?: string;
        autoCreateUsers?: boolean;
        adminToken?: string;
        adminEmail?: string;
        adminPlexId?: string;
    }) =>
        api.post<void>('/api/plex/sso/config', config),

    /**
     * Alias for saveSSOConfig (used by SetupWizard)
     */
    setSSOConfig: (config: {
        enabled?: boolean;
        machineId?: string;
        autoCreateUsers?: boolean;
        adminToken?: string;
        adminEmail?: string;
        adminPlexId?: string;
    }) =>
        api.post<void>('/api/plex/sso/config', config),

    /**
     * Get Plex SSO config
     */
    getSSOConfig: () =>
        api.get<{
            enabled: boolean;
            adminEmail?: string;
            machineId?: string;
            autoCreateUsers: boolean;
            hasToken: boolean;
        }>('/api/plex/sso/config'),

    /**
     * Get admin's Plex servers/resources (uses stored token)
     */
    getAdminResources: () =>
        api.get<PlexServer[]>('/api/plex/admin-resources'),
};

export default plexApi;
