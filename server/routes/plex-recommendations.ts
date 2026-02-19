/**
 * Plex Recommendations Route
 * 
 * GET /api/plex/recommendations
 * Returns personalized (Plex /hubs) or random (local library) recommendations.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../database/db';
import { getPlexTokenForUser } from '../db/linkedAccounts';
import { getInstancesByType } from '../db/integrationInstances';
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
// HELPERS
// ============================================================================

/**
 * Fetch personalized recommendations from Plex /hubs using user's stored token.
 */
async function fetchPlexHubs(
    serverUrl: string,
    userToken: string,
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
                // Only include movies and shows
                if (item.type !== 'movie' && item.type !== 'show') continue;
                seen.add(item.ratingKey);
                allItems.push({
                    ratingKey: item.ratingKey,
                    title: item.title,
                    year: item.year ?? null,
                    mediaType,
                    thumb: item.thumb || null,
                    integrationId: '', // filled in by caller
                    summary: null, genres: null, rating: null, tmdbId: null, imdbId: null, // enriched later
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
        logger.warn(`[Recommendations] Plex /hubs failed: status=${status} error="${(error as Error).message}"`);
        return null; // Signals fallback to random
    }
}

/**
 * Fetch random items from the local media_library table.
 */
function fetchRandomFromLibrary(
    integrationId: string,
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
            summary: row.summary,
            genres: row.genres ? JSON.parse(row.genres) : null,
            rating: row.rating,
            tmdbId: row.tmdb_id,
            imdbId: row.imdb_id,
        }));
    } catch (error) {
        logger.error(`[Recommendations] Random library query failed: error="${(error as Error).message}"`);
        return [];
    }
}

// ============================================================================
// ROUTE
// ============================================================================

/**
 * GET /
 * 
 * Returns recommendation items for the current user.
 * Tries personalized Plex hubs first, falls back to random library items.
 * 
 * Query params:
 * - limit: Number of items to return (default: 20, max: 30)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req.user as { id: string })?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const limitParam = parseInt(req.query.limit as string, 10);
        const limit = Math.min(Math.max(limitParam || 20, 1), 30);

        // Find first enabled Plex integration (for server URL and image proxy)
        const plexInstances = getInstancesByType('plex').filter(i => i.enabled);
        if (plexInstances.length === 0) {
            res.json({ items: [], source: 'none' });
            return;
        }

        const plexInstance = plexInstances[0];
        const integrationId = plexInstance.id;
        const serverUrl = translateHostUrl(
            ((plexInstance.config as Record<string, unknown>).url as string || '').replace(/\/$/, '')
        );

        if (!serverUrl) {
            res.json({ items: [], source: 'none' });
            return;
        }

        // Try personalized recommendations first
        const userToken = getPlexTokenForUser(userId);
        let items: RecommendationItem[] = [];
        let source: 'personalized' | 'random' | 'none' = 'none';

        if (userToken) {
            const hubItems = await fetchPlexHubs(serverUrl, userToken, limit);
            if (hubItems && hubItems.length > 0) {
                const db = getDb();
                // Fill in integrationId, proxy URL, and enrich with local metadata
                items = hubItems.map(item => {
                    const enriched = { ...item, integrationId };
                    enriched.thumb = item.thumb
                        ? (() => {
                            const localUrl = getLocalLibraryImageUrl(integrationId, item.ratingKey);
                            return localUrl ? `${localUrl}?size=lg` : item.thumb;
                        })()
                        : null;
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
                source = 'personalized';
            }
        }

        // Fallback: random from local library
        if (items.length === 0) {
            items = fetchRandomFromLibrary(integrationId, limit);
            if (items.length > 0) {
                source = 'random';
            }
        }

        logger.debug(`[Recommendations] user=${userId} source=${source} count=${items.length}`);
        res.json({ items, source });
    } catch (error) {
        logger.error(`[Recommendations] Failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

export default router;
