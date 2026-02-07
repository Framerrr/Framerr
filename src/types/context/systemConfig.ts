/**
 * SystemConfigContext Types
 * Types for system configuration state
 */

import type { TabGroup } from '../../../shared/types/tab';
import type { IntegrationsMap } from '../../../shared/types/integration';

/**
 * Permission group definition
 */
export interface PermissionGroup {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    locked?: boolean;
}

/**
 * Application branding settings
 */
export interface AppBranding {
    appName: string;
    appIcon?: string;
}

/**
 * Favicon configuration
 */
export interface FaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
}

/**
 * System configuration object
 * Admin-only settings that affect all users
 */
export interface SystemConfig {
    /**
     * Tab groups for sidebar organization
     */
    groups?: TabGroup[];

    /**
     * Alias for groups (used in some contexts)
     */
    tabGroups?: TabGroup[];

    /**
     * Admin-configured integrations
     */
    integrations?: IntegrationsMap;

    /**
     * Permission groups
     */
    permissionGroups?: PermissionGroup[];

    /**
     * Whether web push is enabled globally
     */
    webPushEnabled?: boolean;

    /**
     * Favicon configuration
     */
    favicon?: FaviconConfig;

    /**
     * Application branding
     */
    branding?: AppBranding;

    /**
     * Authentication configuration
     */
    auth?: {
        iframe?: {
            enabled?: boolean;
            endpoint?: string;
            clientId?: string;
            redirectUri?: string;
            scopes?: string;
        };
    };

    /**
     * Additional config values
     */
    [key: string]: unknown;
}

/**
 * SystemConfigContext value provided to consumers
 */
export interface SystemConfigContextValue {
    /**
     * System configuration, null while loading
     */
    systemConfig: SystemConfig | null;

    /**
     * True while loading system config
     */
    loading: boolean;

    /**
     * Refresh system config from server
     */
    refreshSystemConfig: () => Promise<void>;
}

/**
 * SystemConfigProvider props
 */
export interface SystemConfigProviderProps {
    children: React.ReactNode;
}
