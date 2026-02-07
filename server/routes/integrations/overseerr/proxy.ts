/**
 * Overseerr Proxy Routes
 * 
 * Handles Overseerr API proxying:
 * - /requests - Get request list
 * - /request/:requestId/details - Get request details
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * GET /:id/proxy/requests - Get Overseerr requests
 */
router.get('/:id/proxy/requests', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('overseerr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Overseerr configuration' });
        return;
    }

    try {
        // Get requests from Overseerr
        const response = await axios.get(`${url}/api/v1/request`, {
            headers: { 'X-Api-Key': apiKey },
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
                            `${url}/api/v1/${mediaType}/${request.media.tmdbId}`,
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
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('overseerr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Overseerr configuration' });
        return;
    }

    try {
        // Fetch request details
        const requestResponse = await axios.get(`${url}/api/v1/request/${requestId}`, {
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
                    `${url}/api/v1/${mediaType}/${requestData.media.tmdbId}`,
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
                    // Credits data if available
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
                // Continue without TMDB data
            }
        }

        res.json({
            request: requestData,
            tmdb: tmdbData
        });
    } catch (error) {
        logger.error(`[Overseerr Proxy] Request details error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch request details' });
    }
});

export default router;
