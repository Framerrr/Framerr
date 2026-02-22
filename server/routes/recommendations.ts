/**
 * Recommendations Route (Integration-Agnostic)
 * 
 * GET /api/media/recommendations?integrationIds=id1,id2&limit=20
 * 
 * Fetches personalized suggestions from each bound integration's native API,
 * falling back to random items from that integration's synced library cache.
 * Supports Plex, Jellyfin, and Emby.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../database/db';
import { getPlexTokenForUser } from '../db/linkedAccounts';
import { getInstanceById } from '../db/integrationInstances';
import { getLocalLibraryImageUrl } from '../services/libraryImageCache';
import { translateHostUrl } from '../utils/urlHelper';
import { httpsAgent } from '../utils/httpsAgent';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface RecommendationItem {
    ratingKey: string;
    title: string;
    year: number | null;
    mediaType: 'movie' | 'show';
    thumb: string | null;
    integrationId: string;
    integrationType: 'plex' | 'jellyfin' | 'emby';
    summary: string | null;
    genres: string[] | null;
    rating: number | null;
    tmdbId: number | null;
    imdbId: string | null;
}

interface PlexHubItem {
    ratingKey: string;
    title: string;
    year?: number;
    type: string;
    thumb?: string;
}

interface PlexHub {
    title: string;
    type: string;
    Metadata?: PlexHubItem[];
}

// ============================================================================
// PLEX ADAPTER
// ============================================================================

/**
 * Fetch personalized recommendations from Plex /hubs using user's stored token.
 */
async function fetchPlexHubs(
    serverUrl: string,
    userToken: string,
    integrationId: string,
    limit: number
): Promise<RecommendationItem[] | null> {
    try {
        const url = `${serverUrl}/hubs`;
        const response = await axios.get(url, {
            headers: {
                'X-Plex-Token': userToken,
                'Accept': 'application/json',
            },
            httpsAgent,
            timeout: 8000,
        });

        const hubs: PlexHub[] = response.data?.MediaContainer?.Hub || [];

        // Flatten all hub items, deduplicate by ratingKey, shuffle, take limit
        const seen = new Set<string>();
        const allItems: RecommendationItem[] = [];

        for (const hub of hubs) {
            if (!hub.Metadata) continue;
            for (const item of hub.Metadata) {
                if (seen.has(item.ratingKey)) continue;
                const mediaType = item.type === 'movie' ? 'movie' : 'show';
                if (item.type !== 'movie' && item.type !== 'show') continue;
                seen.add(item.ratingKey);
                allItems.push({
                    ratingKey: item.ratingKey,
                    title: item.title,
                    year: item.year ?? null,
                    mediaType,
                    thumb: item.thumb || null,
                    integrationId,
                    integrationType: 'plex',
                    summary: null, genres: null, rating: null, tmdbId: null, imdbId: null,
                });
            }
        }

        // Shuffle using Fisher-Yates
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }

        return allItems.slice(0, limit);
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        logger.warn(`[Recommendations] Plex /hubs failed: integrationId=${integrationId} status=${status} error="${(error as Error).message}"`);
        return null;
    }
}

// ============================================================================
// JELLYFIN / EMBY ADAPTER
// ============================================================================

interface JellyfinSuggestionItem {
    Id: string;
    Name: string;
    ProductionYear?: number;
    Type: string;
    ImageTags?: Record<string, string>;
}

/**
 * Fetch suggestions from Jellyfin or Emby /Users/{userId}/Suggestions endpoint.
 * Both Jellyfin and Emby share the same API shape for this endpoint.
 */
async function fetchMediaServerSuggestions(
    serverUrl: string,
    apiKey: string,
    userId: string,
    integrationId: string,
    integrationType: 'jellyfin' | 'emby',
    limit: number
): Promise<RecommendationItem[] | null> {
    try {
        const url = `${serverUrl}/Users/${userId}/Suggestions`;
        const response = await axios.get(url, {
            params: {
                Limit: limit,
                Type: 'Movie,Series',
            },
            headers: integrationType === 'jellyfin'
                ? { 'Authorization': `MediaBrowser Token="${apiKey}"` }
                : { 'X-Emby-Token': apiKey },
            httpsAgent,
            timeout: 8000,
        });

        const items: JellyfinSuggestionItem[] = response.data?.Items || [];

        const results: RecommendationItem[] = items
            .filter(item => item.Type === 'Movie' || item.Type === 'Series')
            .map(item => ({
                ratingKey: item.Id,
                title: item.Name,
                year: item.ProductionYear ?? null,
                mediaType: (item.Type === 'Movie' ? 'movie' : 'show') as 'movie' | 'show',
                thumb: null, // Will be enriched with local cache image
                integrationId,
                integrationType,
                summary: null, genres: null, rating: null, tmdbId: null, imdbId: null,
            }));

        // Shuffle
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }

        return results.slice(0, limit);
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        logger.warn(`[Recommendations] ${integrationType} suggestions failed: integrationId=${integrationId} status=${status} error="${(error as Error).message}"`);
        return null;
    }
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Fetch random items from the local media_library table for a specific integration.
 */
function fetchRandomFromLibrary(
    integrationId: string,
    integrationType: 'plex' | 'jellyfin' | 'emby',
    limit: number
): RecommendationItem[] {
    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT item_key, title, year, media_type, thumb,
                   summary, genres, rating, tmdb_id, imdb_id
            FROM media_library
            WHERE integration_instance_id = ?
              AND media_type IN ('movie', 'show')
            ORDER BY RANDOM()
            LIMIT ?
        `).all(integrationId, limit) as {
            item_key: string;
            title: string;
            year: number | null;
            media_type: string;
            thumb: string | null;
            summary: string | null;
            genres: string | null;
            rating: number | null;
            tmdb_id: number | null;
            imdb_id: string | null;
        }[];

        return rows.map(row => ({
            ratingKey: row.item_key,
            title: row.title,
            year: row.year,
            mediaType: row.media_type as 'movie' | 'show',
            thumb: (() => {
                const url = getLocalLibraryImageUrl(integrationId, row.item_key);
                return url ? `${url}?size=lg` : null;
            })(),
            integrationId,
            integrationType,
            summary: row.summary,
            genres: row.genres ? JSON.parse(row.genres) : null,
            rating: row.rating,
            tmdbId: row.tmdb_id,
            imdbId: row.imdb_id,
        }));
    } catch (error) {
        logger.error(`[Recommendations] Random library query failed: integrationId=${integrationId} error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Enrich items with local library cache metadata (images, summary, genres, etc.)
 */
function enrichWithLocalMetadata(
    items: RecommendationItem[],
    integrationId: string
): RecommendationItem[] {
    const db = getDb();
    return items.map(item => {
        const enriched = { ...item };

        // Use local cached image
        const localUrl = getLocalLibraryImageUrl(integrationId, item.ratingKey);
        enriched.thumb = localUrl ? `${localUrl}?size=lg` : item.thumb;

        // Cross-reference with local media_library for full metadata
        const row = db.prepare(`
            SELECT summary, genres, rating, tmdb_id, imdb_id
            FROM media_library
            WHERE integration_instance_id = ? AND item_key = ?
            LIMIT 1
        `).get(integrationId, item.ratingKey) as {
            summary: string | null;
            genres: string | null;
            rating: number | null;
            tmdb_id: number | null;
            imdb_id: string | null;
        } | undefined;

        if (row) {
            enriched.summary = row.summary;
            enriched.genres = row.genres ? JSON.parse(row.genres) : null;
            enriched.rating = row.rating;
            enriched.tmdbId = row.tmdb_id;
            enriched.imdbId = row.imdb_id;
        }

        return enriched;
    });
}

// ============================================================================
// ROUTE
// ============================================================================

/**
 * GET /
 * 
 * Returns recommendation items from the specified integrations.
 * Each integration tries its native suggestion API first, then falls back
 * to random items from the synced library cache.
 * 
 * Query params:
 * - integrationIds: Comma-separated integration instance IDs (required)
 * - limit: Total items to return (default: 20, max: 30)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req.user as { id: string })?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const integrationIdsParam = req.query.integrationIds as string;
        if (!integrationIdsParam) {
            res.json({ items: [], source: 'none' });
            return;
        }

        const integrationIds = integrationIdsParam.split(',').filter(Boolean);
        if (integrationIds.length === 0) {
            res.json({ items: [], source: 'none' });
            return;
        }

        const limitParam = parseInt(req.query.limit as string, 10);
        const totalLimit = Math.min(Math.max(limitParam || 20, 1), 30);
        // Distribute limit across integrations
        const perIntegrationLimit = Math.ceil(totalLimit / integrationIds.length);

        let allItems: RecommendationItem[] = [];
        let hasPersonalized = false;

        // Fetch recommendations from each integration in parallel
        const perIntegrationResults = await Promise.all(
            integrationIds.map(async (integrationId) => {
                const instance = getInstanceById(integrationId);
                if (!instance || !instance.enabled) {
                    logger.debug(`[Recommendations] Skipping disabled/missing integration: ${integrationId}`);
                    return { items: [] as RecommendationItem[], isPersonalized: false };
                }

                const config = instance.config as Record<string, unknown>;
                const serverUrl = translateHostUrl(
                    (config.url as string || '').replace(/\/$/, '')
                );
                const integrationType = instance.type as 'plex' | 'jellyfin' | 'emby';

                if (!serverUrl) return { items: [] as RecommendationItem[], isPersonalized: false };

                let items: RecommendationItem[] | null = null;

                // Try type-specific suggestion API
                switch (integrationType) {
                    case 'plex': {
                        const plexToken = getPlexTokenForUser(userId);
                        if (plexToken) {
                            items = await fetchPlexHubs(serverUrl, plexToken, integrationId, perIntegrationLimit);
                        }
                        break;
                    }
                    case 'jellyfin':
                    case 'emby': {
                        const apiKey = config.apiKey as string;
                        const mediaUserId = config.userId as string;
                        if (apiKey && mediaUserId) {
                            items = await fetchMediaServerSuggestions(
                                serverUrl, apiKey, mediaUserId,
                                integrationId, integrationType, perIntegrationLimit
                            );
                        }
                        break;
                    }
                }

                // Got personalized results — enrich with local metadata
                if (items && items.length > 0) {
                    return { items: enrichWithLocalMetadata(items, integrationId), isPersonalized: true };
                }

                // Fallback: random from this integration's library cache
                return { items: fetchRandomFromLibrary(integrationId, integrationType, perIntegrationLimit), isPersonalized: false };
            })
        );

        // Merge all integration results
        for (const result of perIntegrationResults) {
            allItems.push(...result.items);
            if (result.isPersonalized) hasPersonalized = true;
        }

        // Determine source from actual fetch path, not heuristic
        let source: 'personalized' | 'random' | 'none' = 'none';
        if (allItems.length > 0) {
            source = hasPersonalized ? 'personalized' : 'random';
        }

        // Final shuffle to interleave items from different integrations
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }

        // Trim to requested limit
        allItems = allItems.slice(0, totalLimit);

        logger.debug(`[Recommendations] user=${userId} integrations=${integrationIds.length} source=${source} count=${allItems.length}`);
        res.json({ items: allItems, source });
    } catch (error) {
        logger.error(`[Recommendations] Failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

export default router;
