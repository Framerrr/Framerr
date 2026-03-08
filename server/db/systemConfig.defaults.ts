/**
 * System Configuration Defaults
 *
 * Extracted from systemConfig.ts for single-responsibility.
 * Contains the default configuration constant used when no database entries exist.
 */

import type {
    AuthConfig,
    IntegrationsMap,
    FullSystemConfig,
} from './systemConfig.types';

// Default system configuration
export const DEFAULT_CONFIG: FullSystemConfig = {
    server: {
        port: 3001,
        name: 'Framerr'
    },
    auth: {
        local: { enabled: true },
        proxy: {
            enabled: false,
            headerName: '',
            emailHeaderName: '',
            whitelist: [],
            overrideLogout: false,
            logoutUrl: ''
        },
        iframe: {
            enabled: false,
            endpoint: '',
            clientId: '',
            redirectUri: '',
            scopes: 'openid profile email'
        },
        session: { timeout: 86400000 }
    } as AuthConfig,
    integrations: {
        plex: { enabled: false },
        sonarr: { enabled: false },
        radarr: { enabled: false },
        overseerr: { enabled: false },
        qbittorrent: { enabled: false }
    } as IntegrationsMap,
    groups: [
        {
            id: 'admin',
            name: 'Administrators',
            description: 'Full system access',
            permissions: ['*'],
            locked: true
        },
        {
            id: 'user',
            name: 'Users',
            description: 'Personal customization',
            permissions: ['view_dashboard', 'manage_widgets'],
            locked: true
        },
        {
            id: 'guest',
            name: 'Guests',
            description: 'View only',
            permissions: ['view_dashboard'],
            locked: true
        }
    ],
    defaultGroup: 'user',
    tabGroups: [
        { id: 'media', name: 'Media', order: 0 },
        { id: 'downloads', name: 'Downloads', order: 1 },
        { id: 'system', name: 'System', order: 2 }
    ],
    webPushEnabled: true,
    monitorDefaults: {
        intervalSeconds: 60,
        timeoutSeconds: 10,
        retriesBeforeDown: 3,
        degradedThresholdMs: 2000,
        expectedStatusCodes: ['200-299'],
    },
    metricHistoryDefaults: {
        mode: 'auto',
        retentionDays: 3,
    },
    metricHistory: {
        enabled: false,
    },
};
