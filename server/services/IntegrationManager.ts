/**
 * IntegrationManager
 * 
 * Centralized service lifecycle management.
 * - Initializes services only when first user exists
 * - Provides hooks for integration changes (add/update/delete) via re-exports
 * - Unifies startup/shutdown across all background services
 * 
 * CRUD reaction hooks and persistence cleanup are extracted to:
 * - ./integrationReactions.ts (onIntegrationCreated/Updated/Deleted)
 * - ./integrationCleanup.ts (scrubIntegrationFromConfigs)
 * 
 * Shared state lives in:
 * - ./integrationState.ts (initialization flags, SSE types, diagnostics)
 */

import logger from '../utils/logger';
import { hasUsers } from '../db/users';

// Service imports
// NOTE: SSE orchestrators are self-starting on first subscription - no manual init needed
import servicePoller from './servicePoller';
import { initializeBackupScheduler, shutdownBackupScheduler } from './backupScheduler';
import { startCleanupJob, stopCleanupJob } from './mediaCacheCleanup';
import { startLibrarySyncJob, stopLibrarySyncJob } from './librarySync';
import { metricHistoryService } from './MetricHistoryService';

// State management
import {
    isManagerInitialized, setManagerInitialized,
    isServicesStarted, setServicesStarted
} from './integrationState';

// Re-export CRUD reaction hooks (preserves existing import surface)
export { onIntegrationCreated, onIntegrationUpdated, onIntegrationDeleted } from './integrationReactions';

// Re-export cleanup (preserves existing import surface)
export { scrubIntegrationFromConfigs } from './integrationCleanup';

// Re-export diagnostics (preserves existing import surface)
export { getManagerStatus, getDiagnostics } from './integrationState';

/**
 * Initialize the IntegrationManager.
 * Called once at server startup.
 * Services will only start if users exist.
 */
export async function initializeIntegrationManager(): Promise<void> {
    if (isManagerInitialized()) {
        logger.warn('[IntegrationManager] Already initialized');
        return;
    }

    setManagerInitialized(true);

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
    if (isServicesStarted()) {
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

    // Initialize metric history service (reads DB config, starts recording if enabled)
    try {
        await metricHistoryService.initialize();
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to start metric history: error="${(error as Error).message}"`);
    }

    // Start periodic library sync job (every 6 hours)
    try {
        startLibrarySyncJob();
    } catch (error) {
        logger.error(`[IntegrationManager] Failed to start library sync job: error="${(error as Error).message}"`);
    }

    setServicesStarted(true);
    logger.info('[IntegrationManager] All services started');
}

/**
 * Shutdown all background services.
 * Called on server shutdown (SIGTERM/SIGINT).
 */
export function shutdownIntegrationManager(): void {
    if (!isServicesStarted()) {
        return;
    }

    logger.info('[IntegrationManager] Shutting down services');

    servicePoller.stop();
    shutdownBackupScheduler();
    stopCleanupJob();
    stopLibrarySyncJob();

    setServicesStarted(false);
    setManagerInitialized(false);

    logger.info('[IntegrationManager] Shutdown complete');
}

/**
 * Called when first user is created.
 * Triggers service initialization if deferred.
 */
export async function onFirstUserCreated(): Promise<void> {
    if (isServicesStarted()) {
        logger.debug('[IntegrationManager] Services already running');
        return;
    }

    // startAllServices() will log the start message
    await startAllServices();
}
