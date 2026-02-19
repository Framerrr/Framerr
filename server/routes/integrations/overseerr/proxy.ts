/**
 * Overseerr Proxy Routes
 * 
 * Handles Overseerr API proxying:
 * - /requests - Get request list
 * - /request/:requestId/details - Get request details
 * - /search - Search TMDB via Overseerr
 * - /request - Create a request
 * - /tv/:tmdbId - TV details for season picker
 * - /user/quota - User's quota status
 * - /user/permissions - User's permission flags
 * - /servers - Radarr/Sonarr server list (4K detection)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { getLinkedAccount } from '../../../db/linkedAccounts';
import { translateHostUrl } from '../../../utils/urlHelper';

const router = Router();

// ============================================================================
// Simple In-Memory Cache (60s TTL)
// ============================================================================

interface CacheEntry {
    data: unknown;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached(key: string): unknown | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: unknown): void {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// Per-User Rate Limiting (2 req/s for search)
// ============================================================================

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const RATE_LIMIT_MAX = 2; // max requests per window

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];
    // Remove expired timestamps
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length >= RATE_LIMIT_MAX) {
        rateLimitMap.set(userId, valid);
        return true;
    }
    valid.push(now);
    rateLimitMap.set(userId, valid);
    return false;
}

// ============================================================================
// Shared Helpers
// ============================================================================

interface InstanceResult {
    baseUrl: string;
    apiKey: string;
}

/**
 * Validate instance access and return config or send error response.
 */
async function validateInstance(
    req: Request,
    res: Response,
    id: string
): Promise<InstanceResult | null> {
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return null;
    }

    const isAdmin = req.user!.group === 'admin';
    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('overseerr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Overseerr configuration' });
        return null;
    }

    return { baseUrl: translateHostUrl(url), apiKey };
}

// ============================================================================
// Existing Routes
// ============================================================================

/**
 * GET /:id/proxy/requests - Get Overseerr requests
 */
router.get('/:id/proxy/requests', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    try {
        // Check seeAllRequests config toggle
        const instance = integrationInstancesDb.getInstanceById(id);
        const rawSeeAll = instance?.config?.seeAllRequests;
        const seeAllRequests = rawSeeAll === undefined ? true : !!rawSeeAll; // undefined=true (backward compat), ''=false (checkbox off)
        const userId = (req.user as { id?: string })?.id;
        const isAdmin = req.user!.group === 'admin';

        // Build request headers
        const headers: Record<string, string> = { 'X-Api-Key': apiKey };

        // When seeAllRequests is OFF, scope the API call to the linked user
        // Framerr admins always bypass filtering
        if (!seeAllRequests && !isAdmin && userId) {
            const linkedAccount = getLinkedAccount(userId, 'overseerr');

            if (!linkedAccount) {
                // Not linked — return empty results
                res.json({ results: [], pageInfo: { pages: 0, results: 0 } });
                return;
            }

            // Check if user has ADMIN (0x2) or MANAGE_REQUESTS (0x4000) permission
            const permissions = (linkedAccount.metadata?.permissions as number) || 0;
            const hasManageRequests = (permissions & (0x2 | 0x4000)) !== 0;

            if (!hasManageRequests) {
                // Scope to this user's requests via X-Api-User header
                headers['X-Api-User'] = linkedAccount.externalId;
            }
        }

        // Get requests from Overseerr
        const response = await axios.get(`${baseUrl}/api/v1/request`, {
            headers,
            httpsAgent,
            timeout: 10000
        });

        const requests = response.data.results || [];

        // Enrich with TMDB data if available
        const enrichedRequests = await Promise.all(
            requests.map(async (request: { media?: { mediaType?: string; tmdbId?: number } }) => {
                if (request.media?.tmdbId) {
                    try {
                        const mediaType = request.media.mediaType === 'tv' ? 'tv' : 'movie';
                        const tmdbResponse = await axios.get(
                            `${baseUrl}/api/v1/${mediaType}/${request.media.tmdbId}`,
                            {
                                headers: { 'X-Api-Key': apiKey },
                                httpsAgent,
                                timeout: 5000
                            }
                        );
                        return {
                            ...request,
                            mediaInfo: tmdbResponse.data
                        };
                    } catch {
                        return request;
                    }
                }
                return request;
            })
        );

        res.json({ results: enrichedRequests, pageInfo: response.data.pageInfo });
    } catch (error) {
        logger.error(`[Overseerr Proxy] Requests error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Overseerr requests' });
    }
});

/**
 * GET /:id/proxy/request/:requestId/details - Get request details with TMDB data
 */
router.get('/:id/proxy/request/:requestId/details', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id, requestId } = req.params;
    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    try {
        // Fetch request details
        const requestResponse = await axios.get(`${baseUrl}/api/v1/request/${requestId}`, {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 10000
        });

        const requestData = requestResponse.data;

        // Fetch TMDB data if we have a tmdbId
        let tmdbData = null;
        if (requestData.media?.tmdbId) {
            try {
                const mediaType = requestData.type === 'tv' ? 'tv' : 'movie';
                const tmdbResponse = await axios.get(
                    `${baseUrl}/api/v1/${mediaType}/${requestData.media.tmdbId}`,
                    {
                        headers: { 'X-Api-Key': apiKey },
                        httpsAgent,
                        timeout: 10000
                    }
                );

                const tmdb = tmdbResponse.data;
                tmdbData = {
                    title: tmdb.title || tmdb.name,
                    posterPath: tmdb.posterPath,
                    backdropPath: tmdb.backdropPath,
                    overview: tmdb.overview,
                    releaseDate: tmdb.releaseDate || tmdb.firstAirDate,
                    rating: tmdb.voteAverage,
                    genres: tmdb.genres?.map((g: { name: string }) => g.name) || [],
                    runtime: tmdb.runtime,
                    status: tmdb.status,
                    tagline: tmdb.tagline,
                    numberOfSeasons: tmdb.numberOfSeasons,
                    imdbId: tmdb.externalIds?.imdbId || null,
                    directors: tmdb.credits?.crew
                        ?.filter((c: { job?: string }) => c.job === 'Director')
                        ?.map((c: { name: string }) => c.name) || [],
                    cast: tmdb.credits?.cast?.slice(0, 10)?.map((c: { name: string; character?: string; profilePath?: string }) => ({
                        name: c.name,
                        character: c.character,
                        profilePath: c.profilePath
                    })) || [],
                    productionCompanies: tmdb.productionCompanies?.map((c: { name: string }) => c.name) || [],
                    networks: tmdb.networks?.map((n: { name: string }) => n.name) || []
                };
            } catch (tmdbError) {
                logger.warn(`[Overseerr Proxy] Failed to fetch TMDB data: error="${(tmdbError as Error).message}"`);
            }
        }

        // For TV shows, extract all seasons across ALL requests for this media
        // so the modal can show complete season availability (not just one request's)
        let allSeasons: Array<{ seasonNumber: number; status: number }> | null = null;

        if (requestData.type === 'tv' && requestData.media?.tmdbId) {
            try {
                const tvCacheKey = `tv:${id}:${requestData.media.tmdbId}`;
                let tvDetails = getCached(tvCacheKey) as any;
                if (!tvDetails) {
                    const tvRes = await axios.get(
                        `${baseUrl}/api/v1/tv/${requestData.media.tmdbId}`,
                        {
                            headers: { 'X-Api-Key': apiKey },
                            httpsAgent,
                            timeout: 10000,
                        }
                    );
                    tvDetails = tvRes.data;
                    setCache(tvCacheKey, tvDetails);
                }

                // Merge seasons from ALL requests (keep highest status per season)
                const seasonMap = new Map<number, { seasonNumber: number; status: number }>();

                // From requests[].seasons (request tracking)
                if (tvDetails.mediaInfo?.requests) {
                    for (const req of tvDetails.mediaInfo.requests) {
                        for (const s of (req.seasons || [])) {
                            const existing = seasonMap.get(s.seasonNumber);
                            if (!existing || s.status > existing.status) {
                                seasonMap.set(s.seasonNumber, {
                                    seasonNumber: s.seasonNumber,
                                    status: s.status,
                                });
                            }
                        }
                    }
                }

                // From mediaInfo.seasons (availability tracking — may have higher status)
                if (tvDetails.mediaInfo?.seasons) {
                    for (const s of tvDetails.mediaInfo.seasons) {
                        const existing = seasonMap.get(s.seasonNumber);
                        if (!existing || s.status > existing.status) {
                            seasonMap.set(s.seasonNumber, {
                                seasonNumber: s.seasonNumber,
                                status: s.status,
                            });
                        }
                    }
                }

                if (seasonMap.size > 0) {
                    allSeasons = Array.from(seasonMap.values())
                        .sort((a, b) => a.seasonNumber - b.seasonNumber);
                }
            } catch (tvErr) {
                logger.debug(`[Overseerr Proxy] Could not fetch TV details for allSeasons: error="${(tvErr as Error).message}"`);
            }
        }

        res.json({
            request: requestData,
            tmdb: tmdbData,
            ...(allSeasons && { allSeasons }),
        });
    } catch (error) {
        logger.error(`[Overseerr Proxy] Request details error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch request details' });
    }
});

// ============================================================================
// Phase 2: Requesting Feature Routes
// ============================================================================

/**
 * GET /:id/proxy/search - Search TMDB via Overseerr
 * Rate-limited: 2 requests per second per user
 * Cached: 60s by query+page
 */
router.get('/:id/proxy/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { query: rawQuery, page = '1' } = req.query;
    const userId = req.user!.id;

    // Trim and validate the query
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    if (!query || query.length < 2) {
        res.status(400).json({ error: 'Query must be at least 2 characters' });
        return;
    }

    // Rate limit check
    if (isRateLimited(userId)) {
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return;
    }

    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    // Check cache
    const cacheKey = `search:${id}:${query}:${page}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.json(cached);
        return;
    }

    try {
        // Build URL with explicit encoding — Overseerr is strict about
        // reserved characters and rejects queries with unencoded spaces
        const searchUrl = `${baseUrl}/api/v1/search?query=${encodeURIComponent(query)}&page=${encodeURIComponent(String(page))}`;
        const response = await axios.get(searchUrl, {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 15000,
        });

        // Limit to 10 results per the design spec
        const data = {
            results: (response.data.results || []).slice(0, 10) as any[],
            pageInfo: response.data.pageInfo,
        };

        // Enrich TV shows (status 2-4) with per-season request counts
        // so the frontend can distinguish partial from full requests
        data.results = await Promise.all(
            data.results.map(async (item: any) => {
                if (item.mediaType !== 'tv' || !item.mediaInfo || item.mediaInfo.status < 2 || item.mediaInfo.status >= 5) {
                    return item;
                }

                // Fetch TV details (uses cache if available)
                const tvCacheKey = `tv:${id}:${item.id}`;
                let tvDetails = getCached(tvCacheKey) as any;
                if (!tvDetails) {
                    try {
                        const tvRes = await axios.get(`${baseUrl}/api/v1/tv/${item.id}`, {
                            headers: { 'X-Api-Key': apiKey },
                            httpsAgent,
                            timeout: 10000,
                        });
                        tvDetails = tvRes.data;
                        setCache(tvCacheKey, tvDetails);
                    } catch {
                        return item; // Skip enrichment on error
                    }
                }

                // Count total seasons (excluding specials) and requested/available seasons
                const totalSeasons = (tvDetails.seasons || []).filter((s: any) => s.seasonNumber > 0).length;
                const requestedSeasons = new Set<number>();

                // Check requests[].seasons (request tracking)
                if (tvDetails.mediaInfo?.requests) {
                    for (const req of tvDetails.mediaInfo.requests) {
                        for (const s of (req.seasons || [])) {
                            if (s.status >= 2) requestedSeasons.add(s.seasonNumber);
                        }
                    }
                }
                // Check mediaInfo.seasons (availability tracking)
                if (tvDetails.mediaInfo?.seasons) {
                    for (const s of tvDetails.mediaInfo.seasons) {
                        if (s.status >= 2) requestedSeasons.add(s.seasonNumber);
                    }
                }

                return {
                    ...item,
                    mediaInfo: {
                        ...item.mediaInfo,
                        requestedSeasonCount: requestedSeasons.size,
                        totalSeasonCount: totalSeasons,
                    },
                };
            })
        );

        setCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        const axiosErr = error as any;
        const status = axiosErr?.response?.status;
        const detail = axiosErr?.response?.data?.message || axiosErr?.message || 'Unknown';
        logger.error(`[Overseerr Proxy] Search error: status=${status} detail="${detail}" query="${query}"`);
        res.status(500).json({ error: 'Failed to search Overseerr' });
    }
});

/**
 * POST /:id/proxy/request - Create a media request
 * Requires linked Overseerr account for X-Api-User header (non-admins)
 */
router.post('/:id/proxy/request', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.group === 'admin';

    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    // Build headers — include X-Api-User for non-admin users with linked accounts
    const headers: Record<string, string> = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' };

    if (!isAdmin) {
        const overseerrLink = getLinkedAccount(userId, 'overseerr');
        if (!overseerrLink) {
            res.status(403).json({ error: 'You must link your Overseerr account to make requests.' });
            return;
        }
        headers['X-Api-User'] = overseerrLink.externalId;
    }

    try {
        const response = await axios.post(`${baseUrl}/api/v1/request`, req.body, {
            headers,
            httpsAgent,
            timeout: 15000,
        });

        // Invalidate caches so follow-up fetches get fresh status
        const mediaId = req.body?.mediaId;
        if (mediaId) {
            cache.delete(`tv:${id}:${mediaId}`);
        }
        // Invalidate all search caches for this instance (status changed)
        for (const key of cache.keys()) {
            if (key.startsWith(`search:${id}:`)) cache.delete(key);
        }

        res.json(response.data);
    } catch (error) {
        const axiosErr = error as { response?: { status: number; data?: { message?: string } }; message: string };
        const status = axiosErr.response?.status || 500;
        const message = axiosErr.response?.data?.message || axiosErr.message;

        logger.error(`[Overseerr Proxy] Request error: status=${status} error="${message}"`);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /:id/proxy/tv/:tmdbId - Get TV show details (for season picker)
 * Cached: 60s
 */
router.get('/:id/proxy/tv/:tmdbId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id, tmdbId } = req.params;

    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    const cacheKey = `tv:${id}:${tmdbId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.json(cached);
        return;
    }

    try {
        const response = await axios.get(`${baseUrl}/api/v1/tv/${tmdbId}`, {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 15000,
        });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        logger.error(`[Overseerr Proxy] TV details error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch TV details' });
    }
});

/**
 * GET /:id/proxy/user/quota - Get current user's Overseerr quota
 * Requires linked Overseerr account
 */
router.get('/:id/proxy/user/quota', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    const overseerrLink = getLinkedAccount(userId, 'overseerr');
    if (!overseerrLink) {
        res.status(403).json({ error: 'Overseerr account not linked' });
        return;
    }

    const cacheKey = `quota:${id}:${overseerrLink.externalId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.json(cached);
        return;
    }

    try {
        const response = await axios.get(
            `${baseUrl}/api/v1/user/${overseerrLink.externalId}/quota`,
            {
                headers: { 'X-Api-Key': apiKey },
                httpsAgent,
                timeout: 10000,
            }
        );

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        logger.error(`[Overseerr Proxy] Quota error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch user quota' });
    }
});

/**
 * GET /:id/proxy/user/permissions - Get current user's Overseerr permissions
 * Returns cached permissions from linked_accounts metadata if available
 */
router.get('/:id/proxy/user/permissions', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.group === 'admin';

    const result = await validateInstance(req, res, id);
    if (!result) return;

    // Framerr admins get full permissions
    if (isAdmin) {
        res.json({ permissions: 0xFFFFFFFF, isAdmin: true });
        return;
    }

    const overseerrLink = getLinkedAccount(userId, 'overseerr');
    if (!overseerrLink) {
        res.status(403).json({ error: 'Overseerr account not linked' });
        return;
    }

    // Use cached permissions from metadata (refreshed at auto-match triggers)
    const cachedPermissions = overseerrLink.metadata?.permissions;
    if (typeof cachedPermissions === 'number') {
        res.json({ permissions: cachedPermissions, isAdmin: false });
        return;
    }

    // Fallback: fetch live from Overseerr if no cached permissions
    const { baseUrl, apiKey } = result;

    try {
        const response = await axios.get(
            `${baseUrl}/api/v1/user/${overseerrLink.externalId}`,
            {
                headers: { 'X-Api-Key': apiKey },
                httpsAgent,
                timeout: 10000,
            }
        );

        res.json({ permissions: response.data.permissions, isAdmin: false });
    } catch (error) {
        logger.error(`[Overseerr Proxy] Permissions error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
});

/**
 * GET /:id/proxy/servers - Get Radarr/Sonarr server list (4K detection)
 * Cached: 60s (server lists change rarely)
 */
router.get('/:id/proxy/servers', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const result = await validateInstance(req, res, id);
    if (!result) return;

    const { baseUrl, apiKey } = result;

    const cacheKey = `servers:${id}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.json(cached);
        return;
    }

    try {
        // Fetch both Radarr and Sonarr settings in parallel
        const [radarrRes, sonarrRes] = await Promise.all([
            axios.get(`${baseUrl}/api/v1/settings/radarr`, {
                headers: { 'X-Api-Key': apiKey },
                httpsAgent,
                timeout: 10000,
            }).catch(() => ({ data: [] })),
            axios.get(`${baseUrl}/api/v1/settings/sonarr`, {
                headers: { 'X-Api-Key': apiKey },
                httpsAgent,
                timeout: 10000,
            }).catch(() => ({ data: [] })),
        ]);

        const data = {
            radarr: radarrRes.data || [],
            sonarr: sonarrRes.data || [],
        };

        setCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        logger.error(`[Overseerr Proxy] Servers error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch server list' });
    }
});

export default router;

// Exported for testing only — clears caches and rate limits
export function __resetForTesting(): void {
    cache.clear();
    rateLimitMap.clear();
}
