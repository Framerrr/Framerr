/**
 * Framerr - Server Entry Point (Startup Orchestrator)
 * 
 * Thin entry point that imports the configured Express app from ./app
 * and handles server startup, lifecycle, and graceful shutdown.
 * 
 * Express composition (middleware, routes, error handlers) lives in app.ts.
 */

// Load environment variables from .env file (development only)
// MUST be first import — env vars must be in process.env before app.ts loads
import 'dotenv/config';

import { createServer } from 'http';
import { initializeIntegrationManager, shutdownIntegrationManager } from './services/IntegrationManager';
import logger from './utils/logger';
import { isInitialized, getDb } from './database/db';
import { checkMigrationStatus, runMigrations, MigrationStatus, MigrationResult } from './database/migrator';
import { getSystemConfig } from './db/systemConfig';
import { app, version } from './app';

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Start server with proper async initialization
(async () => {
    try {
        // Print banner first - before any other output
        logger.startup('Framerr', { version, env: NODE_ENV });

        // Validate encryption setup FIRST in production
        // This ensures we fail early with clear instructions if SECRET_ENCRYPTION_KEY is missing
        if (NODE_ENV === 'production') {
            const { encrypt } = await import('./utils/encryption');
            // Trigger encryption key validation by calling encrypt with test data
            // This will exit with clear instructions if key is not set
            try {
                encrypt('startup-validation-test');
            } catch {
                // encrypt() calls process.exit(1) if key is missing, so we won't reach here
                // But if we do, something unexpected happened
                logger.error('Encryption validation failed unexpectedly');
                process.exit(1);
            }
            logger.info('Encryption key validated');
        }

        // Initialize database schema if this is a fresh database
        if (!isInitialized()) {
            // Fresh databases start at v0 and run all migrations
            const result = runMigrations(getDb()) as MigrationResult;
            if (!result.success) {
                logger.error(`[Startup] Migration failed: error="${result.error}"`);
                process.exit(1);
            }
            logger.info(`Database ready (v${result.migratedTo}, ${result.migratedTo} migrations applied)`);
        } else {
            // Check if migrations are needed
            const status = checkMigrationStatus(getDb()) as MigrationStatus;

            if (status.isDowngrade) {
                // Database is newer than app expects - refuse to start
                logger.error(`Database schema (v${status.currentVersion}) is newer than this version of Framerr expects (v${status.expectedVersion}).`);
                logger.error('Please upgrade Framerr or restore from a backup.');
                process.exit(1);
            }

            if (status.needsMigration) {
                const result = runMigrations(getDb()) as MigrationResult;

                if (!result.success) {
                    logger.error(`[Startup] Migration failed: error="${result.error}"`);
                    process.exit(1);
                }

                const count = (result.migratedTo || 0) - (result.migratedFrom || 0);
                logger.info(`Database migrated (v${result.migratedFrom} → v${result.migratedTo}, ${count} migrations)`);
            } else {
                logger.info(`Database ready (v${status.currentVersion})`);
            }
        }

        // Log if no users exist (setup wizard will be triggered)
        const { listUsers } = await import('./db/users');
        const users = await listUsers();
        if (users.length === 0) {
            logger.debug('[Startup] No users found, initializing setup wizard');
        }

        // Load system config BEFORE starting server
        const systemConfig = await getSystemConfig();
        app.set('systemConfig', systemConfig);
        logger.info('System config loaded');

        // Load log level from systemConfig if set
        if (systemConfig.debug?.logLevel) {
            logger.setLevel(systemConfig.debug.logLevel as string);
        }

        // Seed default integrations on fresh install (idempotent)
        const { seedDefaultIntegrations } = await import('./services/seedDefaultIntegrations');
        seedDefaultIntegrations();


        // Now start server with config loaded
        const portNum = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

        // Create HTTP server for WebSocket attachment
        const httpServer = createServer(app);

        // Initialize IntegrationManager (starts services if users exist)
        await initializeIntegrationManager();

        // Auto-match Framerr users to Overseerr accounts by Plex username (fire-and-forget)
        import('./services/overseerrAutoMatch').then(m => m.tryAutoMatchAllUsers()).catch(() => { });

        // Register Overseerr per-user SSE topic filter (for seeAllRequests toggle)
        import('./integrations/overseerr/topicFilter').then(m => m.registerOverseerrTopicFilters()).catch(() => { });

        httpServer.listen(portNum, () => {
            logger.info(`[Server] Listening on port ${portNum}`);
            logger.info('[Server] Ready ✓');
        });
    } catch (error) {
        logger.error(`[Startup] Failed to start server: error="${error instanceof Error ? error.message : String(error)}"`);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    const { metricHistoryService } = await import('./services/MetricHistoryService');
    await metricHistoryService.shutdown();
    shutdownIntegrationManager();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    const { metricHistoryService } = await import('./services/MetricHistoryService');
    await metricHistoryService.shutdown();
    shutdownIntegrationManager();
    process.exit(0);
});

export default app;
