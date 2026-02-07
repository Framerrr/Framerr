/**
 * System Configuration Types
 * Full system configuration structure stored in database
 */

import type { TabGroup } from '../../shared/types/tab';
import type { IntegrationsMap, WebhookConfig } from '../../shared/types/integration';

/**
 * Server configuration
 */
export interface ServerConfig {
    port: number;
    name: string;
    host?: string;
}

/**
 * Proxy authentication configuration
 */
export interface ProxyAuthConfig {
    enabled: boolean;
    headerName?: string;
    emailHeaderName?: string;
    logoutUrl?: string;
    trustedProxies?: string[];
}

/**
 * Plex SSO configuration
 */
export interface PlexSSOConfig {
    enabled: boolean;
    adminPlexId?: string;
    machineId?: string;
    serverName?: string;
}

/**
 * Iframe authentication detection configuration
 */
export interface IframeAuthConfig {
    enabled: boolean;
    sensitivity?: 'conservative' | 'balanced' | 'aggressive';
    customPatterns?: string[];
}

/**
 * Combined authentication configuration
 */
export interface AuthConfig {
    local?: {
        enabled: boolean;
    };
    proxy?: ProxyAuthConfig;
    plex?: PlexSSOConfig;
    iframe?: IframeAuthConfig;
    authPatterns?: string[];
    session?: {
        timeout?: number;
        rememberMeDuration?: number;
    };
}

/**
 * Permission group definition
 */
export interface PermissionGroup {
    id: string;
    name: string;
    description?: string;
    permissions: string[];  // '*' for admin (all permissions)
    locked?: boolean;       // Prevent deletion
}

/**
 * Favicon configuration
 */
export interface FaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
    uploadedAt?: string;
    uploadedBy?: string;
}

/**
 * Complete system configuration
 * Stored in system_config table as key-value pairs
 */
export interface SystemConfig {
    server: ServerConfig;
    auth: AuthConfig;
    integrations: IntegrationsMap;
    groups: PermissionGroup[];
    tabGroups: TabGroup[];
    webPushEnabled: boolean;
    favicon?: FaviconConfig;
}

/**
 * Partial system config for updates
 */
export type SystemConfigUpdate = Partial<SystemConfig>;

/**
 * Keys used in system_config table
 */
export type SystemConfigKey =
    | 'server'
    | 'auth'
    | 'integrations'
    | 'groups'
    | 'tabGroups'
    | 'webPushEnabled'
    | 'favicon'
    | string;
