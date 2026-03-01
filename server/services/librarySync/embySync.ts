/**
 * Emby Library Sync
 * 
 * Fetches and indexes all media from an Emby server into the local database.
 * Nearly identical to Jellyfin (shared API heritage), different image URL pattern.
 * Uses paginated API requests to handle large libraries without timeouts.
 */

import { getDb } from '../../database/db';
import { EmbyAdapter } from '../../integrations/emby/adapter';
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
import { EmbyMediaItem, JellyfinView } from './types';
import { indexJellyfinEmbyItem } from './indexing';

// ============================================================================
// EMBY FULL SYNC
// ============================================================================

/**
 * Run the actual Emby sync.
 * Fetches all views, collects Movie/Series items, then indexes.
 */
export async function runEmbySync(
    integrationId: string,
    instance: IntegrationInstance,
    syncState: { cancelled: boolean }
): Promise<void> {
    const adapter = new EmbyAdapter();
    const startTime = Date.now();
    const userId = instance.config.userId as string;
    const failedViews: { name: string; error: string }[] = [];

    try {
        logger.info(`[LibrarySync] Starting Emby sync: integrationId=${integrationId}`);

        // Fetch library views (sections)
        const viewsResult = await adapter.execute(toPluginInstance(instance), {
            method: 'GET',
            path: `/Users/${userId}/Views`
        });

        if (!viewsResult.success || !viewsResult.data) {
            throw new Error(`Failed to fetch library views: ${viewsResult.error}`);
        }

        const allViews = (viewsResult.data as { Items?: JellyfinView[] }).Items || [];

        // Log all views for diagnostics
        logger.info(`[LibrarySync] Emby views found: count=${allViews.length}, views=[${allViews.map(v => `"${v.Name}" (${v.CollectionType || 'none'})`).join(', ')}]`);

        if (allViews.length === 0) {
            logger.warn(`[LibrarySync] No libraries found: integrationId=${integrationId}`);
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                totalItems: 0,
                indexedItems: 0
            });
            activeSyncs.delete(integrationId);
            return;
        }

        // Fetch items from ALL views and collect only Movie/Series items
        const allItems: { item: EmbyMediaItem; viewId: string }[] = [];
        for (let vi = 0; vi < allViews.length; vi++) {
            const view = allViews[vi];

            // Broadcast fetch phase progress
            broadcast('library_sync_progress', {
                integrationId,
                indexed: 0,
                total: 0,
                percent: 0,
                phase: 'fetching',
                statusMessage: `Fetching library '${view.Name}'...`
            });

            // Paginated fetch
            let startIndex = 0;
            let totalForView = 0;
            let pageNum = 0;
            let viewKept = 0;

            do {
                if (syncState.cancelled) break;

                const result = await retryWithBackoff(adapter, toPluginInstance(instance), {
                    method: 'GET',
                    path: `/Users/${userId}/Items`,
                    query: {
                        parentId: view.Id,
                        recursive: 'true',
                        includeItemTypes: 'Movie,Series',
                        fields: 'Overview,Genres,Studios,People,ProviderIds',
                        startIndex: String(startIndex),
                        limit: String(LIBRARY_SYNC_PAGE_SIZE),
                        enableTotalRecordCount: 'true'
                    },
                    timeout: LIBRARY_SYNC_TIMEOUT
                });

                if (!result.success || !result.data) {
                    if (pageNum === 0) {
                        logger.warn(`[LibrarySync] View "${view.Name}" failed after retries: integrationId=${integrationId}, error="${result.error}"`);
                        failedViews.push({ name: view.Name, error: result.error || 'unknown error' });
                    } else {
                        logger.warn(`[LibrarySync] View "${view.Name}" partial (page ${pageNum} failed): integrationId=${integrationId}`);
                    }
                    break;
                }

                const data = result.data as { Items?: EmbyMediaItem[]; TotalRecordCount?: number };
                const items = data.Items || [];

                // Capture total on first page
                if (pageNum === 0) {
                    totalForView = data.TotalRecordCount ?? items.length;
                }

                // Keep only Movie or Series (safety net)
                for (const item of items) {
                    if (['Movie', 'Series'].includes(item.Type)) {
                        allItems.push({ item, viewId: view.Id });
                        viewKept++;
                    }
                }

                startIndex += items.length;
                pageNum++;

                if (pageNum > 1) {
                    logger.debug(`[LibrarySync] View ${view.Name}: page ${pageNum}, fetched=${startIndex}/${totalForView}`);
                }
            } while (startIndex < totalForView && startIndex > 0);

            logger.info(`[LibrarySync] View "${view.Name}" (${view.CollectionType || 'none'}): total=${totalForView}, kept=${viewKept} (Movie/Series), pages=${pageNum}`);

            // Broadcast discovered items count
            if (viewKept > 0) {
                broadcast('library_sync_progress', {
                    integrationId,
                    indexed: 0,
                    total: allItems.length,
                    percent: 0,
                    phase: 'fetching',
                    statusMessage: `Found ${allItems.length.toLocaleString()} items (${vi + 1}/${allViews.length} libraries)`
                });
            }
        }

        // Total is the actual filtered count
        const totalItems = allItems.length;
        logger.info(`[LibrarySync] Emby sync collected: totalItems=${totalItems} (across ${allViews.length} views)`);
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

        // Index all collected items
        let indexedItems = 0;
        let lastBroadcastTime = 0;
        const MIN_BROADCAST_MS = 150; // ~6 updates/sec max

        for (const { item, viewId } of allItems) {
            if (syncState.cancelled) {
                logger.info(`[LibrarySync] Sync cancelled: integrationId=${integrationId}`);
                break;
            }

            await indexJellyfinEmbyItem(integrationId, instance, viewId, item, 'emby');
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

        // Final status update
        if (syncState.cancelled) {
            updateSyncStatus(integrationId, { syncStatus: 'idle', indexedItems, errorMessage: null });
            invalidateSystemSettings('media-search-sync');
        } else if (failedViews.length > 0) {
            const warning = `Partial sync: ${failedViews.map(v => `"${v.name}" (${v.error})`).join(', ')} failed`;
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems,
                errorMessage: warning
            });
            broadcast('library_sync_complete', { integrationId });
            invalidateSystemSettings('media-search-sync');
            logger.warn(`[LibrarySync] Emby sync completed with errors: integrationId=${integrationId}, failed=[${failedViews.map(v => v.name).join(', ')}]`);
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
        logger.info(`[LibrarySync] Emby sync complete: integrationId=${integrationId}, items=${indexedItems}, elapsed=${elapsed}s`);

    } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[LibrarySync] Emby sync failed: integrationId=${integrationId}, error="${errorMsg}"`);
        updateSyncStatus(integrationId, { syncStatus: 'error', errorMessage: errorMsg });
        invalidateSystemSettings('media-search-sync');
    } finally {
        activeSyncs.delete(integrationId);
    }
}
