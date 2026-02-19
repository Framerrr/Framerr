/**
 * Sonarr Proxy Routes
 * 
 * Handles Sonarr API proxying:
 * - GET  /calendar          - Calendar data (SSE poller)
 * - GET  /missing           - Wanted/missing episodes (paginated)
 * - GET  /cutoff            - Cutoff-unmet episodes (paginated)
 * - GET  /release           - Interactive release search for an episode
 * - POST /release           - Grab a specific release
 * - POST /command           - Trigger commands (e.g., EpisodeSearch)
 * - GET  /image             - Proxy series poster images
 */

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { triggerTopicPoll } from '../../../services/sse/PollerOrchestrator';

const router = Router();

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface SonarrSession {
    url: string;
    apiKey: string;
    instanceId: string;
}

/**
 * Validates integration access and returns Sonarr connection details.
 * Sends appropriate error responses and returns null if access is denied.
 */
async function withSonarrSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<SonarrSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    // Type-mismatch: let Express try the next matching router
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'sonarr') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('sonarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const url = (instance.config.url as string)?.replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Sonarr configuration' });
        return null;
    }

    return { url, apiKey, instanceId: id };
}

/** Standard headers for Sonarr API requests */
function sonarrHeaders(apiKey: string): Record<string, string> {
    return { 'X-Api-Key': apiKey };
}

// ============================================================================
// READ ENDPOINTS (all authenticated users with access)
// ============================================================================

/**
 * GET /:id/proxy/calendar - Get Sonarr calendar
 */
router.get('/:id/proxy/calendar', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next);
    if (!session) return;

    const { start, end, includeSeries } = req.query;

    try {
        const queryParams = new URLSearchParams();
        if (start) queryParams.set('start', start as string);
        if (end) queryParams.set('end', end as string);
        if (includeSeries) queryParams.set('includeSeries', 'true');

        const response = await axios.get(`${session.url}/api/v3/calendar?${queryParams}`, {
            headers: sonarrHeaders(session.apiKey),
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Calendar error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Sonarr calendar' });
    }
});

/**
 * GET /:id/proxy/missing - Get wanted/missing episodes (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/missing', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await axios.get(`${session.url}/api/v3/wanted/missing`, {
            params: {
                page,
                pageSize,
                sortKey: 'airDateUtc',
                sortDirection: 'descending',
                includeSeries: true,
            },
            headers: sonarrHeaders(session.apiKey),
            httpsAgent,
            timeout: 15000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Missing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch missing episodes' });
    }
});

/**
 * GET /:id/proxy/cutoff - Get cutoff-unmet episodes (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/cutoff', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await axios.get(`${session.url}/api/v3/wanted/cutoff`, {
            params: {
                page,
                pageSize,
                sortKey: 'airDateUtc',
                sortDirection: 'descending',
                includeSeries: true,
            },
            headers: sonarrHeaders(session.apiKey),
            httpsAgent,
            timeout: 15000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Cutoff error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch cutoff-unmet episodes' });
    }
});

/**
 * GET /:id/proxy/release - Search releases for an episode
 * Query: episodeId (required)
 * Admin-only — interactive release search is an admin action
 */
router.get('/:id/proxy/release', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const episodeId = parseInt(req.query.episodeId as string);
    if (!episodeId || isNaN(episodeId)) {
        res.status(400).json({ error: 'episodeId query parameter required' });
        return;
    }

    try {
        const response = await axios.get(`${session.url}/api/v3/release`, {
            params: { episodeId },
            headers: sonarrHeaders(session.apiKey),
            httpsAgent,
            timeout: 60000 // Release search can take a long time (indexer queries)
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Release search error: episodeId=${episodeId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to search releases' });
    }
});

// ============================================================================
// ACTION ENDPOINTS (admin-only)
// ============================================================================

/**
 * POST /:id/proxy/release - Grab a specific release
 * Body: { guid: string, indexerId: number, shouldOverride?: boolean }
 */
router.post('/:id/proxy/release', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { guid, indexerId, shouldOverride } = req.body as { guid?: string; indexerId?: number; shouldOverride?: boolean };
    if (!guid || indexerId === undefined) {
        res.status(400).json({ error: 'guid and indexerId required' });
        return;
    }

    try {
        const body: Record<string, unknown> = { guid, indexerId };
        if (shouldOverride) body.shouldOverride = true;

        await axios.post(`${session.url}/api/v3/release`, body, {
            headers: {
                ...sonarrHeaders(session.apiKey),
                'Content-Type': 'application/json',
            },
            httpsAgent,
            timeout: 15000
        });

        logger.info(`[Sonarr Proxy] Release grabbed: guid="${guid}" indexerId=${indexerId} override=${!!shouldOverride}`);
        res.json({ success: true });

        // Nudge SSE pollers to refresh data
        triggerTopicPoll(`sonarr:${session.instanceId}`).catch(() => { });
        triggerTopicPoll(`sonarr:missing:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[Sonarr Proxy] Grab release error: guid="${guid}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to grab release' });
    }
});

/**
 * POST /:id/proxy/command - Trigger a Sonarr command (e.g., EpisodeSearch)
 * Body: { name: string, episodeIds?: number[], seriesId?: number }
 */
router.post('/:id/proxy/command', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { name, episodeIds, seriesId } = req.body as {
        name?: string;
        episodeIds?: number[];
        seriesId?: number;
    };

    if (!name) {
        res.status(400).json({ error: 'command name required' });
        return;
    }

    // Whitelist allowed commands to prevent abuse
    const allowedCommands = ['EpisodeSearch', 'SeriesSearch', 'SeasonSearch'];
    if (!allowedCommands.includes(name)) {
        res.status(400).json({ error: `Command "${name}" not allowed` });
        return;
    }

    try {
        const body: Record<string, unknown> = { name };
        if (episodeIds) body.episodeIds = episodeIds;
        if (seriesId !== undefined) body.seriesId = seriesId;

        await axios.post(`${session.url}/api/v3/command`, body, {
            headers: {
                ...sonarrHeaders(session.apiKey),
                'Content-Type': 'application/json',
            },
            httpsAgent,
            timeout: 15000
        });

        logger.info(`[Sonarr Proxy] Command triggered: name="${name}" episodeIds=${JSON.stringify(episodeIds)}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Sonarr Proxy] Command error: name="${name}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to trigger command' });
    }
});

// ============================================================================
// IMAGE PROXY
// ============================================================================

/**
 * GET /:id/proxy/image - Proxy series poster images from Sonarr
 * Query: url (relative path like /MediaCover/123/poster.jpg)
 * 
 * Proxies image requests through the backend to avoid CORS/auth issues.
 * Frontend never directly contacts the Sonarr instance.
 */
router.get('/:id/proxy/image', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withSonarrSession(req, res, next);
    if (!session) return;

    const imgPath = req.query.url as string;
    if (!imgPath) {
        res.status(400).json({ error: 'url query parameter required' });
        return;
    }

    try {
        // Sonarr provides image URLs as relative paths like /MediaCover/123/poster.jpg
        // OR external URLs like https://artworks.thetvdb.com/banners/posters/74796-3.jpg
        const isExternal = imgPath.startsWith('http');
        const imageUrl = isExternal
            ? imgPath
            : `${session.url}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;

        // Only send Sonarr API key for local Sonarr URLs, not external CDNs
        const headers: Record<string, string> = isExternal ? {} : sonarrHeaders(session.apiKey);

        const response = await axios.get(imageUrl, {
            headers,
            httpsAgent,
            timeout: 10000,
            responseType: 'arraybuffer',
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // 1 day
        res.send(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Image error: path="${imgPath}" error="${(error as Error).message}"`);
        res.status(502).json({ error: 'Failed to fetch image' });
    }
});

export default router;
