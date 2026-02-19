/**
 * Library Sync Service
 * 
 * Fetches and indexes media from Plex/Jellyfin/Emby into local database
 * for fast full-text search in the Media Search widget.
 * 
 * Storage: media_library table + library_sync_status tracking
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';
import { cacheLibraryImage, deleteAllLibraryImages } from './libraryImageCache';
import { getInstanceById, getAllInstances, IntegrationInstance } from '../db/integrationInstances';
import { PlexAdapter } from '../integrations/plex/adapter';
import { JellyfinAdapter } from '../integrations/jellyfin/adapter';
import { EmbyAdapter } from '../integrations/emby/adapter';
import { PluginInstance } from '../integrations/types';
import { translateHostUrl } from '../utils/urlHelper';
import { broadcast } from './sse/transport';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';

// ============================================================================
// TYPES
// ============================================================================

interface SyncStatus {
    integrationInstanceId: string;
    totalItems: number;
    indexedItems: number;
    lastSyncStarted: string | null;
    lastSyncCompleted: string | null;
    syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
    errorMessage: string | null;
}

interface PlexLibrarySection {
    key: string;
    title: string;
    type: string; // 'movie', 'show', 'artist', 'photo'
}

interface PlexMediaItem {
    ratingKey: string;
    title: string;
    originalTitle?: string;
    titleSort?: string;
    year?: number;
    thumb?: string;
    art?: string;
    summary?: string;
    Genre?: Array<{ tag: string }>;
    studio?: string;
    Director?: Array<{ tag: string }>;
    Role?: Array<{ tag: string }>; // Actors
    rating?: number;
    contentRating?: string;
    duration?: number;
    addedAt?: number;
    updatedAt?: number;
    Guid?: Array<{ id: string }>; // External IDs (tmdb://, imdb://)
}

// Jellyfin/Emby use identical structure (shared API heritage)
interface JellyfinMediaItem {
    Id: string;
    Name: string;
    OriginalTitle?: string;
    SortName?: string;
    ProductionYear?: number;
    ImageTags?: { Primary?: string };
    BackdropImageTags?: string[];
    Overview?: string;
    Genres?: string[];
    Studios?: Array<{ Name: string }>;
    People?: Array<{ Name: string; Type: string }>; // Type: 'Director' | 'Actor'
    CommunityRating?: number;
    OfficialRating?: string;
    RunTimeTicks?: number;
    DateCreated?: string;
    ProviderIds?: { Tmdb?: string; Imdb?: string };
    Type: string; // 'Movie' | 'Series'
}
type EmbyMediaItem = JellyfinMediaItem;

interface JellyfinView {
    Id: string;
    Name: string;
    CollectionType?: string; // 'movies', 'tvshows', 'music', etc.
}

// Track active syncs for cancellation
const activeSyncs: Map<string, { cancelled: boolean }> = new Map();

/**
 * Convert IntegrationInstance to PluginInstance format
 */
function toPluginInstance(instance: IntegrationInstance): PluginInstance {
    return {
        id: instance.id,
        type: instance.type,
        name: instance.displayName,
        config: instance.config
    };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start a full library sync for an integration
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
 * Get current sync status for an integration
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
 * Cancel an active sync
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
 * Delete all sync data for an integration (called on integration delete)
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
// INTERNAL HELPERS
// ============================================================================

/**
 * Update sync status in database
 */
function updateSyncStatus(integrationId: string, updates: Partial<SyncStatus>): void {
    const db = getDb();

    // Ensure row exists
    db.prepare(`
        INSERT OR IGNORE INTO library_sync_status (integration_instance_id)
        VALUES (?)
    `).run(integrationId);

    // Build dynamic update
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.totalItems !== undefined) {
        setClauses.push('total_items = ?');
        values.push(updates.totalItems);
    }
    if (updates.indexedItems !== undefined) {
        setClauses.push('indexed_items = ?');
        values.push(updates.indexedItems);
    }
    if (updates.lastSyncStarted !== undefined) {
        setClauses.push('last_sync_started = ?');
        values.push(updates.lastSyncStarted);
    }
    if (updates.lastSyncCompleted !== undefined) {
        setClauses.push('last_sync_completed = ?');
        values.push(updates.lastSyncCompleted);
    }
    if (updates.syncStatus !== undefined) {
        setClauses.push('sync_status = ?');
        values.push(updates.syncStatus);
    }
    if (updates.errorMessage !== undefined) {
        setClauses.push('error_message = ?');
        values.push(updates.errorMessage);
    }

    if (setClauses.length > 0) {
        values.push(integrationId);
        db.prepare(`
            UPDATE library_sync_status
            SET ${setClauses.join(', ')}
            WHERE integration_instance_id = ?
        `).run(...values);
    }
}

/**
 * Run the actual Plex sync
 */
async function runPlexSync(
    integrationId: string,
    instance: IntegrationInstance,
    syncState: { cancelled: boolean }
): Promise<void> {
    const adapter = new PlexAdapter();
    const startTime = Date.now();

    try {
        logger.info(`[LibrarySync] Starting full sync: integrationId=${integrationId}`);

        // Fetch library sections
        const sectionsResult = await adapter.execute(toPluginInstance(instance), {
            method: 'GET',
            path: '/library/sections'
        });

        if (!sectionsResult.success || !sectionsResult.data) {
            throw new Error('Failed to fetch library sections');
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

        // Count total items first
        let totalItems = 0;
        for (const section of mediaSections) {
            const countResult = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/library/sections/${section.key}/all`,
                query: { 'X-Plex-Container-Start': '0', 'X-Plex-Container-Size': '0' }
            });

            if (countResult.success && countResult.data) {
                const container = (countResult.data as { MediaContainer?: { totalSize?: number } }).MediaContainer;
                totalItems += container?.totalSize || 0;
            }
        }

        updateSyncStatus(integrationId, { totalItems, indexedItems: 0 });

        // Clear existing items for this integration
        const db = getDb();
        db.prepare(`DELETE FROM media_library WHERE integration_instance_id = ?`).run(integrationId);

        // Fetch and index items from each section
        let indexedItems = 0;
        let lastBroadcastTime = 0;
        const BROADCAST_INTERVAL = 25; // Broadcast every 25 items
        const MIN_BROADCAST_MS = 100;  // Cap: max 10 broadcasts/second for large libraries

        for (const section of mediaSections) {
            if (syncState.cancelled) {
                logger.info(`[LibrarySync] Sync cancelled: integrationId=${integrationId}`);
                break;
            }

            const result = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/library/sections/${section.key}/all`,
                query: { includeGuids: '1' }
            });

            if (!result.success || !result.data) {
                logger.warn(`[LibrarySync] Failed to fetch section ${section.title}: integrationId=${integrationId}`);
                continue;
            }

            const container = (result.data as { MediaContainer?: { Metadata?: PlexMediaItem[] } }).MediaContainer;
            const items = container?.Metadata || [];

            // Index each item
            for (const item of items) {
                if (syncState.cancelled) break;

                await indexPlexItem(integrationId, instance, section.key, section.type, item);
                indexedItems++;

                // Broadcast progress every 25 items (with rate limiting for large libraries)
                if (indexedItems % BROADCAST_INTERVAL === 0) {
                    const now = Date.now();
                    if (now - lastBroadcastTime >= MIN_BROADCAST_MS) {
                        updateSyncStatus(integrationId, { indexedItems });
                        broadcast('library_sync_progress', {
                            integrationId,
                            indexed: indexedItems,
                            total: totalItems,
                            percent: Math.round((indexedItems / totalItems) * 100)
                        });
                        lastBroadcastTime = now;
                    }
                }
            }
        }

        // Final status update
        if (syncState.cancelled) {
            updateSyncStatus(integrationId, { syncStatus: 'idle', indexedItems });
            // Notify widgets to refetch sync status
            invalidateSystemSettings('media-search-sync');
        } else {
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems
            });

            // Broadcast SSE events
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
        // Notify widgets of error state
        invalidateSystemSettings('media-search-sync');
    } finally {
        activeSyncs.delete(integrationId);
    }
}

/**
 * Index a single Plex media item
 */
async function indexPlexItem(
    integrationId: string,
    instance: IntegrationInstance,
    libraryKey: string,
    libraryType: string,
    item: PlexMediaItem
): Promise<void> {
    const db = getDb();

    // Parse external IDs (tmdb, imdb)
    let tmdbId: number | null = null;
    let imdbId: string | null = null;

    if (item.Guid) {
        for (const guid of item.Guid) {
            if (guid.id.startsWith('tmdb://')) {
                tmdbId = parseInt(guid.id.replace('tmdb://', ''), 10);
            } else if (guid.id.startsWith('imdb://')) {
                imdbId = guid.id.replace('imdb://', '');
            }
        }
    }

    // Extract arrays as JSON strings
    const genres = item.Genre ? JSON.stringify(item.Genre.map(g => g.tag)) : null;
    const director = item.Director ? item.Director.map(d => d.tag).join(', ') : null;
    const actors = item.Role ? JSON.stringify(item.Role.map(r => r.tag).slice(0, 10)) : null; // Limit to 10

    // Cache thumbnail (non-blocking)
    // Use Plex's transcode endpoint to get small thumbnails (~6KB) instead of full-res (~100-2000KB)
    if (item.thumb) {
        const baseUrl = translateHostUrl(instance.config.url as string);
        const encodedThumb = encodeURIComponent(item.thumb);
        // Request 120x180 thumbnail via Plex's photo transcoder
        const thumbUrl = `${baseUrl}/photo/:/transcode?width=120&height=180&minSize=1&upscale=1&url=${encodedThumb}&X-Plex-Token=${instance.config.token}`;
        cacheLibraryImage(integrationId, item.ratingKey, thumbUrl).catch((err) => {
            // Log first few failures to help debug
            logger.debug(`[LibrarySync] Image cache failed: itemKey=${item.ratingKey}, error="${err.message}"`);
        });
    }

    // Upsert into media_library
    db.prepare(`
        INSERT INTO media_library (
            integration_instance_id, media_type, library_key, item_key,
            title, original_title, sort_title, year, thumb, art, summary,
            genres, studio, director, actors, rating, content_rating,
            duration, added_at, updated_at, tmdb_id, imdb_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(integration_instance_id, item_key) DO UPDATE SET
            title = excluded.title,
            original_title = excluded.original_title,
            sort_title = excluded.sort_title,
            year = excluded.year,
            thumb = excluded.thumb,
            summary = excluded.summary,
            genres = excluded.genres,
            director = excluded.director,
            actors = excluded.actors,
            rating = excluded.rating,
            updated_at = excluded.updated_at,
            tmdb_id = excluded.tmdb_id,
            imdb_id = excluded.imdb_id,
            indexed_at = CURRENT_TIMESTAMP
    `).run(
        integrationId,
        libraryType === 'show' ? 'show' : 'movie',
        libraryKey,
        item.ratingKey,
        item.title,
        item.originalTitle || null,
        item.titleSort || null,
        item.year || null,
        item.thumb || null,
        item.art || null,
        item.summary || null,
        genres,
        item.studio || null,
        director,
        actors,
        item.rating || null,
        item.contentRating || null,
        item.duration || null,
        item.addedAt || null,
        item.updatedAt || null,
        tmdbId,
        imdbId
    );
}

// ============================================================================
// JELLYFIN SYNC
// ============================================================================

/**
 * Run the actual Jellyfin sync
 */
async function runJellyfinSync(
    integrationId: string,
    instance: IntegrationInstance,
    syncState: { cancelled: boolean }
): Promise<void> {
    const adapter = new JellyfinAdapter();
    const startTime = Date.now();
    const userId = instance.config.userId as string;

    try {
        logger.info(`[LibrarySync] Starting Jellyfin sync: integrationId=${integrationId}`);

        // Fetch library views (sections)
        const viewsResult = await adapter.execute(toPluginInstance(instance), {
            method: 'GET',
            path: `/Users/${userId}/Views`
        });

        if (!viewsResult.success || !viewsResult.data) {
            throw new Error('Failed to fetch library views');
        }

        const views = ((viewsResult.data as { Items?: JellyfinView[] }).Items || [])
            .filter(v => ['movies', 'tvshows'].includes(v.CollectionType || ''));

        if (views.length === 0) {
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

        // Count total items first
        let totalItems = 0;
        for (const view of views) {
            const countResult = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/Users/${userId}/Items`,
                query: { parentId: view.Id, recursive: 'true', limit: '0' }
            });

            if (countResult.success && countResult.data) {
                totalItems += (countResult.data as { TotalRecordCount?: number }).TotalRecordCount || 0;
            }
        }

        updateSyncStatus(integrationId, { totalItems, indexedItems: 0 });

        // Clear existing items for this integration
        const db = getDb();
        db.prepare(`DELETE FROM media_library WHERE integration_instance_id = ?`).run(integrationId);

        // Fetch and index items from each view
        let indexedItems = 0;
        let lastBroadcastTime = 0;
        const BROADCAST_INTERVAL = 25;
        const MIN_BROADCAST_MS = 100;

        for (const view of views) {
            if (syncState.cancelled) {
                logger.info(`[LibrarySync] Sync cancelled: integrationId=${integrationId}`);
                break;
            }

            const result = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/Users/${userId}/Items`,
                query: { parentId: view.Id, recursive: 'true', fields: 'Overview,Genres,Studios,People,ProviderIds' }
            });

            if (!result.success || !result.data) {
                logger.warn(`[LibrarySync] Failed to fetch view ${view.Name}: integrationId=${integrationId}`);
                continue;
            }

            const items = (result.data as { Items?: JellyfinMediaItem[] }).Items || [];

            // Index each item
            for (const item of items) {
                if (syncState.cancelled) break;
                // Filter to Movie or Series only
                if (!['Movie', 'Series'].includes(item.Type)) continue;

                await indexJellyfinItem(integrationId, instance, view.Id, item, 'jellyfin');
                indexedItems++;

                // Broadcast progress
                if (indexedItems % BROADCAST_INTERVAL === 0) {
                    const now = Date.now();
                    if (now - lastBroadcastTime >= MIN_BROADCAST_MS) {
                        updateSyncStatus(integrationId, { indexedItems });
                        broadcast('library_sync_progress', {
                            integrationId,
                            indexed: indexedItems,
                            total: totalItems,
                            percent: Math.round((indexedItems / totalItems) * 100)
                        });
                        lastBroadcastTime = now;
                    }
                }
            }
        }

        // Final status update
        if (syncState.cancelled) {
            updateSyncStatus(integrationId, { syncStatus: 'idle', indexedItems });
            invalidateSystemSettings('media-search-sync');
        } else {
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems
            });
            broadcast('library_sync_complete', { integrationId });
            invalidateSystemSettings('media-search-sync');
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info(`[LibrarySync] Jellyfin sync complete: integrationId=${integrationId}, items=${indexedItems}, elapsed=${elapsed}s`);

    } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[LibrarySync] Jellyfin sync failed: integrationId=${integrationId}, error="${errorMsg}"`);
        updateSyncStatus(integrationId, { syncStatus: 'error', errorMessage: errorMsg });
        invalidateSystemSettings('media-search-sync');
    } finally {
        activeSyncs.delete(integrationId);
    }
}

// ============================================================================
// EMBY SYNC
// ============================================================================

/**
 * Run the actual Emby sync (nearly identical to Jellyfin, different image URL pattern)
 */
async function runEmbySync(
    integrationId: string,
    instance: IntegrationInstance,
    syncState: { cancelled: boolean }
): Promise<void> {
    const adapter = new EmbyAdapter();
    const startTime = Date.now();
    const userId = instance.config.userId as string;

    try {
        logger.info(`[LibrarySync] Starting Emby sync: integrationId=${integrationId}`);

        // Fetch library views (sections)
        const viewsResult = await adapter.execute(toPluginInstance(instance), {
            method: 'GET',
            path: `/Users/${userId}/Views`
        });

        if (!viewsResult.success || !viewsResult.data) {
            throw new Error('Failed to fetch library views');
        }

        const views = ((viewsResult.data as { Items?: JellyfinView[] }).Items || [])
            .filter(v => ['movies', 'tvshows'].includes(v.CollectionType || ''));

        if (views.length === 0) {
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

        // Count total items first
        let totalItems = 0;
        for (const view of views) {
            const countResult = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/Users/${userId}/Items`,
                query: { parentId: view.Id, recursive: 'true', limit: '0' }
            });

            if (countResult.success && countResult.data) {
                totalItems += (countResult.data as { TotalRecordCount?: number }).TotalRecordCount || 0;
            }
        }

        updateSyncStatus(integrationId, { totalItems, indexedItems: 0 });

        // Clear existing items for this integration
        const db = getDb();
        db.prepare(`DELETE FROM media_library WHERE integration_instance_id = ?`).run(integrationId);

        // Fetch and index items from each view
        let indexedItems = 0;
        let lastBroadcastTime = 0;
        const BROADCAST_INTERVAL = 25;
        const MIN_BROADCAST_MS = 100;

        for (const view of views) {
            if (syncState.cancelled) {
                logger.info(`[LibrarySync] Sync cancelled: integrationId=${integrationId}`);
                break;
            }

            const result = await adapter.execute(toPluginInstance(instance), {
                method: 'GET',
                path: `/Users/${userId}/Items`,
                query: { parentId: view.Id, recursive: 'true', fields: 'Overview,Genres,Studios,People,ProviderIds' }
            });

            if (!result.success || !result.data) {
                logger.warn(`[LibrarySync] Failed to fetch view ${view.Name}: integrationId=${integrationId}`);
                continue;
            }

            const items = (result.data as { Items?: EmbyMediaItem[] }).Items || [];

            // Index each item
            for (const item of items) {
                if (syncState.cancelled) break;
                // Filter to Movie or Series only
                if (!['Movie', 'Series'].includes(item.Type)) continue;

                await indexJellyfinItem(integrationId, instance, view.Id, item, 'emby');
                indexedItems++;

                // Broadcast progress
                if (indexedItems % BROADCAST_INTERVAL === 0) {
                    const now = Date.now();
                    if (now - lastBroadcastTime >= MIN_BROADCAST_MS) {
                        updateSyncStatus(integrationId, { indexedItems });
                        broadcast('library_sync_progress', {
                            integrationId,
                            indexed: indexedItems,
                            total: totalItems,
                            percent: Math.round((indexedItems / totalItems) * 100)
                        });
                        lastBroadcastTime = now;
                    }
                }
            }
        }

        // Final status update
        if (syncState.cancelled) {
            updateSyncStatus(integrationId, { syncStatus: 'idle', indexedItems });
            invalidateSystemSettings('media-search-sync');
        } else {
            updateSyncStatus(integrationId, {
                syncStatus: 'completed',
                lastSyncCompleted: new Date().toISOString(),
                indexedItems
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

/**
 * Index a single Jellyfin/Emby media item
 */
async function indexJellyfinItem(
    integrationId: string,
    instance: IntegrationInstance,
    libraryKey: string,
    item: JellyfinMediaItem,
    serverType: 'jellyfin' | 'emby'
): Promise<void> {
    const db = getDb();

    // Parse external IDs
    const tmdbId = item.ProviderIds?.Tmdb ? parseInt(item.ProviderIds.Tmdb, 10) : null;
    const imdbId = item.ProviderIds?.Imdb || null;

    // Extract people
    const directors = item.People?.filter(p => p.Type === 'Director').map(p => p.Name) || [];
    const actors = item.People?.filter(p => p.Type === 'Actor').map(p => p.Name).slice(0, 10) || [];

    // Cache thumbnail (non-blocking)
    if (item.ImageTags?.Primary) {
        const baseUrl = translateHostUrl(instance.config.url as string);
        const thumbUrl = serverType === 'jellyfin'
            ? `${baseUrl}/Items/${item.Id}/Images/Primary?fillWidth=120&fillHeight=180`
            : `${baseUrl}/Items/${item.Id}/Images/Primary?width=120&height=180&api_key=${instance.config.apiKey}`;

        const authHeaders = serverType === 'jellyfin'
            ? { 'Authorization': `MediaBrowser Token="${instance.config.apiKey}"` }
            : undefined; // Emby uses api_key in URL

        cacheLibraryImage(integrationId, item.Id, thumbUrl, authHeaders).catch((err) => {
            logger.debug(`[LibrarySync] Image cache failed: itemKey=${item.Id}, error="${err.message}"`);
        });
    }

    // Determine media type
    const mediaType = item.Type === 'Series' ? 'show' : 'movie';

    // Upsert into media_library
    db.prepare(`
        INSERT INTO media_library (
            integration_instance_id, media_type, library_key, item_key,
            title, original_title, sort_title, year, thumb, art, summary,
            genres, studio, director, actors, rating, content_rating,
            duration, added_at, updated_at, tmdb_id, imdb_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(integration_instance_id, item_key) DO UPDATE SET
            title = excluded.title,
            original_title = excluded.original_title,
            sort_title = excluded.sort_title,
            year = excluded.year,
            thumb = excluded.thumb,
            summary = excluded.summary,
            genres = excluded.genres,
            director = excluded.director,
            actors = excluded.actors,
            rating = excluded.rating,
            updated_at = excluded.updated_at,
            tmdb_id = excluded.tmdb_id,
            imdb_id = excluded.imdb_id,
            indexed_at = CURRENT_TIMESTAMP
    `).run(
        integrationId,
        mediaType,
        libraryKey,
        item.Id,
        item.Name,
        item.OriginalTitle || null,
        item.SortName || null,
        item.ProductionYear || null,
        item.ImageTags?.Primary ? `/Items/${item.Id}/Images/Primary` : null,
        item.BackdropImageTags?.length ? `/Items/${item.Id}/Images/Backdrop` : null,
        item.Overview || null,
        item.Genres ? JSON.stringify(item.Genres) : null,
        item.Studios?.[0]?.Name || null,
        directors.join(', ') || null,
        actors.length > 0 ? JSON.stringify(actors) : null,
        item.CommunityRating || null,
        item.OfficialRating || null,
        item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10000) : null, // Ticks to ms
        item.DateCreated ? new Date(item.DateCreated).getTime() / 1000 : null,
        null, // Updated at not reliably available
        tmdbId,
        imdbId
    );
}

// ============================================================================
// SURGICAL CACHE REFRESH (used by Overseerr poller)
// ============================================================================

/**
 * Check if a TMDB ID already exists in the media_library cache.
 * Sub-millisecond indexed query.
 */
export function isTmdbIdInLibrary(tmdbId: number): boolean {
    const db = getDb();
    const row = db.prepare(
        `SELECT 1 FROM media_library WHERE tmdb_id = ? LIMIT 1`
    ).get(tmdbId);
    return !!row;
}

/**
 * Get all media server integrations (plex/jellyfin/emby) that have library sync enabled.
 */
export function getMediaServerIntegrationsWithSync(): IntegrationInstance[] {
    const allInstances = getAllInstances();
    return allInstances.filter(inst => {
        if (!['plex', 'jellyfin', 'emby'].includes(inst.type)) return false;
        if (!inst.enabled) return false;
        const config = inst.config as { librarySyncEnabled?: boolean | string };
        return config?.librarySyncEnabled === true || config?.librarySyncEnabled === 'true';
    });
}

/**
 * Search a media server for a specific title and upsert it into the library cache.
 * Called surgically when the Overseerr poller detects newly available media.
 * 
 * @param media - The media to search for (title, tmdbId, mediaType)
 * @param mediaServers - Media server instances with library sync enabled
 * @returns true if the item was found and indexed in at least one server
 */
export async function searchAndIndexItem(
    media: { title: string; tmdbId: number; mediaType: 'movie' | 'tv' },
    mediaServers: IntegrationInstance[]
): Promise<boolean> {
    let indexed = false;

    for (const server of mediaServers) {
        try {
            const pluginInstance = toPluginInstance(server);

            if (server.type === 'plex') {
                indexed = await searchAndIndexPlex(server, pluginInstance, media);
            } else if (server.type === 'jellyfin') {
                indexed = await searchAndIndexJellyfin(server, pluginInstance, media, 'jellyfin');
            } else if (server.type === 'emby') {
                indexed = await searchAndIndexJellyfin(server, pluginInstance, media, 'emby');
            }

            if (indexed) {
                logger.info(`[LibrarySync] Surgical index: title="${media.title}", tmdbId=${media.tmdbId}, server=${server.type}:${server.id}`);
                break; // Found in one server, no need to check others
            }
        } catch (error) {
            logger.debug(`[LibrarySync] Surgical search failed: server=${server.type}:${server.id}, error="${(error as Error).message}"`);
        }
    }

    return indexed;
}

/**
 * Search Plex for a specific title and index if found.
 * Uses per-library-section search (universally supported across Plex versions).
 */
async function searchAndIndexPlex(
    instance: IntegrationInstance,
    pluginInstance: PluginInstance,
    media: { title: string; tmdbId: number; mediaType: 'movie' | 'tv' }
): Promise<boolean> {
    const adapter = new PlexAdapter();

    // First get library sections (same pattern as full sync)
    const sectionsResult = await adapter.execute(pluginInstance, {
        method: 'GET',
        path: '/library/sections'
    });

    if (!sectionsResult.success || !sectionsResult.data) return false;

    const mediaContainer = (sectionsResult.data as { MediaContainer?: { Directory?: PlexLibrarySection[] } }).MediaContainer;
    const sections = mediaContainer?.Directory || [];

    // Filter to relevant section type (movies → movie, tv → show)
    const targetType = media.mediaType === 'tv' ? 'show' : 'movie';
    const mediaSections = sections.filter(s => s.type === targetType);

    for (const section of mediaSections) {
        // Search within this section using title filter
        // type=1 for movies, type=2 for shows
        const plexType = targetType === 'movie' ? '1' : '2';
        const result = await adapter.execute(pluginInstance, {
            method: 'GET',
            path: `/library/sections/${section.key}/all`,
            query: { type: plexType, title: media.title, includeGuids: '1', 'X-Plex-Container-Size': '10' }
        });

        if (!result.success || !result.data) continue;

        const container = (result.data as { MediaContainer?: { Metadata?: PlexMediaItem[] } }).MediaContainer;
        const items = container?.Metadata || [];

        for (const item of items) {
            // Match by TMDB ID (most reliable)
            const itemTmdbId = item.Guid?.find(g => g.id.startsWith('tmdb://'))?.id.replace('tmdb://', '');
            if (itemTmdbId && parseInt(itemTmdbId, 10) === media.tmdbId) {
                // Found it — index into cache
                await indexPlexItem(
                    instance.id, instance, section.key,
                    targetType,
                    item
                );
                return true;
            }
        }
    }

    return false;
}


/**
 * Search Jellyfin/Emby for a specific title and index if found.
 */
async function searchAndIndexJellyfin(
    instance: IntegrationInstance,
    pluginInstance: PluginInstance,
    media: { title: string; tmdbId: number; mediaType: 'movie' | 'tv' },
    serverType: 'jellyfin' | 'emby'
): Promise<boolean> {
    const adapter = serverType === 'jellyfin' ? new JellyfinAdapter() : new EmbyAdapter();
    const userId = instance.config.userId as string;

    if (!userId) return false;

    // Search via Items endpoint with searchTerm
    const includeTypes = media.mediaType === 'tv' ? 'Series' : 'Movie';
    const result = await adapter.execute(pluginInstance, {
        method: 'GET',
        path: `/Users/${userId}/Items`,
        query: {
            searchTerm: media.title,
            limit: '10',
            includeItemTypes: includeTypes,
            recursive: 'true',
            fields: 'Overview,Genres,Studios,People,ProviderIds'
        }
    });

    if (!result.success || !result.data) return false;

    const items = (result.data as { Items?: JellyfinMediaItem[] }).Items || [];

    for (const item of items) {
        // Match by TMDB ID
        const itemTmdbId = item.ProviderIds?.Tmdb ? parseInt(item.ProviderIds.Tmdb, 10) : null;
        if (itemTmdbId === media.tmdbId) {
            // Found it — index into cache
            await indexJellyfinItem(
                instance.id, instance,
                'search',
                item, serverType
            );
            return true;
        }
    }

    return false;
}
