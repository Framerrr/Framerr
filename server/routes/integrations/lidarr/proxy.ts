/**
 * Lidarr Proxy Routes
 * 
 * Handles Lidarr API proxying:
 * - GET  /calendar          - Calendar data (SSE poller)
 * - GET  /missing           - Wanted/missing albums (paginated)
 * - GET  /cutoff            - Cutoff-unmet albums (paginated)
 * - GET  /release           - Interactive release search for an album
 * - POST /release           - Grab a specific release
 * - POST /command           - Trigger commands (e.g., AlbumSearch)
 * - GET  /image             - Proxy artist/album cover images
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
const adapter = getPlugin('lidarr')!.adapter;

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface LidarrSession {
    instance: PluginInstance;
    instanceId: string;
}

/**
 * Validates integration access and returns Lidarr connection details.
 * Sends appropriate error responses and returns null if access is denied.
 */
async function withLidarrSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<LidarrSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    // Type-mismatch: let Express try the next matching router
    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'lidarr') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('lidarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.apiKey) {
        res.status(400).json({ error: 'Invalid Lidarr configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

// ============================================================================
// READ ENDPOINTS (all authenticated users with access)
// ============================================================================

/**
 * GET /:id/proxy/calendar - Get Lidarr calendar
 */
router.get('/:id/proxy/calendar', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next);
    if (!session) return;

    const { start, end, includeArtist } = req.query;

    try {
        const params: Record<string, unknown> = {};
        if (start) params.start = start;
        if (end) params.end = end;
        if (includeArtist) params.includeArtist = true;

        const response = await adapter.get!(session.instance, '/api/v1/calendar', {
            params,
            timeout: 10000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Lidarr Proxy] Calendar error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Lidarr calendar' });
    }
});

/**
 * GET /:id/proxy/missing - Get wanted/missing albums (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/missing', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await adapter.get!(session.instance, '/api/v1/wanted/missing', {
            params: {
                page,
                pageSize,
                sortKey: 'releaseDate',
                sortDirection: 'descending',
                includeArtist: true,
            },
            timeout: 15000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Lidarr Proxy] Missing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch missing albums' });
    }
});

/**
 * GET /:id/proxy/cutoff - Get cutoff-unmet albums (paginated)
 * Query: page (default 1), pageSize (default 25)
 */
router.get('/:id/proxy/cutoff', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await adapter.get!(session.instance, '/api/v1/wanted/cutoff', {
            params: {
                page,
                pageSize,
                sortKey: 'releaseDate',
                sortDirection: 'descending',
                includeArtist: true,
            },
            timeout: 15000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Lidarr Proxy] Cutoff error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch cutoff-unmet albums' });
    }
});

/**
 * GET /:id/proxy/release - Search releases for an album
 * Query: albumId (required)
 * Admin-only — interactive release search is an admin action
 */
router.get('/:id/proxy/release', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const albumId = parseInt(req.query.albumId as string);
    if (!albumId || isNaN(albumId)) {
        res.status(400).json({ error: 'albumId query parameter required' });
        return;
    }

    try {
        const response = await adapter.get!(session.instance, '/api/v1/release', {
            params: { albumId },
            timeout: 60000, // Release search can take a long time (indexer queries)
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Lidarr Proxy] Release search error: albumId=${albumId} error="${(error as Error).message}"`);
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
    const session = await withLidarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { guid, indexerId, shouldOverride } = req.body as { guid?: string; indexerId?: number; shouldOverride?: boolean };
    if (!guid || indexerId === undefined) {
        res.status(400).json({ error: 'guid and indexerId required' });
        return;
    }

    try {
        const body: Record<string, unknown> = { guid, indexerId };
        if (shouldOverride) body.shouldOverride = true;

        await adapter.post!(session.instance, '/api/v1/release', body, {
            timeout: 15000,
        });

        logger.info(`[Lidarr Proxy] Release grabbed: guid="${guid}" indexerId=${indexerId} override=${!!shouldOverride}`);
        res.json({ success: true });

        // Nudge SSE pollers to refresh data
        triggerTopicPoll(`lidarr:${session.instanceId}`).catch(() => { });
        triggerTopicPoll(`lidarr:missing:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[Lidarr Proxy] Grab release error: guid="${guid}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to grab release' });
    }
});

/**
 * POST /:id/proxy/command - Trigger a Lidarr command (e.g., AlbumSearch)
 * Body: { name: string, albumIds?: number[], artistId?: number }
 */
router.post('/:id/proxy/command', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { name, albumIds, artistId } = req.body as {
        name?: string;
        albumIds?: number[];
        artistId?: number;
    };

    if (!name) {
        res.status(400).json({ error: 'command name required' });
        return;
    }

    // Whitelist allowed commands to prevent abuse
    const allowedCommands = ['AlbumSearch', 'ArtistSearch', 'MissingAlbumSearch'];
    if (!allowedCommands.includes(name)) {
        res.status(400).json({ error: `Command "${name}" not allowed` });
        return;
    }

    try {
        const body: Record<string, unknown> = { name };
        if (albumIds) body.albumIds = albumIds;
        if (artistId !== undefined) body.artistId = artistId;

        await adapter.post!(session.instance, '/api/v1/command', body, {
            timeout: 15000,
        });

        logger.info(`[Lidarr Proxy] Command triggered: name="${name}" albumIds=${JSON.stringify(albumIds)}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Lidarr Proxy] Command error: name="${name}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to trigger command' });
    }
});

// ============================================================================
// IMAGE PROXY
// ============================================================================

/**
 * GET /:id/proxy/image - Proxy artist/album cover images from Lidarr
 * Query: url (relative path like /MediaCover/123/cover.jpg)
 * 
 * Proxies image requests through the backend to avoid CORS/auth issues.
 * Frontend never directly contacts the Lidarr instance.
 */
router.get('/:id/proxy/image', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withLidarrSession(req, res, next);
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
            // Local Lidarr URLs — use adapter for auth
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
        logger.error(`[Lidarr Proxy] Image error: path="${imgPath}" error="${(error as Error).message}"`);
        res.status(502).json({ error: 'Failed to fetch image' });
    }
});

export default router;
