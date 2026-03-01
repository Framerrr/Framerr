/**
 * Library Sync Indexing
 * 
 * Functions that index individual media items into the media_library table.
 * Shared by both full sync and surgical sync operations.
 */

import { getDb } from '../../database/db';
import { cacheLibraryImage } from '../libraryImageCache';
import { translateHostUrl } from '../../utils/urlHelper';
import { logger, IntegrationInstance } from './shared';
import { PlexMediaItem, JellyfinMediaItem } from './types';

// ============================================================================
// PLEX INDEXING
// ============================================================================

/**
 * Index a single Plex media item into media_library.
 * Handles external ID parsing, image caching, and DB upsert.
 */
export async function indexPlexItem(
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
// JELLYFIN / EMBY INDEXING
// ============================================================================

/**
 * Index a single Jellyfin/Emby media item into media_library.
 * Shared between Jellyfin and Emby (identical API structure, different image URL patterns).
 */
export async function indexJellyfinEmbyItem(
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
