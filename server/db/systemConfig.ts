import { getDb } from '../database/db';
import logger from '../utils/logger';

// In-memory cache to prevent repeated database queries
let configCache: FullSystemConfig | null = null;
let cacheTimestamp: number | null = null;

interface SystemConfigRow {
    key: string;
    value: string;
}

interface IntegrationConfig {
    enabled: boolean;
    webhookConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

interface IntegrationsMap {
    [key: string]: IntegrationConfig;
}

interface AuthConfig {
    local: { enabled: boolean };
    proxy: {
        enabled: boolean;
        headerName: string;
        emailHeaderName: string;
        whitelist: string[];
        overrideLogout: boolean;
        logoutUrl: string;
    };
    iframe: {
        enabled: boolean;
        endpoint: string;
        clientId: string;
        redirectUri: string;
        scopes: string;
    };
    session: { timeout: number };
}

interface PermissionGroup {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    locked?: boolean;
}

interface TabGroup {
    id: string;
    name: string;
    order: number;
}

interface FaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
}

interface ServerConfig {
    port: number;
    name: string;
}

export interface BackupScheduleConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    dayOfWeek?: number;  // 0-6 (Sunday-Saturday), only for weekly
    hour: number;        // 0-23
    maxBackups: number;  // 1-10
    lastBackup?: string; // ISO timestamp
    nextBackup?: string; // ISO timestamp
}

export interface MonitorDefaultsConfig {
    intervalSeconds: number;         // Default check interval
    timeoutSeconds: number;          // Default request timeout
    retriesBeforeDown: number;       // Retries before marking "down"
    degradedThresholdMs: number;     // Response time threshold for "degraded"
    expectedStatusCodes: string[];   // Default expected HTTP status codes
}

// Standalone FullSystemConfig - not extending external types to avoid conflicts
interface FullSystemConfig {
    server: ServerConfig;
    auth: AuthConfig;
    integrations: IntegrationsMap;
    groups: PermissionGroup[];
    tabGroups: TabGroup[];
    defaultGroup?: string;
    debug?: Record<string, unknown>;
    favicon?: FaviconConfig;
    plexSSO?: Record<string, unknown>;
    webhookBaseUrl?: string;
    vapidKeys?: Record<string, string>;
    webPushEnabled?: boolean;
    backupSchedule?: BackupScheduleConfig;
    monitorDefaults?: MonitorDefaultsConfig;
    /** Theme preset shown on the login page — auto-synced when admin changes theme */
    loginTheme?: string;
}

// Default system configuration
const DEFAULT_CONFIG: FullSystemConfig = {
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
};

/**
 * Helper: Rebuild nested config object from flattened key-value pairs
 */
function buildConfigFromKeyValues(rows: SystemConfigRow[]): FullSystemConfig {
    const config: FullSystemConfig = { ...DEFAULT_CONFIG };

    for (const row of rows) {
        const { key, value } = row;
        const parsed = JSON.parse(value);

        // Map keys to config structure
        switch (key) {
            case 'server':
                config.server = { ...config.server, ...parsed };
                break;
            case 'auth.local':
                (config.auth as AuthConfig).local = { ...(config.auth as AuthConfig).local, ...parsed };
                break;
            case 'auth.proxy':
                (config.auth as AuthConfig).proxy = { ...(config.auth as AuthConfig).proxy, ...parsed };
                break;
            case 'auth.iframe':
                (config.auth as AuthConfig).iframe = { ...(config.auth as AuthConfig).iframe, ...parsed };
                break;
            case 'auth.session':
                (config.auth as AuthConfig).session = { ...(config.auth as AuthConfig).session, ...parsed };
                break;
            case 'integrations':
                config.integrations = { ...config.integrations, ...parsed };
                break;
            case 'groups':
                config.groups = parsed;
                break;
            case 'defaultGroup':
                config.defaultGroup = parsed;
                break;
            case 'tabGroups':
                config.tabGroups = parsed;
                break;
            case 'debug':
                config.debug = parsed;
                break;
            case 'favicon':
                config.favicon = parsed;
                break;
            case 'plexSSO':
                config.plexSSO = parsed;
                break;
            case 'webhookBaseUrl':
                config.webhookBaseUrl = parsed;
                break;
            case 'vapidKeys':
                config.vapidKeys = parsed;
                break;
            case 'webPushEnabled':
                config.webPushEnabled = parsed;
                break;
            case 'backupSchedule':
                config.backupSchedule = parsed;
                break;
            case 'monitorDefaults':
                config.monitorDefaults = parsed;
                break;
            case 'loginTheme':
                config.loginTheme = parsed;
                break;
        }
    }

    return config;
}

/**
 * Read system configuration from SQLite (with in-memory caching)
 */
export async function getSystemConfig(): Promise<FullSystemConfig> {
    try {
        // Return cached config if available
        if (configCache !== null) {
            return configCache;
        }

        const rows = getDb().prepare('SELECT key, value FROM system_config').all() as SystemConfigRow[];

        // If no config exists, cache and return defaults
        if (rows.length === 0) {
            logger.info('[SystemConfig] No config in database, returning defaults');
            configCache = DEFAULT_CONFIG;
            cacheTimestamp = Date.now();
            return DEFAULT_CONFIG;
        }

        const config = buildConfigFromKeyValues(rows);

        // Cache the config
        configCache = config;
        cacheTimestamp = Date.now();
        logger.debug(`[SystemConfig] Loaded and cached: timestamp=${cacheTimestamp}`);

        return config;
    } catch (error) {
        logger.error(`[SystemConfig] Failed to read: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Deep merge integration configs to preserve nested properties like webhookConfig
 */
function deepMergeIntegrations(
    current: IntegrationsMap | undefined,
    updates: IntegrationsMap | undefined
): IntegrationsMap {
    if (!updates) return current || {};

    const merged: IntegrationsMap = { ...current };

    for (const [key, value] of Object.entries(updates)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const currentIntegration = merged[key] as IntegrationConfig | undefined;
            merged[key] = {
                ...(currentIntegration || {}),
                ...value,
                webhookConfig: value.webhookConfig !== undefined
                    ? { ...(currentIntegration?.webhookConfig || {}), ...value.webhookConfig }
                    : currentIntegration?.webhookConfig
            } as IntegrationConfig;
        } else {
            merged[key] = value;
        }
    }

    return merged;
}

/**
 * Update system configuration in SQLite
 */
export async function updateSystemConfig(updates: Partial<FullSystemConfig>): Promise<FullSystemConfig> {
    const currentConfig = await getSystemConfig();

    // VALIDATION: Prevent modification/deletion of system groups
    if (updates.groups) {
        throw new Error('Permission groups cannot be modified. Groups are locked to: admin, user, guest');
    }

    const currentAuth = currentConfig.auth as AuthConfig;
    const updateAuth = updates.auth as Partial<AuthConfig> | undefined;

    // Build new config explicitly to avoid merge issues
    const newConfig: FullSystemConfig = {
        server: { ...currentConfig.server, ...(updates.server || {}) },
        auth: {
            local: { ...currentAuth?.local, ...(updateAuth?.local || {}) },
            session: { ...currentAuth?.session, ...(updateAuth?.session || {}) },
            proxy: { ...currentAuth?.proxy, ...(updateAuth?.proxy || {}) },
            iframe: { ...currentAuth?.iframe, ...(updateAuth?.iframe || {}) }
        } as AuthConfig,
        integrations: deepMergeIntegrations(
            currentConfig.integrations as IntegrationsMap,
            updates.integrations as IntegrationsMap
        ),
        debug: { ...currentConfig.debug, ...(updates.debug || {}) },
        favicon: updates.favicon !== undefined ? updates.favicon : currentConfig.favicon,
        groups: currentConfig.groups,
        defaultGroup: updates.defaultGroup || currentConfig.defaultGroup,
        tabGroups: updates.tabGroups || currentConfig.tabGroups,
        plexSSO: updates.plexSSO ? { ...currentConfig.plexSSO, ...updates.plexSSO } : currentConfig.plexSSO,
        webhookBaseUrl: updates.webhookBaseUrl !== undefined ? updates.webhookBaseUrl : currentConfig.webhookBaseUrl,
        vapidKeys: updates.vapidKeys ? { ...currentConfig.vapidKeys, ...updates.vapidKeys } : currentConfig.vapidKeys,
        webPushEnabled: updates.webPushEnabled !== undefined ? updates.webPushEnabled : currentConfig.webPushEnabled,
        backupSchedule: updates.backupSchedule !== undefined
            ? { ...currentConfig.backupSchedule, ...updates.backupSchedule }
            : currentConfig.backupSchedule,
        monitorDefaults: updates.monitorDefaults !== undefined
            ? { ...currentConfig.monitorDefaults, ...updates.monitorDefaults }
            : currentConfig.monitorDefaults,
        loginTheme: updates.loginTheme !== undefined ? updates.loginTheme : currentConfig.loginTheme,
    };

    try {
        const upsert = getDb().prepare(`
            INSERT INTO system_config (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);

        const updateMany = getDb().transaction(() => {
            if (updates.server) {
                upsert.run('server', JSON.stringify(newConfig.server));
            }
            if (updateAuth?.local) {
                upsert.run('auth.local', JSON.stringify((newConfig.auth as AuthConfig).local));
            }
            if (updateAuth?.proxy) {
                upsert.run('auth.proxy', JSON.stringify((newConfig.auth as AuthConfig).proxy));
            }
            if (updateAuth?.iframe) {
                upsert.run('auth.iframe', JSON.stringify((newConfig.auth as AuthConfig).iframe));
            }
            if (updateAuth?.session) {
                upsert.run('auth.session', JSON.stringify((newConfig.auth as AuthConfig).session));
            }
            if (updates.integrations) {
                upsert.run('integrations', JSON.stringify(newConfig.integrations));
            }
            if (updates.debug) {
                upsert.run('debug', JSON.stringify(newConfig.debug));
            }
            if (updates.favicon !== undefined) {
                upsert.run('favicon', JSON.stringify(newConfig.favicon));
            }
            if (updates.defaultGroup) {
                upsert.run('defaultGroup', JSON.stringify(newConfig.defaultGroup));
            }
            if (updates.tabGroups) {
                upsert.run('tabGroups', JSON.stringify(newConfig.tabGroups));
            }
            if (updates.plexSSO) {
                upsert.run('plexSSO', JSON.stringify(newConfig.plexSSO));
            }
            if (updates.webhookBaseUrl !== undefined) {
                upsert.run('webhookBaseUrl', JSON.stringify(newConfig.webhookBaseUrl));
            }
            if (updates.vapidKeys) {
                upsert.run('vapidKeys', JSON.stringify(newConfig.vapidKeys));
            }
            if (updates.webPushEnabled !== undefined) {
                upsert.run('webPushEnabled', JSON.stringify(newConfig.webPushEnabled));
            }
            if (updates.backupSchedule !== undefined) {
                upsert.run('backupSchedule', JSON.stringify(newConfig.backupSchedule));
            }
            if (updates.monitorDefaults !== undefined) {
                upsert.run('monitorDefaults', JSON.stringify(newConfig.monitorDefaults));
            }
            if (updates.loginTheme !== undefined) {
                upsert.run('loginTheme', JSON.stringify(newConfig.loginTheme));
            }
        });

        updateMany();

        // Invalidate cache after update
        configCache = null;
        cacheTimestamp = null;
        logger.info('[SystemConfig] Updated (cache invalidated)');

        return newConfig;
    } catch (error) {
        logger.error(`[SystemConfig] Failed to update: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Invalidate config cache - called when database is restored
 */
export function invalidateConfigCache(): void {
    configCache = null;
    cacheTimestamp = null;
    logger.info('[SystemConfig] Cache invalidated');
}

export { DEFAULT_CONFIG };

/** Get current monitor defaults (from config or fallback) */
export async function getMonitorDefaults(): Promise<MonitorDefaultsConfig> {
    const config = await getSystemConfig();
    return config.monitorDefaults ?? DEFAULT_CONFIG.monitorDefaults!;
}
