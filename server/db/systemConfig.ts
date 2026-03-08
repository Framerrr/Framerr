/**
 * System Configuration Persistence Engine
 *
 * Core read/write/cache logic for the system_config SQLite table.
 * Types and defaults are extracted to separate modules for single-responsibility.
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';
import { DEFAULT_CONFIG } from './systemConfig.defaults';
import type {
    SystemConfigRow,
    AuthConfig,
    IntegrationConfig,
    IntegrationsMap,
    FullSystemConfig,
    MonitorDefaultsConfig,
    MetricHistoryDefaultsConfig,
} from './systemConfig.types';

// Re-export types and defaults for backward compatibility
export * from './systemConfig.types';
export { DEFAULT_CONFIG } from './systemConfig.defaults';

// In-memory cache to prevent repeated database queries
let configCache: FullSystemConfig | null = null;
let cacheTimestamp: number | null = null;

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
            case 'metricHistoryDefaults':
                config.metricHistoryDefaults = parsed;
                break;
            case 'loginTheme':
                config.loginTheme = parsed;
                break;
            case 'metricHistory':
                config.metricHistory = parsed;
                break;
        }
    }

    return config;
}

/**
 * Read system configuration from SQLite (with in-memory caching)
 */
export function getSystemConfig(): FullSystemConfig {
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
export function updateSystemConfig(updates: Partial<FullSystemConfig>): FullSystemConfig {
    const currentConfig = getSystemConfig();

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
        metricHistoryDefaults: updates.metricHistoryDefaults !== undefined
            ? { ...currentConfig.metricHistoryDefaults, ...updates.metricHistoryDefaults }
            : currentConfig.metricHistoryDefaults,
        loginTheme: updates.loginTheme !== undefined ? updates.loginTheme : currentConfig.loginTheme,
        metricHistory: updates.metricHistory !== undefined
            ? { ...currentConfig.metricHistory, ...updates.metricHistory }
            : currentConfig.metricHistory,
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
            if (updates.metricHistoryDefaults !== undefined) {
                upsert.run('metricHistoryDefaults', JSON.stringify(newConfig.metricHistoryDefaults));
            }
            if (updates.loginTheme !== undefined) {
                upsert.run('loginTheme', JSON.stringify(newConfig.loginTheme));
            }
            if (updates.metricHistory !== undefined) {
                upsert.run('metricHistory', JSON.stringify(newConfig.metricHistory));
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

/** Get current monitor defaults (from config or fallback) */
export function getMonitorDefaults(): MonitorDefaultsConfig {
    const config = getSystemConfig();
    return config.monitorDefaults ?? DEFAULT_CONFIG.monitorDefaults!;
}

/** Get current metric history defaults (from config or fallback) */
export function getMetricHistoryDefaults(): MetricHistoryDefaultsConfig {
    const config = getSystemConfig();
    return config.metricHistoryDefaults ?? DEFAULT_CONFIG.metricHistoryDefaults!;
}
