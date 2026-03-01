/**
 * Surgical Library Cache Refresh
 * 
 * Used by the Overseerr poller to index specific recently-added items
 * without triggering a full library sync.
 */

import { getDb } from '../../database/db';
import { PlexAdapter } from '../../integrations/plex/adapter';
import { JellyfinAdapter } from '../../integrations/jellyfin/adapter';
import { EmbyAdapter } from '../../integrations/emby/adapter';
import {
    toPluginInstance,
    getMediaServerIntegrationsWithSync,
    logger,
    IntegrationInstance,
    PluginInstance,
} from './shared';
import { PlexLibrarySection, PlexMediaItem, JellyfinMediaItem } from './types';
import { indexPlexItem } from './indexing';
import { indexJellyfinEmbyItem } from './indexing';

// ============================================================================
// EXPORTS
// ============================================================================

/** Number of recently-added items to fetch per library section */
const RECENTLY_ADDED_LIMIT = 20;

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
 * Fetch recently-added items from all media servers and index any that match
 * the given set of TMDB IDs. This replaces the old title-based search approach
 * which was fragile (TV show title suffixes, localization differences, etc.).
 * 
 * @param tmdbIds - Set of TMDB IDs to look for in recently-added items
 * @param mediaServers - Media server instances with library sync enabled
 * @returns Set of TMDB IDs that were successfully indexed
 */
export async function indexRecentlyAddedForTmdbIds(
    tmdbIds: Set<number>,
    mediaServers: IntegrationInstance[]
): Promise<Set<number>> {
    const indexed = new Set<number>();

    for (const server of mediaServers) {
        try {
            const pluginInstance = toPluginInstance(server);

            if (server.type === 'plex') {
                const found = await indexRecentlyAddedPlex(server, pluginInstance, tmdbIds);
                for (const id of found) indexed.add(id);
            } else if (server.type === 'jellyfin' || server.type === 'emby') {
                const found = await indexRecentlyAddedJellyfin(server, pluginInstance, tmdbIds, server.type);
                for (const id of found) indexed.add(id);
            }

            // If all TMDB IDs found, no need to check remaining servers
            if (indexed.size >= tmdbIds.size) break;
        } catch (error) {
            logger.debug(`[LibrarySync] Surgical refresh failed: server=${server.type}:${server.id}, error="${(error as Error).message}"`);
        }
    }

    return indexed;
}

// Re-export for barrel
export { getMediaServerIntegrationsWithSync } from './shared';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Fetch recently-added items from Plex and index any matching the target TMDB IDs.
 */
async function indexRecentlyAddedPlex(
    instance: IntegrationInstance,
    pluginInstance: PluginInstance,
    targetTmdbIds: Set<number>
): Promise<Set<number>> {
    const adapter = new PlexAdapter();
    const indexed = new Set<number>();

    // Get library sections
    const sectionsResult = await adapter.execute(pluginInstance, {
        method: 'GET',
        path: '/library/sections'
    });

    if (!sectionsResult.success || !sectionsResult.data) return indexed;

    const mediaContainer = (sectionsResult.data as { MediaContainer?: { Directory?: PlexLibrarySection[] } }).MediaContainer;
    const sections = mediaContainer?.Directory || [];
    const mediaSections = sections.filter(s => ['movie', 'show'].includes(s.type));

    for (const section of mediaSections) {
        // Fetch recently-added items sorted by addedAt descending
        const plexType = section.type === 'movie' ? '1' : '2';
        const result = await adapter.execute(pluginInstance, {
            method: 'GET',
            path: `/library/sections/${section.key}/all`,
            query: {
                type: plexType,
                sort: 'addedAt:desc',
                includeGuids: '1',
                'X-Plex-Container-Size': String(RECENTLY_ADDED_LIMIT)
            }
        });

        if (!result.success || !result.data) continue;

        const container = (result.data as { MediaContainer?: { Metadata?: PlexMediaItem[] } }).MediaContainer;
        const items = container?.Metadata || [];

        for (const item of items) {
            const itemTmdbId = item.Guid?.find(g => g.id.startsWith('tmdb://'))?.id.replace('tmdb://', '');
            if (!itemTmdbId) continue;

            const tmdbId = parseInt(itemTmdbId, 10);
            if (targetTmdbIds.has(tmdbId) && !indexed.has(tmdbId)) {
                await indexPlexItem(instance.id, instance, section.key, section.type, item);
                indexed.add(tmdbId);
                logger.info(`[LibrarySync] Surgical index: title="${item.title}", tmdbId=${tmdbId}, server=plex:${instance.id}`);
            }
        }

        // If all targets found, stop early
        if (indexed.size >= targetTmdbIds.size) break;
    }

    return indexed;
}

/**
 * Fetch recently-added items from Jellyfin/Emby and index any matching the target TMDB IDs.
 */
async function indexRecentlyAddedJellyfin(
    instance: IntegrationInstance,
    pluginInstance: PluginInstance,
    targetTmdbIds: Set<number>,
    serverType: 'jellyfin' | 'emby'
): Promise<Set<number>> {
    const adapter = serverType === 'jellyfin' ? new JellyfinAdapter() : new EmbyAdapter();
    const userId = instance.config.userId as string;
    const indexed = new Set<number>();

    if (!userId) return indexed;

    // Fetch recently-added movies and series
    for (const includeType of ['Movie', 'Series']) {
        const result = await adapter.execute(pluginInstance, {
            method: 'GET',
            path: `/Users/${userId}/Items`,
            query: {
                includeItemTypes: includeType,
                sortBy: 'DateCreated',
                sortOrder: 'Descending',
                limit: String(RECENTLY_ADDED_LIMIT),
                recursive: 'true',
                fields: 'Overview,Genres,Studios,People,ProviderIds'
            }
        });

        if (!result.success || !result.data) continue;

        const items = (result.data as { Items?: JellyfinMediaItem[] }).Items || [];

        for (const item of items) {
            const itemTmdbId = item.ProviderIds?.Tmdb ? parseInt(item.ProviderIds.Tmdb, 10) : null;
            if (itemTmdbId === null) continue;

            if (targetTmdbIds.has(itemTmdbId) && !indexed.has(itemTmdbId)) {
                await indexJellyfinEmbyItem(instance.id, instance, 'recent', item, serverType);
                indexed.add(itemTmdbId);
                logger.info(`[LibrarySync] Surgical index: title="${item.Name}", tmdbId=${itemTmdbId}, server=${serverType}:${instance.id}`);
            }
        }

        // If all targets found, stop early
        if (indexed.size >= targetTmdbIds.size) break;
    }

    return indexed;
}
