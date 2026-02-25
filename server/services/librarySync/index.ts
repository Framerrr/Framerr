/**
 * Library Sync Service
 * 
 * Fetches and indexes media from Plex/Jellyfin/Emby into local database
 * for fast full-text search in the Media Search widget.
 * 
 * Storage: media_library table + library_sync_status tracking
 * 
 * Architecture:
 *   types.ts        - All interfaces
 *   shared.ts       - Constants, state, helpers
 *   indexing.ts     - Item-level DB indexing
 *   plexSync.ts     - Plex full sync
 *   jellyfinSync.ts - Jellyfin full sync
 *   embySync.ts     - Emby full sync
 *   surgicalSync.ts - Targeted TMDB-based refresh
 *   index.ts        - Public API (this file)
 */

import { getDb } from '../../database/db';
import { cacheLibraryImage, deleteAllLibraryImages } from '../libraryImageCache';
import {
    activeSyncs,
    updateSyncStatus,
    getMediaServerIntegrationsWithSync,
    getInstanceById,
    logger,
} from './shared';
import { SyncStatus } from './types';
import { runPlexSync } from './plexSync';
import { runJellyfinSync } from './jellyfinSync';
import { runEmbySync } from './embySync';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start a full library sync for an integration.
 * Returns immediately — sync runs in background.
 */
export async function startFullSync(integrationId: string): Promise<{ success: boolean; error?: string }> {
    // Check if already syncing
    const existingSync = activeSyncs.get(integrationId);
    if (existingSync && !existingSync.cancelled) {
        return { success: false, error: 'Sync already in progress' };
    }

    // Get integration instance
    const instance = getInstanceById(integrationId);
    if (!instance) {
        return { success: false, error: 'Integration not found' };
    }

    // Validate supported integration types
    const supportedTypes = ['plex', 'jellyfin', 'emby'];
    if (!supportedTypes.includes(instance.type)) {
        return { success: false, error: `Unsupported integration type: ${instance.type}` };
    }

    // Initialize sync state
    const syncState = { cancelled: false };
    activeSyncs.set(integrationId, syncState);

    // Update status to syncing
    updateSyncStatus(integrationId, {
        syncStatus: 'syncing',
        lastSyncStarted: new Date().toISOString(),
        errorMessage: null
    });

    // Run sync in background based on integration type
    const syncPromise = instance.type === 'plex'
        ? runPlexSync(integrationId, instance, syncState)
        : instance.type === 'jellyfin'
            ? runJellyfinSync(integrationId, instance, syncState)
            : runEmbySync(integrationId, instance, syncState);

    syncPromise.catch(error => {
        logger.error(`[LibrarySync] Background sync failed: integrationId=${integrationId}, error="${error.message}"`);
    });

    return { success: true };
}

/**
 * Get current sync status for an integration.
 */
export function getSyncStatus(integrationId: string): SyncStatus | null {
    const db = getDb();
    const row = db.prepare(`
        SELECT 
            integration_instance_id as integrationInstanceId,
            total_items as totalItems,
            indexed_items as indexedItems,
            last_sync_started as lastSyncStarted,
            last_sync_completed as lastSyncCompleted,
            sync_status as syncStatus,
            error_message as errorMessage
        FROM library_sync_status
        WHERE integration_instance_id = ?
    `).get(integrationId) as SyncStatus | undefined;

    return row || null;
}

/**
 * Cancel an active sync.
 */
export function cancelSync(integrationId: string): boolean {
    const syncState = activeSyncs.get(integrationId);
    if (syncState) {
        syncState.cancelled = true;
        updateSyncStatus(integrationId, { syncStatus: 'idle' });
        return true;
    }
    return false;
}

/**
 * Delete all sync data for an integration (called on integration delete).
 */
export function deleteLibrarySyncData(integrationId: string): void {
    const db = getDb();

    // Cancel any active sync
    cancelSync(integrationId);

    // Delete from media_library
    const deleteResult = db.prepare(`DELETE FROM media_library WHERE integration_instance_id = ?`).run(integrationId);

    // Delete from library_sync_status
    db.prepare(`DELETE FROM library_sync_status WHERE integration_instance_id = ?`).run(integrationId);

    // Delete cached images
    const imageResult = deleteAllLibraryImages(integrationId);

    logger.info(`[LibrarySync] Purged data for integration: integrationId=${integrationId}, deletedItems=${deleteResult.changes}, deletedImages=${imageResult.deleted}`);
}

// ============================================================================
// PERIODIC SYNC JOB
// ============================================================================

const LIBRARY_SYNC_JOB_ID = 'library-sync';

/**
 * Reset any sync statuses stuck as 'syncing' from a previous server crash/restart.
 * Called once on startup — if no active sync exists in memory, the DB status is stale.
 */
function resetStaleSyncStatuses(): void {
    const db = getDb();
    const result = db.prepare(`
        UPDATE library_sync_status
        SET sync_status = 'error', error_message = 'Sync interrupted by server restart'
        WHERE sync_status = 'syncing'
    `).run();

    if (result.changes > 0) {
        logger.info(`[LibrarySync] Reset ${result.changes} stale sync status(es) from previous session`);
    }
}

/**
 * Start the periodic library sync cron job (every 6 hours).
 * Runs startFullSync for every media server with library sync enabled.
 */
export function startLibrarySyncJob(): void {
    // Clean up stale statuses from previous server session
    resetStaleSyncStatuses();

    const { registerJob } = require('../jobScheduler');

    registerJob({
        id: LIBRARY_SYNC_JOB_ID,
        name: 'Library Sync',
        cronExpression: '0 */6 * * *',
        description: 'Every 6 hours',
        execute: async () => {
            const mediaServers = getMediaServerIntegrationsWithSync();
            if (mediaServers.length === 0) {
                logger.debug('[LibrarySync] Periodic sync: no media servers with sync enabled');
                return;
            }

            logger.info(`[LibrarySync] Periodic sync starting: ${mediaServers.length} server(s)`);

            // Run syncs sequentially to avoid overloading
            for (const server of mediaServers) {
                try {
                    await startFullSync(server.id);
                } catch (error) {
                    logger.error(`[LibrarySync] Periodic sync failed for ${server.type}:${server.id}: error="${(error as Error).message}"`);
                }
            }
        },
        runOnStart: false, // IntegrationManager already syncs on startup
    });
}

/**
 * Stop the periodic library sync cron job.
 */
export function stopLibrarySyncJob(): void {
    const { unregisterJob } = require('../jobScheduler');
    unregisterJob(LIBRARY_SYNC_JOB_ID);
}

// ============================================================================
// RE-EXPORTS (for backward compatibility)
// ============================================================================

export { isTmdbIdInLibrary, indexRecentlyAddedForTmdbIds } from './surgicalSync';
export { getMediaServerIntegrationsWithSync } from './shared';
export type { SyncStatus } from './types';
