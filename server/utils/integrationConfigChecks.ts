/**
 * Integration Configuration Checks Registry
 * 
 * This module provides a centralized system for determining if an integration
 * is properly configured. Each integration can define its own check logic.
 * 
 * ============================================================================
 * HOW TO ADD A NEW INTEGRATION:
 * ============================================================================
 * 
 * 1. SIMPLE INTEGRATION (just needs URL/apiKey):
 *    → Add the integration ID to SIMPLE_INTEGRATIONS array below
 *    → It will automatically use the default check: enabled && url
 * 
 * 2. COMPLEX INTEGRATION (custom requirements):
 *    → Export an isConfigured() function from the integration's route file
 *    → Import it here and add to CUSTOM_CHECKS object
 * 
 * ============================================================================
 */

import { isConfigured as serviceMonitoringIsConfigured } from '../routes/serviceMonitors';
import { isConfigured as plexIsConfigured } from '../routes/plex';

/**
 * Integration config interface
 */
export interface IntegrationConfig {
    enabled?: boolean;
    url?: string;
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    backend?: string;
    glances?: { url?: string };
    custom?: { url?: string };
    [key: string]: unknown;
}

/**
 * Type for custom configuration check functions
 */
type ConfigCheckFn = (config: IntegrationConfig) => boolean;

/**
 * Simple integrations that use the default check (enabled && url)
 * Add new simple integrations here - no other code changes needed!
 */
const SIMPLE_INTEGRATIONS = [
    'sonarr',
    'radarr',
    'overseerr',
    'qbittorrent',
    // Add new simple integrations here
] as const;

/**
 * Sub-integrations that are part of a parent integration and should be silently skipped
 * These don't need their own config check - they're handled by their parent
 */
const IGNORED_INTEGRATIONS = [
    'uptime-kuma', // Part of servicemonitoring, not standalone
] as const;

/**
 * Custom checks for complex integrations
 * Each function receives the integration config and returns true if properly configured
 */
const CUSTOM_CHECKS: Record<string, ConfigCheckFn> = {
    /**
     * Service Monitoring: configured if at least 1 monitor exists
     * (check is in serviceMonitors.ts)
     */
    servicemonitoring: () => serviceMonitoringIsConfigured(),

    /**
     * Plex: needs URL and token
     * (check is in plex.ts)
     */
    plex: (config) => plexIsConfigured(config),

    /**
     * System Status: needs glances or custom backend URL
     * Inline because it's a simple config check, no DB query
     */
    systemstatus: (config) => {
        return !!(
            (config.backend === 'glances' && config.glances?.url) ||
            (config.backend === 'custom' && config.custom?.url) ||
            (!config.backend && config.url) // legacy fallback
        );
    },

    // Add new complex integrations here
};

/**
 * Default check for simple integrations
 * Just needs enabled + url
 */
function defaultIsConfigured(config: IntegrationConfig): boolean {
    return !!config.url;
}

/**
 * Compute whether an integration is properly configured
 * 
 * @param integrationId - The integration identifier (e.g., 'plex', 'sonarr')
 * @param config - The integration's configuration object
 * @returns true if the integration is properly configured
 */
export function computeIsConfigured(integrationId: string, config: Record<string, unknown>): boolean {
    const typedConfig = config as IntegrationConfig;

    // Must be enabled first
    if (!typedConfig.enabled) return false;

    // Check for custom handler
    const customCheck = CUSTOM_CHECKS[integrationId];
    if (customCheck) {
        return customCheck(typedConfig);
    }

    // Simple integrations use default check
    if ((SIMPLE_INTEGRATIONS as readonly string[]).includes(integrationId)) {
        return defaultIsConfigured(typedConfig);
    }

    // Sub-integrations that are part of a parent - silently skip (no warning)
    if ((IGNORED_INTEGRATIONS as readonly string[]).includes(integrationId)) {
        return defaultIsConfigured(typedConfig);
    }

    // Unknown integration - log warning and use safe default
    // This prevents breaking if a new integration is added but not registered
    console.warn(`[integrationConfigChecks] Unknown integration: ${integrationId} - using default check`);
    return defaultIsConfigured(typedConfig);
}
