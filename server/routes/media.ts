/**
 * Media Routes
 * 
 * API endpoints for media library search and sync management.
 * Used by the Media Search widget.
 */

import { Router, Request, Response } from 'express';
import Fuse, { FuseResult } from 'fuse.js';
import { getDb } from '../database/db';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';
import {
    startFullSync,
    getSyncStatus,
    cancelSync
} from '../services/librarySyncService';
import { getLocalLibraryImageUrl } from '../services/libraryImageCache';
import { getInstanceById } from '../db/integrationInstances';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface SearchResult {
    integrationId: string;
    status: 'ready' | 'syncing' | 'error';
    progress?: { indexed: number; total: number };
    items?: MediaItem[];
    error?: string;
    displayName?: string;
    integrationType?: string;
    totalMatches?: number;
    hasMore?: boolean;
}

interface MediaItem {
    id: number;
    integrationId: string;
    mediaType: string;
    itemKey: string;
    title: string;
    originalTitle: string | null;
    year: number | null;
    thumb: string | null;
    summary: string | null;
    genres: string[] | null;
    director: string | null;
    actors: string[] | null;
    rating: number | null;
    tmdbId: number | null;
    imdbId: string | null;
}

interface MediaLibraryRow {
    id: number;
    integration_instance_id: string;
    media_type: string;
    item_key: string;
    title: string;
    original_title: string | null;
    year: number | null;
    thumb: string | null;
    summary: string | null;
    genres: string | null;
    director: string | null;
    actors: string | null;
    rating: number | null;
    tmdb_id: number | null;
    imdb_id: string | null;
}

interface SyncStatusRow {
    integration_instance_id: string;
    total_items: number;
    indexed_items: number;
    sync_status: string;
    error_message: string | null;
}

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * GET /api/media/search
 * 
 * Search media across multiple integrations using FTS5.
 * Smart pagination: 5 results per integration if multiple have results, 20 if only one.
 * 
 * Query params:
 * - q: Search query (required)
 * - integrations: Comma-separated integration IDs (required)
 * - offsets: JSON object of per-integration offsets (optional, e.g. {"plex-1":5})
 */
router.get('/search', requireAuth, async (req: Request, res: Response) => {
    try {
        const { q, integrations, offsets: offsetsParam } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        if (!integrations || typeof integrations !== 'string') {
            res.status(400).json({ error: 'Query parameter "integrations" is required' });
            return;
        }

        const integrationIds = integrations.split(',').map(id => id.trim()).filter(Boolean);
        if (integrationIds.length === 0) {
            res.status(400).json({ error: 'At least one integration ID is required' });
            return;
        }

        // Parse per-integration offsets
        let offsets: Record<string, number> = {};
        if (offsetsParam && typeof offsetsParam === 'string') {
            try { offsets = JSON.parse(offsetsParam); } catch { /* ignore */ }
        }

        const db = getDb();
        const searchQuery = q.trim().replace(/"/g, '""');

        // Phase 1: Search all integrations and collect up to 20 results each
        interface IntegrationData {
            allItems: MediaItem[];
            status: 'ready' | 'syncing' | 'error';
            error?: string;
            progress?: { indexed: number; total: number };
            displayName: string;
            integrationType: string;
        }
        const searchData: Record<string, IntegrationData> = {};
        let integrationsWithResults = 0;

        for (const integrationId of integrationIds) {
            // Get integration metadata
            const instanceRow = db.prepare(`
                SELECT display_name, type FROM integration_instances WHERE id = ?
            `).get(integrationId) as { display_name: string; type: string } | undefined;
            const displayName = instanceRow?.display_name || integrationId;
            const integrationType = instanceRow?.type || 'plex';

            // Check sync status
            const statusRow = db.prepare(`
                SELECT integration_instance_id, total_items, indexed_items, sync_status, error_message
                FROM library_sync_status WHERE integration_instance_id = ?
            `).get(integrationId) as SyncStatusRow | undefined;

            if (!statusRow || statusRow.sync_status === 'idle') {
                searchData[integrationId] = {
                    allItems: [], status: 'error', error: 'Library not synced', displayName, integrationType
                };
                continue;
            }

            if (statusRow.sync_status === 'syncing') {
                searchData[integrationId] = {
                    allItems: [], status: 'syncing',
                    progress: { indexed: statusRow.indexed_items, total: statusRow.total_items },
                    displayName, integrationType
                };
                continue;
            }

            if (statusRow.sync_status === 'error') {
                searchData[integrationId] = {
                    allItems: [], status: 'error', error: statusRow.error_message || 'Sync failed',
                    displayName, integrationType
                };
                continue;
            }

            // FTS5 search — title-only matching to prevent weak actor/director hits
            // from inflating results and pushing Overseerr results down.
            // Uses {title original_title} column filter so "oppen" only matches
            // titles containing "oppen*", not actors named "Oppenheimer".
            let rows: MediaLibraryRow[];
            try {
                rows = db.prepare(`
                    SELECT m.id, m.integration_instance_id, m.media_type, m.item_key, m.title,
                           m.original_title, m.year, m.thumb, m.summary, m.genres, m.director,
                           m.actors, m.rating, m.tmdb_id, m.imdb_id
                    FROM media_library m
                    JOIN media_library_fts fts ON m.id = fts.rowid
                    WHERE m.integration_instance_id = ? AND media_library_fts MATCH ?
                    ORDER BY rank LIMIT 20
                `).all(integrationId, `{title original_title} : "${searchQuery}"*`) as MediaLibraryRow[];
            } catch {
                // Fallback: if column filter syntax fails (pre-migration FTS tables),
                // use unscoped match
                rows = db.prepare(`
                    SELECT m.id, m.integration_instance_id, m.media_type, m.item_key, m.title,
                           m.original_title, m.year, m.thumb, m.summary, m.genres, m.director,
                           m.actors, m.rating, m.tmdb_id, m.imdb_id
                    FROM media_library m
                    JOIN media_library_fts fts ON m.id = fts.rowid
                    WHERE m.integration_instance_id = ? AND media_library_fts MATCH ?
                    ORDER BY rank LIMIT 20
                `).all(integrationId, `"${searchQuery}"*`) as MediaLibraryRow[];
            }

            // Fuzzy fallback if few FTS results — stricter than before.
            // Threshold 0.25 (was 0.4) ensures only close matches surface.
            // Actor/director searchable but at low weight (0.3) so only strong
            // actor name matches appear (e.g. "Cillian" yes, "Cill" no).
            // Score cutoff 0.2 filters out mediocre hits entirely.
            if (rows.length < 5 && searchQuery.length >= 5) {
                const allRows = db.prepare(`
                    SELECT m.id, m.integration_instance_id, m.media_type, m.item_key, m.title,
                           m.original_title, m.year, m.thumb, m.summary, m.genres, m.director,
                           m.actors, m.rating, m.tmdb_id, m.imdb_id
                    FROM media_library m WHERE m.integration_instance_id = ? LIMIT 1000
                `).all(integrationId) as MediaLibraryRow[];

                interface SearchableRow extends MediaLibraryRow { actorsText: string; }
                const searchableRows: SearchableRow[] = allRows.map(row => ({
                    ...row, actorsText: row.actors ? JSON.parse(row.actors).join(' ') : ''
                }));

                const fuse = new Fuse(searchableRows, {
                    keys: [
                        { name: 'title', weight: 2 }, { name: 'original_title', weight: 1.5 },
                        { name: 'actorsText', weight: 0.3 }, { name: 'director', weight: 0.3 }
                    ],
                    threshold: 0.25, distance: 100, includeScore: true, ignoreLocation: true
                });

                const fuzzyResults = fuse.search(searchQuery)
                    .filter((r: FuseResult<SearchableRow>) => (r.score ?? 1) < 0.2); // Score cutoff

                if (fuzzyResults.length > rows.length) {
                    rows = fuzzyResults.slice(0, 20).map((r: FuseResult<SearchableRow>) => r.item as MediaLibraryRow);
                }
            }

            const allItems: MediaItem[] = rows.map(row => ({
                id: row.id,
                integrationId: row.integration_instance_id,
                mediaType: row.media_type,
                itemKey: row.item_key,
                title: row.title,
                originalTitle: row.original_title,
                year: row.year,
                thumb: getLocalLibraryImageUrl(row.integration_instance_id, row.item_key),
                summary: row.summary,
                genres: row.genres ? JSON.parse(row.genres) : null,
                director: row.director,
                actors: row.actors ? JSON.parse(row.actors) : null,
                rating: row.rating,
                tmdbId: row.tmdb_id,
                imdbId: row.imdb_id
            }));

            searchData[integrationId] = { allItems, status: 'ready', displayName, integrationType };
            if (allItems.length > 0) integrationsWithResults++;
        }

        // Phase 2: Determine limit and build response
        const useLimit = integrationsWithResults > 1 ? 5 : 20;
        const results: Record<string, SearchResult> = {};

        for (const [id, data] of Object.entries(searchData)) {
            const offset = offsets[id] || 0;
            const slicedItems = data.allItems.slice(offset, offset + useLimit);
            const hasMore = data.allItems.length > offset + slicedItems.length;

            results[id] = {
                integrationId: id,
                status: data.status,
                items: slicedItems,
                totalMatches: data.allItems.length,
                hasMore,
                displayName: data.displayName,
                integrationType: data.integrationType,
                ...(data.error && { error: data.error }),
                ...(data.progress && { progress: data.progress })
            };
        }

        logger.debug(`[Media] Search: query="${q}" integrations=${integrationIds.length} withResults=${integrationsWithResults} limit=${useLimit}`);
        res.json({ results });

    } catch (error) {
        logger.error(`[Media] Search failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

/**
 * GET /api/media/sync/status/:integrationId
 * Get sync status for an integration
 */
router.get('/sync/status/:integrationId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const status = getSyncStatus(integrationId);

        if (!status) {
            res.json({
                integrationId,
                syncStatus: 'idle',
                totalItems: 0,
                indexedItems: 0
            });
            return;
        }

        res.json(status);
    } catch (error) {
        logger.error(`[Media] Get sync status failed: id=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

/**
 * POST /api/media/sync/start/:integrationId
 * Start a full library sync for an integration
 */
router.post('/sync/start/:integrationId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const result = await startFullSync(integrationId);

        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }

        logger.info(`[Media] Sync started: id=${integrationId} user=${req.user?.id}`);
        res.json({ success: true, message: 'Sync started' });
        return;
    } catch (error) {
        logger.error(`[Media] Start sync failed: id=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to start sync' });
    }
});

/**
 * POST /api/media/sync/cancel/:integrationId
 * Cancel an active sync
 */
router.post('/sync/cancel/:integrationId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.params;
        const cancelled = cancelSync(integrationId);

        if (!cancelled) {
            res.status(400).json({ error: 'No active sync to cancel' });
            return;
        }

        logger.info(`[Media] Sync cancelled: id=${integrationId} user=${req.user?.id}`);
        res.json({ success: true, message: 'Sync cancelled' });
        return;
    } catch (error) {
        logger.error(`[Media] Cancel sync failed: id=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to cancel sync' });
    }
});

// ============================================================================
// SEARCH HISTORY ENDPOINTS
// ============================================================================

import { getSearchHistory, addSearchHistory, clearSearchHistory } from '../db/mediaSearchHistory';

/**
 * GET /api/media/search-history/:widgetId
 * Get recent search history for a widget
 */
router.get('/search-history/:widgetId', requireAuth, (req: Request, res: Response) => {
    try {
        const { widgetId } = req.params;
        const history = getSearchHistory(widgetId);
        res.json({ history });
    } catch (error) {
        logger.error(`[Media] Get search history failed: widget=${req.params.widgetId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get search history' });
    }
});

/**
 * POST /api/media/search-history/:widgetId
 * Add a search to widget history
 */
router.post('/search-history/:widgetId', requireAuth, (req: Request, res: Response) => {
    try {
        const { widgetId } = req.params;
        const { query } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            res.status(400).json({ error: 'Query is required' });
            return;
        }

        const entry = addSearchHistory(widgetId, query);
        res.json({ entry });
    } catch (error) {
        logger.error(`[Media] Add search history failed: widget=${req.params.widgetId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to add search history' });
    }
});

/**
 * DELETE /api/media/search-history/:widgetId
 * Clear all search history for a widget
 */
router.delete('/search-history/:widgetId', requireAuth, (req: Request, res: Response) => {
    try {
        const { widgetId } = req.params;
        clearSearchHistory(widgetId);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Media] Clear search history failed: widget=${req.params.widgetId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to clear search history' });
    }
});

// ============================================================================
// OPEN IN APP - WEB URLs
// ============================================================================

/**
 * GET /api/media/web-urls
 * Get web URLs for "Open in App" links. Returns webUrl if set, otherwise falls back to main url.
 * 
 * Query params:
 * - integrations: Comma-separated integration IDs
 */
router.get('/web-urls', requireAuth, (req: Request, res: Response) => {
    try {
        const { integrations } = req.query;

        if (!integrations || typeof integrations !== 'string') {
            res.status(400).json({ error: 'integrations parameter required' });
            return;
        }

        const integrationIds = integrations.split(',').filter(Boolean);
        const db = getDb();

        const webUrls: Record<string, string> = {};

        for (const integrationId of integrationIds) {
            const instance = getInstanceById(integrationId);

            if (instance) {
                // Use webUrl if set, otherwise fall back to main url
                const webUrl = instance.config.webUrl || instance.config.url;
                if (webUrl) {
                    // Remove trailing slash for consistent URL building
                    webUrls[integrationId] = (webUrl as string).replace(/\/$/, '');
                }
            }
        }

        res.json({ webUrls });
    } catch (error) {
        logger.error(`[Media] Get web URLs failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get web URLs' });
    }
});

// ============================================================================
// EXTERNAL IDs (TMDB / IMDB)
// ============================================================================

import axios from 'axios';
import { httpsAgent } from '../utils/httpsAgent';
import { translateHostUrl } from '../utils/urlHelper';

/** In-memory cache for external ID lookups (avoids repeated Overseerr calls) */
const externalIdCache = new Map<string, { tmdbId: number | null; imdbId: string | null; expiresAt: number }>();
const EXTERNAL_ID_CACHE_TTL = 300_000; // 5 minutes

/**
 * GET /api/media/external-ids
 * 
 * Look up TMDB and IMDB IDs for a media item.
 * 
 * Query params (one of these pairs):
 * - tmdbId + mediaType: Look up by TMDB ID (to get IMDB)
 * - itemKey + integrationId: Look up by library item key (to get both)
 */
router.get('/external-ids', requireAuth, async (req: Request, res: Response) => {
    try {
        const { tmdbId: tmdbIdParam, mediaType, itemKey, integrationId } = req.query;

        const db = getDb();
        let tmdbId: number | null = null;
        let imdbId: string | null = null;

        // Strategy 1: Look up by itemKey + integrationId (for media-stream/Plex sessions)
        if (itemKey && integrationId) {
            const row = db.prepare(`
                SELECT tmdb_id, imdb_id FROM media_library
                WHERE item_key = ? AND integration_instance_id = ?
                LIMIT 1
            `).get(String(itemKey), String(integrationId)) as { tmdb_id: number | null; imdb_id: string | null } | undefined;

            if (row) {
                tmdbId = row.tmdb_id;
                imdbId = row.imdb_id;
            }
        }

        // Strategy 2: Look up by tmdbId + mediaType (for Overseerr modals)
        if (!imdbId && tmdbIdParam) {
            const parsedTmdbId = parseInt(String(tmdbIdParam), 10);
            if (!isNaN(parsedTmdbId)) {
                tmdbId = parsedTmdbId;

                // Normalize mediaType: frontend sends 'movie'/'tv', DB stores 'movie'/'show'
                const dbMediaType = String(mediaType || '') === 'tv' ? 'show' : String(mediaType || 'movie');

                // Check library index first
                const row = db.prepare(`
                    SELECT imdb_id FROM media_library
                    WHERE tmdb_id = ? AND media_type = ?
                    LIMIT 1
                `).get(parsedTmdbId, dbMediaType) as { imdb_id: string | null } | undefined;

                if (row?.imdb_id) {
                    imdbId = row.imdb_id;
                }

                // Fallback: check in-memory cache
                if (!imdbId) {
                    const cacheKey = `${parsedTmdbId}:${mediaType}`;
                    const cached = externalIdCache.get(cacheKey);
                    if (cached && Date.now() < cached.expiresAt) {
                        imdbId = cached.imdbId;
                    }
                }

                // Fallback: hit Overseerr's TMDB proxy to get externalIds
                if (!imdbId) {
                    const apiMediaType = String(mediaType || 'movie'); // 'movie' or 'tv'

                    // Use the proper helper that decrypts config
                    const { getInstancesByType } = await import('../db/integrationInstances');
                    const overseerrInstances = getInstancesByType('overseerr');
                    const overseerrInstance = overseerrInstances.find(i => i.enabled);

                    if (overseerrInstance) {
                        try {
                            const config = overseerrInstance.config as Record<string, unknown>;
                            const url = translateHostUrl((config.url as string).replace(/\/$/, ''));
                            const apiKey = config.apiKey as string;

                            const tmdbResponse = await axios.get(
                                `${url}/api/v1/${apiMediaType}/${parsedTmdbId}`,
                                {
                                    headers: { 'X-Api-Key': apiKey },
                                    httpsAgent,
                                    timeout: 10000,
                                }
                            );

                            const externalIds = tmdbResponse.data?.externalIds;
                            if (externalIds?.imdbId) {
                                imdbId = externalIds.imdbId;
                            }

                            // Cache the result
                            externalIdCache.set(`${parsedTmdbId}:${apiMediaType}`, {
                                tmdbId: parsedTmdbId,
                                imdbId,
                                expiresAt: Date.now() + EXTERNAL_ID_CACHE_TTL,
                            });
                        } catch (err) {
                            logger.debug(`[Media] External IDs Overseerr fallback failed: tmdbId=${parsedTmdbId} error="${(err as Error).message}"`);
                        }
                    }
                }
            }
        }

        res.json({ tmdbId, imdbId });
    } catch (error) {
        logger.error(`[Media] External IDs lookup failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to look up external IDs' });
    }
});

export default router;

