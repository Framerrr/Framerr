/**
 * Integration Types
 * Shared between frontend (settings, widgets) and backend (integration routes)
 */

/**
 * Sharing mode for integrations
 */
export type IntegrationSharingMode = 'none' | 'all' | 'groups' | 'users';

/**
 * Sharing configuration for an integration
 */
export interface IntegrationSharing {
    mode: IntegrationSharingMode;
    groups?: string[];
    users?: string[];
    sharedBy?: string;
    sharedAt?: string;
}

/**
 * Webhook configuration for notification integrations
 */
export interface WebhookConfig {
    token?: string;
    adminEvents?: string[];
    userEvents?: string[];
    receiveUnmatched?: boolean;
}

/**
 * Base integration configuration
 */
export interface BaseIntegration {
    enabled: boolean;
    sharing?: IntegrationSharing;
    webhookConfig?: WebhookConfig;
    // Common fields (optional for index signature compatibility)
    name?: string;
    url?: string;
    apiKey?: string;
    token?: string;
}

/**
 * Plex integration config
 */
export interface PlexIntegration extends BaseIntegration {
    url: string;
    token: string;
    machineId?: string;
}

/**
 * Sonarr/Radarr integration config (*arr apps)
 */
export interface ArrIntegration extends BaseIntegration {
    url: string;
    apiKey: string;
}

/**
 * Overseerr/Jellyseerr integration config
 */
export interface OverseerrIntegration extends BaseIntegration {
    url: string;
    apiKey: string;
}

/**
 * qBittorrent integration config
 */
export interface QBittorrentIntegration extends BaseIntegration {
    url: string;
    username: string;
    password: string;
}

/**
 * System status integration config
 */
export interface SystemStatusIntegration extends BaseIntegration {
    backend: 'local' | 'glances' | 'custom';
    customUrl?: string;
    glancesUrl?: string;
}

/**
 * Map of all integrations by service name
 */
export interface IntegrationsMap {
    plex?: PlexIntegration;
    sonarr?: ArrIntegration;
    radarr?: ArrIntegration;
    overseerr?: OverseerrIntegration;
    qbittorrent?: QBittorrentIntegration;
    systemStatus?: SystemStatusIntegration;
    [key: string]: BaseIntegration | undefined;
}

/**
 * Integration service identifiers
 */
export type IntegrationId =
    | 'plex'
    | 'sonarr'
    | 'radarr'
    | 'overseerr'
    | 'qbittorrent'
    | 'systemStatus';
