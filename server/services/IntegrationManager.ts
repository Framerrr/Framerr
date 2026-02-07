/**
 * IntegrationManager
 * 
 * Centralized service lifecycle management.
 * - Initializes services only when first user exists
 * - Provides hooks for integration changes (add/update/delete)
 * - Unifies startup/shutdown across all background services
 */

import logger from '../utils/logger';
import { hasUsers } from '../db/users';
import { getFirstEnabledByType, IntegrationInstance } from '../db/integrationInstances';

// Service imports
// NOTE: SSE orchestrators are self-starting on first subscription - no manual init needed
import servicePoller from './servicePoller';
import { initializeBackupScheduler, shutdownBackupScheduler } from './backupScheduler';
import { startCleanupJob, stopCleanupJob } from './mediaCacheCleanup';
import { deleteLibrarySyncData } from './librarySyncService';
import { getPlugin } from '../integrations/registry';

// Track initialization state
let isInitialized = false;
let servicesStarted = false;

/**
 * Integration types that affect SSE polling
 */
const SSE_INTEGRATION_TYPES = ['plex', 'sonarr', 'radarr'];

/**
 * Initialize the IntegrationManager.
 * Called once at server startup.
 * Services will only start if users exist.
 */
export async function initializeIntegrationManager(): Promise<void> {
    if (isInitialized) {
        logger.warn('[IntegrationManager] Already initialized');
        return;
    }

    isInitialized = true;

    // Check if any users exist
    const usersExist = hasUsers();

    if (!usersExist) {
        // No users yet - services will start when first user is created
        return;
    }

    // Users exist - start services
    await startAllServices();
}

/**
 * Start all background services.
 * Called when first user is created OR at startup if users exist.
 * Each service is wrapped in try/catch so one failure doesn't prevent others.
 */
export async function startAllServices(): Promise<void> {
    if (servicesStarted) {
        logger.debug('[IntegrationManager] Services already started');
        return;
    }

    logger.info('[IntegrationManager] Starting background services');

    // NOTE: SSE stream service no longer needs manual init
    // PollerOrchestrator and RealtimeOrchestrator start on first subscription

    // Start service poller (monitor health checks)
    try {
        await servicePoller.start();
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to start service poller: error="${(error as Error).message}"`);
    }

    // Start media cache cleanup job
    try {
        startCleanupJob();
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to start cache cleanup job: error="${(error as Error).message}"`);
    }

    // Initialize backup scheduler
    try {
        await initializeBackupScheduler();
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to start backup scheduler: error="${(error as Error).message}"`);
    }

    servicesStarted = true;
    logger.info('[IntegrationManager] All services started');
}

/**
 * Shutdown all background services.
 * Called on server shutdown (SIGTERM/SIGINT).
 */
export function shutdownIntegrationManager(): void {
    if (!servicesStarted) {
        return;
    }

    logger.info('[IntegrationManager] Shutting down services');

    servicePoller.stop();
    shutdownBackupScheduler();
    stopCleanupJob();

    servicesStarted = false;
    isInitialized = false;

    logger.info('[IntegrationManager] Shutdown complete');
}

/**
 * Called when first user is created.
 * Triggers service initialization if deferred.
 */
export async function onFirstUserCreated(): Promise<void> {
    if (servicesStarted) {
        logger.debug('[IntegrationManager] Services already running');
        return;
    }

    // startAllServices() will log the start message
    await startAllServices();
}

/**
 * Called when an integration is created.
 * @param instance - The newly created integration instance
 */
export async function onIntegrationCreated(instance: IntegrationInstance): Promise<void> {
    logger.debug(`[IntegrationManager] Integration created: id=${instance.id} type=${instance.type}`);

    // If services not started (no users yet), nothing to do
    if (!servicesStarted) {
        return;
    }

    // Handle Plex specifically - need to restart SSE to pick up new connection
    if (instance.type === 'plex' && instance.enabled) {
        logger.verbose('[IntegrationManager] Plex integration added - reinitializing SSE');
        // For now, no hot-reload - changes take effect on next restart
        // Future: implement reinitializePlexSocket() in sseStreamService

        // Auto-start library sync if enabled
        const config = instance.config as { librarySyncEnabled?: boolean };
        if (config?.librarySyncEnabled ?? true) {
            logger.info(`[IntegrationManager] Starting library sync for new Plex integration: ${instance.id}`);
            // Import dynamically to avoid circular dependency
            const { startFullSync } = await import('./librarySyncService');
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

    if (!servicesStarted) {
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

            // Only act on TRANSITIONS, not current state
            if (isEnabled && !wasEnabled) {
                // TRANSITION: OFF → ON - Start sync
                logger.info(`[IntegrationManager] Library sync ENABLED for: ${instance.id} (transition: OFF → ON)`);
                const { startFullSync } = await import('./librarySyncService');
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

    if (!servicesStarted) {
        return;
    }

    // Check if this was the last instance of this type
    const remainingInstances = getFirstEnabledByType(type);

    if (!remainingInstances && SSE_INTEGRATION_TYPES.includes(type)) {
        logger.info(`[IntegrationManager] Last ${type} instance deleted - polling will stop`);
        // Polling will naturally stop when it can't find any enabled instances
    }
}

/**
 * Get manager status for diagnostics.
 */
export function getManagerStatus(): {
    initialized: boolean;
    servicesStarted: boolean;
} {
    return {
        initialized: isInitialized,
        servicesStarted
    };
}

/**
 * Get comprehensive diagnostics including poller and realtime health.
 * Used for health endpoints and debugging.
 */
export function getDiagnostics(): {
    manager: { initialized: boolean; servicesStarted: boolean };
    pollers: import('./sse/PollerOrchestrator').PollerHealth[];
    realtime: import('./sse/RealtimeOrchestrator').RealtimeHealth[];
} {
    // Import lazily to avoid circular dependency
    const { pollerOrchestrator } = require('./sse/PollerOrchestrator');
    const { realtimeOrchestrator } = require('./sse/RealtimeOrchestrator');

    return {
        manager: {
            initialized: isInitialized,
            servicesStarted
        },
        pollers: pollerOrchestrator.getHealth(),
        realtime: realtimeOrchestrator.getHealth()
    };
}
