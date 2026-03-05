/**
 * Integration CRUD Reaction Hooks
 * 
 * Side-effect handlers called when integrations are created, updated, or deleted.
 * Extracted from IntegrationManager to separate CRUD reaction concerns
 * from service lifecycle orchestration.
 */

import logger from '../utils/logger';
import { getFirstEnabledByType, IntegrationInstance } from '../db/integrationInstances';
import { deleteLibrarySyncData } from './librarySync';
import { getPlugin } from '../integrations/registry';
import { isServicesStarted, SSE_INTEGRATION_TYPES } from './integrationState';
import { scrubIntegrationFromConfigs } from './integrationCleanup';

/**
 * Called when an integration is created.
 * @param instance - The newly created integration instance
 */
export async function onIntegrationCreated(instance: IntegrationInstance): Promise<void> {
    logger.debug(`[IntegrationManager] Integration created: id=${instance.id} type=${instance.type}`);

    // If services not started (no users yet), nothing to do
    if (!isServicesStarted()) {
        return;
    }

    // Handle Plex specifically - need to restart SSE to pick up new connection
    if (instance.type === 'plex' && instance.enabled) {
        logger.verbose('[IntegrationManager] Plex integration added - reinitializing SSE');
        // For now, no hot-reload - changes take effect on next restart
        // Future: implement reinitializePlexSocket() in sseStreamService
    }

    // Auto-start library sync for media integrations (Plex, Jellyfin, Emby)
    if (['plex', 'jellyfin', 'emby'].includes(instance.type) && instance.enabled) {
        const config = instance.config as { librarySyncEnabled?: boolean };
        if (config?.librarySyncEnabled ?? true) {
            logger.info(`[IntegrationManager] Starting library sync for new ${instance.type} integration: ${instance.id}`);
            // Import dynamically to avoid circular dependency
            const { startFullSync } = await import('./librarySync');
            startFullSync(instance.id).catch(err =>
                logger.error(`[IntegrationManager] Failed to start library sync: ${err.message}`)
            );
        }
    }

    // Sonarr/Radarr - SSE will pick up on next poll cycle automatically
    // No action needed - they check db on each poll
}

/**
 * Called when an integration is updated.
 * @param instance - The updated integration instance
 * @param changes - Fields that were changed, including previousConfig for transition detection
 */
export async function onIntegrationUpdated(
    instance: IntegrationInstance,
    changes: {
        enabled?: boolean;
        config?: boolean;
        previousConfig?: Record<string, unknown>;  // For transition detection
    }
): Promise<void> {
    logger.info(`[IntegrationManager] onIntegrationUpdated: id=${instance.id} type=${instance.type} enabled=${instance.enabled} changes.config=${changes.config}`);

    if (!isServicesStarted()) {
        logger.info(`[IntegrationManager] Skipping - services not started`);
        return;
    }

    // If enabled status changed, may need to start/stop polling
    if (changes.enabled !== undefined) {
        if (instance.type === 'plex') {
            // Plex enabled/disabled - future: hot-reload socket
            logger.verbose('[IntegrationManager] Plex enabled status changed - restart required for changes');
        }
    }

    // If config changed (URL, token, API key) - future: hot-reload connection
    if (changes.config) {
        logger.info('[IntegrationManager] Config changed branch entered');

        // Handle library sync for media integrations (Plex, Jellyfin, Emby)
        // Uses TRANSITION detection - only triggers on actual state change
        if (['plex', 'jellyfin', 'emby'].includes(instance.type) && instance.enabled) {
            const config = instance.config as { librarySyncEnabled?: boolean | string };
            const prevConfig = changes.previousConfig as { librarySyncEnabled?: boolean | string } | undefined;

            // Normalize boolean/string values
            const isEnabled = config?.librarySyncEnabled === true || config?.librarySyncEnabled === 'true';
            const wasEnabled = prevConfig?.librarySyncEnabled === true || prevConfig?.librarySyncEnabled === 'true';

            logger.info(`[IntegrationManager] Library sync transition check: wasEnabled=${wasEnabled} isEnabled=${isEnabled}`);

            // Also detect needsReauth transition (re-authenticated with fresh credentials)
            const wasNeedsReauth = (prevConfig as Record<string, unknown>)?.needsReauth === true;
            const isNeedsReauth = (config as Record<string, unknown>)?.needsReauth === true;
            const reauthResolved = wasNeedsReauth && !isNeedsReauth;

            // Only act on TRANSITIONS, not current state
            if (isEnabled && !wasEnabled || (isEnabled && reauthResolved)) {
                // TRANSITION: OFF → ON  OR  reauth resolved → Start sync
                const reason = reauthResolved ? 'reauth resolved' : 'OFF → ON';
                logger.info(`[IntegrationManager] Library sync ENABLED for: ${instance.id} (transition: ${reason})`);
                const { startFullSync } = await import('./librarySync');
                startFullSync(instance.id).catch(err =>
                    logger.error(`[IntegrationManager] Failed to start library sync: ${err.message}`)
                );
                const { invalidateSystemSettings } = await import('../utils/invalidateUserSettings');
                invalidateSystemSettings('media-search-sync');
            } else if (!isEnabled && wasEnabled) {
                // TRANSITION: ON → OFF - Purge cache
                logger.info(`[IntegrationManager] Library sync DISABLED for: ${instance.id} (transition: ON → OFF) - cleaning up`);
                try {
                    deleteLibrarySyncData(instance.id);
                    const { invalidateSystemSettings } = await import('../utils/invalidateUserSettings');
                    invalidateSystemSettings('media-search-sync');
                } catch (error) {
                    logger.error(`[IntegrationManager] Failed to cleanup library sync: error="${(error as Error).message}"`);
                }
            } else {
                // No transition - sync state unchanged
                logger.debug(`[IntegrationManager] Library sync state unchanged: ${isEnabled ? 'enabled' : 'disabled'}`);
            }
        }

        // Refresh realtime connections only when connection-relevant config changes
        // Uses plugin.connectionFields to determine which fields require reconnection
        // This prevents unnecessary WS churn when only metadata fields change (librarySyncEnabled, displayName)
        const plugin = getPlugin(instance.type);
        if (plugin?.realtime && plugin.connectionFields && instance.enabled) {
            const prevConfig = (changes.previousConfig || {}) as Record<string, unknown>;
            const newConfig = (instance.config || {}) as Record<string, unknown>;

            // Check if any connection-relevant field changed
            const connectionFieldChanged = plugin.connectionFields.some((field: string) =>
                prevConfig[field] !== newConfig[field]
            );

            if (connectionFieldChanged) {
                const { realtimeOrchestrator } = await import('./sse/RealtimeOrchestrator');
                realtimeOrchestrator.refreshConnection(instance.id);
                logger.info(`[IntegrationManager] Refreshed realtime connection for: id=${instance.id} type=${instance.type} (connection fields changed)`);
            } else {
                logger.debug(`[IntegrationManager] Skipping connection refresh for: id=${instance.id} (no connection-relevant changes)`);
            }
        }
    }
}

/**
 * Called when an integration is deleted.
 * @param instanceId - The deleted integration ID
 * @param type - The integration type
 */
export async function onIntegrationDeleted(instanceId: string, type: string): Promise<void> {
    logger.debug(`[IntegrationManager] Integration deleted: id=${instanceId} type=${type}`);

    // Cleanup library sync data for media server integrations
    if (['plex', 'jellyfin', 'emby'].includes(type)) {
        try {
            deleteLibrarySyncData(instanceId);
        } catch (error) {
            logger.error(`[IntegrationManager] Failed to cleanup library sync: error="${(error as Error).message}"`);
        }
    }

    // Scrub deleted integration ID from all widget configs (dashboards + templates)
    try {
        scrubIntegrationFromConfigs(instanceId);
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to scrub configs: error="${(error as Error).message}"`);
    }

    if (!isServicesStarted()) {
        return;
    }

    // Check if this was the last instance of this type
    const remainingInstances = getFirstEnabledByType(type);

    if (!remainingInstances && SSE_INTEGRATION_TYPES.includes(type)) {
        logger.info(`[IntegrationManager] Last ${type} instance deleted - polling will stop`);
        // Polling will naturally stop when it can't find any enabled instances
    }
}
