/**
 * Auth Feature Types
 * Shared type definitions for authentication settings
 */

export type TabId = 'proxy' | 'plex' | 'iframe';

export interface OriginalSettings {
    proxyEnabled: boolean;
    headerName: string;
    emailHeaderName: string;
    whitelist: string;
    overrideLogout: boolean;
    logoutUrl: string;
    iframeEnabled: boolean;
    oauthEndpoint: string;
    clientId: string;
    redirectUri: string;
    scopes: string;
}

export interface AuthSettingsProps {
    activeSubTab?: string | null;
}

// Plex SSO types (from PlexAuthSettings)
export interface PlexConfig {
    enabled: boolean;
    adminEmail: string;
    machineId: string;
    autoCreateUsers: boolean;
    hasToken: boolean;
}

export interface PlexServer {
    machineId: string;
    name: string;
    owned: boolean;
}

export interface PlexAuthSettingsProps {
    onSaveNeeded?: (hasChanges: boolean) => void;
    onSave?: React.MutableRefObject<(() => Promise<void>) | undefined>;
}
