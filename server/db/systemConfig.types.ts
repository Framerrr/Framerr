/**
 * System Configuration Type Definitions
 *
 * Extracted from systemConfig.ts for single-responsibility.
 * All config domain interfaces and the unified FullSystemConfig type.
 *
 * TYPE AUTHORITY:
 * - These types are the canonical server-internal authority for system config.
 * - For API-layer shared types, see `shared/types/` (the cross-stack authority).
 * - DB-local types (IntegrationConfig, IntegrationsMap, TabGroup, AuthConfig,
 *   FullSystemConfig, row types) intentionally differ from shared/types where
 *   the server-internal shape diverges from the API contract.
 */

export interface SystemConfigRow {
    key: string;
    value: string;
}

export interface IntegrationConfig {
    enabled: boolean;
    webhookConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface IntegrationsMap {
    [key: string]: IntegrationConfig;
}

export interface AuthConfig {
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

export interface PermissionGroup {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    locked?: boolean;
}

export interface TabGroup {
    id: string;
    name: string;
    order: number;
}

export interface FaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
    uploadedAt?: string;
    uploadedBy?: string;
}

export interface ServerConfig {
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

export interface MetricHistoryDefaultsConfig {
    mode: 'auto' | 'internal' | 'external'; // Default source mode (excludes 'off')
    retentionDays: number;                   // Default retention period (1-30)
}

export interface MetricHistoryIntegrationConfig {
    mode: 'auto' | 'internal' | 'external' | 'off';
    retentionDays: number; // 1-30, default 3
}

export interface MetricHistoryConfig {
    enabled: boolean; // Global kill switch
    integrations?: Record<string, MetricHistoryIntegrationConfig>;
}

// Standalone FullSystemConfig - not extending external types to avoid conflicts
export interface FullSystemConfig {
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
    metricHistoryDefaults?: MetricHistoryDefaultsConfig;
    /** Theme preset shown on the login page — auto-synced when admin changes theme */
    loginTheme?: string;
    /** Metric history recording — experimental feature */
    metricHistory?: MetricHistoryConfig;
}
