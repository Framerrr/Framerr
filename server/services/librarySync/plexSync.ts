/**
 * Plex Library Sync
 * 
 * Fetches and indexes all media from a Plex server into the local database.
 * Uses paginated API requests to handle large libraries without timeouts.
 */

import { getDb } from '../../database/db';
import { PlexAdapter } from '../../integrations/plex/adapter';
import { invalidateSystemSettings } from '../../utils/invalidateUserSettings';
import { broadcast } from '../sse/transport';
import {
    LIBRARY_SYNC_PAGE_SIZE,
    LIBRARY_SYNC_TIMEOUT,
    activeSyncs,
    toPluginInstance,
    updateSyncStatus,
    retryWithBackoff,
    logger,
    IntegrationInstance,
} from './shared';
import { PlexLibrarySection, PlexMediaItem } from './types';
import { indexPlexItem } from './indexing';

// ============================================================================
// PLEX FULL SYNC
// ============================================================================

/**
 * Run the actual Plex sync.
 * Fetches all movie/show libraries, counts items, then indexes with pagination.
 */
export async function runPlexSync(
    integrationId: string,
    instance: IntegrationInstance,
    syncState: { cancelled: boolean }
): Promise<void> {
    const adapter = new PlexAdapter();
    const startTime = Date.now();
    const failedSections: { name: string; error: string }[] = [];

    try {
        logger.info(`[LibrarySync] Starting full sync: integrationId=${integrationId}`);

        // Fetch library sections
        const sectionsResult = await adapter.execute(toPluginInstance(instance), {
            method: 'GET',
            path: '/library/sections'
        });

        if (!sectionsResult.success || !sectionsResult.data) {
            throw new Error(`Failed to fetch library sections: ${sectionsResult.error}`);
        }

        const mediaContainer = (sectionsResult.data as { MediaContainer?: { Directory?: PlexLibrarySection[] } }).MediaContainer;
        const sections = mediaContainer?.Directory || [];

        // Filter to movie/show sections only
        const mediaSections = sections.filter(s => ['movie', 'show'].includes(s.type));

        if (mediaSections.length === 0) {
            logger.warn(`[LibrarySync] No movie/show libraries found: integrationId=${integrationId}`);
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                totalItems: 0,
                indexedItems: 0
            });
            activeSyncs.delete(integrationId);
            return;
        }

        // Count total items first (per section)
        let totalItems = 0;
        const sectionCounts: Map<string, number> = new Map();

        for (let si = 0; si < mediaSections.length; si++) {
            const section = mediaSections[si];

            // Broadcast fetch phase progress
            broadcast('library_sync_progress', {
                integrationId,
                indexed: 0,
                total: 0,
                percent: 0,
                phase: 'fetching',
                statusMessage: `Fetching library '${section.title}'...`
            });

            const countResult = await retryWithBackoff(adapter, toPluginInstance(instance), {
                method: 'GET',
                path: `/library/sections/${section.key}/all`,
                query: { 'X-Plex-Container-Start': '0', 'X-Plex-Container-Size': '0' }
            });

            if (countResult.success && countResult.data) {
                const container = (countResult.data as { MediaContainer?: { totalSize?: number } }).MediaContainer;
                const sectionCount = container?.totalSize || 0;
                sectionCounts.set(section.key, sectionCount);
                totalItems += sectionCount;

                // Broadcast discovered items count
                if (sectionCount > 0) {
                    broadcast('library_sync_progress', {
                        integrationId,
                        indexed: 0,
                        total: totalItems,
                        percent: 0,
                        phase: 'fetching',
                        statusMessage: `Found ${totalItems.toLocaleString()} items (${si + 1}/${mediaSections.length} libraries)`
                    });
                }
            } else {
                logger.warn(`[LibrarySync] Section "${section.title}" count failed: integrationId=${integrationId}, error="${countResult.error}"`);
                failedSections.push({ name: section.title, error: countResult.error || 'unknown error' });
            }
        }

        updateSyncStatus(integrationId, { totalItems, indexedItems: 0 });

        // Broadcast transition to indexing phase
        broadcast('library_sync_progress', {
            integrationId,
            indexed: 0,
            total: totalItems,
            percent: 0,
            phase: 'indexing',
            statusMessage: `Syncing ${totalItems.toLocaleString()} items...`
        });

        // Clear existing items for this integration
        const db = getDb();
        db.prepare(`DELETE FROM media_library WHERE integration_instance_id = ?`).run(integrationId);

        // Fetch and index items from each section
        let indexedItems = 0;
        let lastBroadcastTime = 0;
        const MIN_BROADCAST_MS = 150; // ~6 updates/sec max

        for (const section of mediaSections) {
            if (syncState.cancelled) {
                logger.info(`[LibrarySync] Sync cancelled: integrationId=${integrationId}`);
                break;
            }

            // Skip section if count failed earlier
            if (!sectionCounts.has(section.key)) continue;

            // Paginated fetch — use per-section count as loop terminator
            const sectionTotal = sectionCounts.get(section.key) || 0;
            let containerStart = 0;
            let pageNum = 0;

            do {
                if (syncState.cancelled) break;

                const result = await retryWithBackoff(adapter, toPluginInstance(instance), {
                    method: 'GET',
                    path: `/library/sections/${section.key}/all`,
                    query: {
                        includeGuids: '1',
                        'X-Plex-Container-Start': String(containerStart),
                        'X-Plex-Container-Size': String(LIBRARY_SYNC_PAGE_SIZE)
                    },
                    timeout: LIBRARY_SYNC_TIMEOUT
                });

                if (!result.success || !result.data) {
                    if (pageNum === 0) {
                        logger.warn(`[LibrarySync] Section "${section.title}" failed after retries: integrationId=${integrationId}, error="${result.error}"`);
                        if (!failedSections.some(s => s.name === section.title)) {
                            failedSections.push({ name: section.title, error: result.error || 'unknown error' });
                        }
                    } else {
                        logger.warn(`[LibrarySync] Section "${section.title}" partial (page ${pageNum} failed): integrationId=${integrationId}`);
                    }
                    break;
                }

                const container = (result.data as { MediaContainer?: { Metadata?: PlexMediaItem[]; totalSize?: number } }).MediaContainer;
                const items = container?.Metadata || [];

                if (items.length === 0) break; // No more items

                // Index each item from this page
                for (const item of items) {
                    if (syncState.cancelled) break;

                    await indexPlexItem(integrationId, instance, section.key, section.type, item);
                    indexedItems++;

                    // Broadcast progress (time-based: ~6 updates/sec, always broadcast first item)
                    const now = Date.now();
                    if (indexedItems === 1 || now - lastBroadcastTime >= MIN_BROADCAST_MS) {
                        updateSyncStatus(integrationId, { indexedItems });
                        broadcast('library_sync_progress', {
                            integrationId,
                            indexed: indexedItems,
                            total: totalItems,
                            percent: Math.round((indexedItems / totalItems) * 100),
                            phase: 'indexing'
                        });
                        lastBroadcastTime = now;
                    }
                }

                containerStart += items.length;
                pageNum++;

                if (pageNum > 1) {
                    logger.debug(`[LibrarySync] Section ${section.title}: page ${pageNum}, fetched=${containerStart}/${sectionTotal}`);
                }
            } while (containerStart < sectionTotal && !syncState.cancelled);
        }

        // Final status update
        if (syncState.cancelled) {
            updateSyncStatus(integrationId, { syncStatus: 'idle', indexedItems, errorMessage: null });
            invalidateSystemSettings('media-search-sync');
        } else if (failedSections.length > 0) {
            const warning = `Partial sync: ${failedSections.map(s => `"${s.name}" (${s.error})`).join(', ')} failed`;
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems,
                errorMessage: warning
            });
            broadcast('library_sync_complete', { integrationId });
            invalidateSystemSettings('media-search-sync');
            logger.warn(`[LibrarySync] Plex sync completed with errors: integrationId=${integrationId}, failed=[${failedSections.map(s => s.name).join(', ')}]`);
        } else {
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems,
                errorMessage: null
            });
            broadcast('library_sync_complete', { integrationId });
            invalidateSystemSettings('media-search-sync');
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info(`[LibrarySync] Sync complete: integrationId=${integrationId}, items=${indexedItems}, elapsed=${elapsed}s`);

    } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[LibrarySync] Sync failed: integrationId=${integrationId}, error="${errorMsg}"`);

        updateSyncStatus(integrationId, {
            syncStatus: 'error',
            errorMessage: errorMsg
        });
        invalidateSystemSettings('media-search-sync');
    } finally {
        activeSyncs.delete(integrationId);
    }
}
