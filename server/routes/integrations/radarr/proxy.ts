/**
 * Radarr Proxy Routes
 * 
 * Handles Radarr API proxying:
 * - GET  /calendar          - Calendar data (SSE poller)
 * - GET  /missing           - Wanted/missing movies (paginated)
 * - GET  /cutoff            - Cutoff-unmet movies (paginated)
 * - GET  /release           - Interactive release search for a movie
 * - POST /release           - Grab a specific release
 * - POST /command           - Trigger commands (e.g., MoviesSearch)
 * - GET  /image             - Proxy movie poster images
 */

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { triggerTopicPoll } from '../../../services/sse/PollerOrchestrator';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';
import { PluginInstance } from '../../../integrations/types';

const router = Router();
const adapter = getPlugin('radarr')!.adapter;

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface RadarrSession {
    instance: PluginInstance;
    instanceId: string;
}

/**
 * Validates integration access and returns Radarr connection details.
 * Sends appropriate error responses and returns null if access is denied.
 */
async function withRadarrSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<RadarrSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    // Type-mismatch: let Express try the next matching router
    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'radarr') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('radarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.apiKey) {
        res.status(400).json({ error: 'Invalid Radarr configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

// ============================================================================
// READ ENDPOINTS (all authenticated users with access)
// ============================================================================

/**
 * GET /:id/proxy/calendar - Get Radarr calendar
 */
router.get('/:id/proxy/calendar', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next);
    if (!session) return;

    const { start, end } = req.query;

    try {
        const params: Record<string, unknown> = {};
        if (start) params.start = start;
        if (end) params.end = end;

        const response = await adapter.get!(session.instance, '/api/v3/calendar', {
            params,
            timeout: 10000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Radarr Proxy] Calendar error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Radarr calendar' });
    }
});

/**
 * GET /:id/proxy/missing - Get wanted/missing movies (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/missing', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await adapter.get!(session.instance, '/api/v3/wanted/missing', {
            params: {
                page,
                pageSize,
                sortKey: 'date',
                sortDirection: 'descending',
            },
            timeout: 15000,
        });

        // Filter out unreleased movies — "missing" should only show titles
        // that have actually been released but aren't in the library yet.
        // Radarr's API includes all monitored movies without files, including
        // announced/unreleased titles which belong in "upcoming", not "missing".
        const data = response.data;
        const records = (data.records || []).filter((movie: { status?: string }) => {
            const status = movie.status?.toLowerCase();
            return status === 'released' || status === 'incinemas';
        });

        res.json({
            ...data,
            records,
            totalRecords: records.length < data.records?.length
                ? data.totalRecords - (data.records.length - records.length)
                : data.totalRecords,
        });
    } catch (error) {
        logger.error(`[Radarr Proxy] Missing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch missing movies' });
    }
});

/**
 * GET /:id/proxy/cutoff - Get cutoff-unmet movies (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/cutoff', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await adapter.get!(session.instance, '/api/v3/wanted/cutoff', {
            params: {
                page,
                pageSize,
                sortKey: 'date',
                sortDirection: 'descending',
                includeMovie: true,
            },
            timeout: 15000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Radarr Proxy] Cutoff error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch cutoff-unmet movies' });
    }
});

/**
 * GET /:id/proxy/release - Search releases for a movie
 * Query: movieId (required)
 * Admin-only — interactive release search is an admin action
 */
router.get('/:id/proxy/release', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const movieId = parseInt(req.query.movieId as string);
    if (!movieId || isNaN(movieId)) {
        res.status(400).json({ error: 'movieId query parameter required' });
        return;
    }

    try {
        const response = await adapter.get!(session.instance, '/api/v3/release', {
            params: { movieId },
            timeout: 60000, // Release search can take a long time (indexer queries)
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Radarr Proxy] Release search error: movieId=${movieId} error="${(error as Error).message}"`);
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
    const session = await withRadarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { guid, indexerId, shouldOverride } = req.body as { guid?: string; indexerId?: number; shouldOverride?: boolean };
    if (!guid || indexerId === undefined) {
        res.status(400).json({ error: 'guid and indexerId required' });
        return;
    }

    try {
        const body: Record<string, unknown> = { guid, indexerId };
        if (shouldOverride) body.shouldOverride = true;

        await adapter.post!(session.instance, '/api/v3/release', body, {
            timeout: 15000,
        });

        logger.info(`[Radarr Proxy] Release grabbed: guid="${guid}" indexerId=${indexerId} override=${!!shouldOverride}`);
        res.json({ success: true });

        // Nudge SSE pollers to refresh data
        triggerTopicPoll(`radarr:${session.instanceId}`).catch(() => { });
        triggerTopicPoll(`radarr:missing:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[Radarr Proxy] Grab release error: guid="${guid}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to grab release' });
    }
});

/**
 * POST /:id/proxy/command - Trigger a Radarr command (e.g., MoviesSearch)
 * Body: { name: string, movieIds?: number[] }
 */
router.post('/:id/proxy/command', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { name, movieIds } = req.body as {
        name?: string;
        movieIds?: number[];
    };

    if (!name) {
        res.status(400).json({ error: 'command name required' });
        return;
    }

    // Whitelist allowed commands to prevent abuse
    const allowedCommands = ['MoviesSearch'];
    if (!allowedCommands.includes(name)) {
        res.status(400).json({ error: `Command "${name}" not allowed` });
        return;
    }

    try {
        const body: Record<string, unknown> = { name };
        if (movieIds) body.movieIds = movieIds;

        await adapter.post!(session.instance, '/api/v3/command', body, {
            timeout: 15000,
        });

        logger.info(`[Radarr Proxy] Command triggered: name="${name}" movieIds=${JSON.stringify(movieIds)}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Radarr Proxy] Command error: name="${name}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to trigger command' });
    }
});

// ============================================================================
// IMAGE PROXY
// ============================================================================

/**
 * GET /:id/proxy/image - Proxy movie poster images from Radarr
 * Query: url (relative path like /MediaCover/123/poster.jpg)
 * 
 * Proxies image requests through the backend to avoid CORS/auth issues.
 * Frontend never directly contacts the Radarr instance.
 */
router.get('/:id/proxy/image', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withRadarrSession(req, res, next);
    if (!session) return;

    const imgPath = req.query.url as string;
    if (!imgPath) {
        res.status(400).json({ error: 'url query parameter required' });
        return;
    }

    try {
        const isExternal = imgPath.startsWith('http');

        if (isExternal) {
            // External CDN URLs — no auth headers, plain axios fetch
            const response = await axios.get(imgPath, {
                timeout: 10000,
                responseType: 'arraybuffer',
            });

            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=14400'); // 4 hours
            res.send(response.data);
        } else {
            // Local Radarr URLs — use adapter for auth
            const response = await adapter.get!(session.instance, imgPath, {
                timeout: 10000,
                responseType: 'arraybuffer',
            });

            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=14400'); // 4 hours
            res.send(response.data);
        }
    } catch (error) {
        logger.error(`[Radarr Proxy] Image error: path="${imgPath}" error="${(error as Error).message}"`);
        res.status(502).json({ error: 'Failed to fetch image' });
    }
});

export default router;
