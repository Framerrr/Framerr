/**
 * SABnzbd Proxy Routes
 * 
 * Handles SABnzbd API proxying:
 * - GET  /:id/proxy/sab/queue        - Queue (active downloads)
 * - GET  /:id/proxy/sab/history      - History (completed/failed)
 * - GET  /:id/proxy/sab/files/:nzoId - Files in a job
 * - GET  /:id/proxy/sab/servers      - Usenet server status
 * - POST /:id/proxy/sab/pause        - Pause item or all
 * - POST /:id/proxy/sab/resume       - Resume item or all
 * - POST /:id/proxy/sab/delete       - Delete item
 * - POST /:id/proxy/sab/priority     - Change item priority
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { translateHostUrl } from '../../../utils/urlHelper';
import { triggerTopicPoll } from '../../../services/sse/PollerOrchestrator';

const router = Router();

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface SabSession {
    url: string;
    apiKey: string;
    instanceId: string;
}

/**
 * Validates integration access and returns a SABnzbd session.
 * Sends appropriate error responses and returns null if session cannot be established.
 */
async function withSabSession(
    req: Request,
    res: Response,
    opts: { adminOnly?: boolean } = {}
): Promise<SabSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'sabnzbd') {
        res.status(404).json({ error: 'SABnzbd integration not found' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('sabnzbd', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid SABnzbd configuration' });
        return null;
    }

    return { url: translateHostUrl(url.replace(/\/$/, '')), apiKey, instanceId: id };
}

/**
 * Make a SABnzbd API request.
 * All SABnzbd requests go to /api with mode as a query param.
 */
async function sabRequest(
    session: SabSession,
    params: Record<string, string | number>,
    timeout = 10000
) {
    return axios.get(`${session.url}/api`, {
        params: {
            ...params,
            apikey: session.apiKey,
            output: 'json',
        },
        httpsAgent,
        timeout,
    });
}

// ============================================================================
// READ ENDPOINTS (all authenticated users with access)
// ============================================================================

/**
 * GET /:id/proxy/sab/queue - Get active download queue
 */
router.get('/:id/proxy/sab/queue', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res);
    if (!session) return;

    try {
        const response = await sabRequest(session, { mode: 'queue' });
        res.json(response.data);
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Queue error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});

/**
 * GET /:id/proxy/sab/history - Get download history
 */
router.get('/:id/proxy/sab/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res);
    if (!session) return;

    const limit = req.query.limit || '20';

    try {
        const response = await sabRequest(session, { mode: 'history', limit: Number(limit) });
        res.json(response.data);
    } catch (error) {
        logger.error(`[SABnzbd Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * GET /:id/proxy/sab/files/:nzoId - Get files in a specific job
 * Admin-only since the detail modal is admin-only.
 */
router.get('/:id/proxy/sab/files/:nzoId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId } = req.params;

    try {
        const response = await sabRequest(session, {
            mode: 'get_files',
            value: nzoId,
        });
        res.json(response.data);
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Files error: nzoId="${nzoId}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

/**
 * GET /:id/proxy/sab/servers - Get Usenet server status
 * Admin-only.
 */
router.get('/:id/proxy/sab/servers', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    try {
        const response = await sabRequest(session, { mode: 'server_stats' });
        res.json(response.data);
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Servers error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch server status' });
    }
});

/**
 * GET /:id/proxy/sab/general/:nzoId - Combined files + queue data for detail modal
 * Admin-only.
 */
router.get('/:id/proxy/sab/general/:nzoId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId } = req.params;

    try {
        const [filesRes, serversRes] = await Promise.all([
            sabRequest(session, { mode: 'get_files', value: nzoId }),
            sabRequest(session, { mode: 'server_stats' }),
        ]);

        res.json({
            files: filesRes.data,
            servers: serversRes.data,
        });
    } catch (error) {
        logger.error(`[SABnzbd Proxy] General info error: nzoId="${nzoId}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch download details' });
    }
});

// ============================================================================
// ACTION ENDPOINTS (admin-only)
// ============================================================================

/**
 * POST /:id/proxy/sab/pause
 * Body: { nzoId?: string } — omit nzoId to pause all
 */
router.post('/:id/proxy/sab/pause', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId } = req.body as { nzoId?: string };

    try {
        if (nzoId) {
            // Pause specific item
            await sabRequest(session, { mode: 'queue', name: 'pause', value: nzoId });
        } else {
            // Pause all (global)
            await sabRequest(session, { mode: 'pause' });
        }

        logger.info(`[SABnzbd Proxy] Pause OK: ${nzoId || 'all'}`);
        res.json({ success: true });
        triggerTopicPoll(`sabnzbd:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Pause error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to pause' });
    }
});

/**
 * POST /:id/proxy/sab/resume
 * Body: { nzoId?: string } — omit nzoId to resume all
 */
router.post('/:id/proxy/sab/resume', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId } = req.body as { nzoId?: string };

    try {
        if (nzoId) {
            // Resume specific item
            await sabRequest(session, { mode: 'queue', name: 'resume', value: nzoId });
        } else {
            // Resume all (global)
            await sabRequest(session, { mode: 'resume' });
        }

        logger.info(`[SABnzbd Proxy] Resume OK: ${nzoId || 'all'}`);
        res.json({ success: true });
        triggerTopicPoll(`sabnzbd:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Resume error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to resume' });
    }
});

/**
 * POST /:id/proxy/sab/delete
 * Body: { nzoId: string, deleteFiles?: boolean }
 */
router.post('/:id/proxy/sab/delete', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId, deleteFiles } = req.body as { nzoId: string; deleteFiles?: boolean };
    if (!nzoId) {
        res.status(400).json({ error: 'nzoId required' });
        return;
    }

    try {
        const params: Record<string, string | number> = {
            mode: 'queue',
            name: 'delete',
            value: nzoId,
        };
        if (deleteFiles) {
            params.del_files = 1;
        }

        await sabRequest(session, params);
        logger.info(`[SABnzbd Proxy] Delete OK: nzoId=${nzoId} deleteFiles=${deleteFiles}`);
        res.json({ success: true });
        triggerTopicPoll(`sabnzbd:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Delete error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

/**
 * POST /:id/proxy/sab/priority
 * Body: { nzoId: string, priority: number }
 * Priority values: -1=Low, 0=Normal, 1=High, 2=Force
 */
router.post('/:id/proxy/sab/priority', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withSabSession(req, res, { adminOnly: true });
    if (!session) return;

    const { nzoId, priority } = req.body as { nzoId: string; priority: number };
    if (!nzoId || priority === undefined) {
        res.status(400).json({ error: 'nzoId and priority required' });
        return;
    }

    try {
        await sabRequest(session, {
            mode: 'queue',
            name: 'priority',
            value: nzoId,
            value2: priority,
        });
        logger.info(`[SABnzbd Proxy] Priority OK: nzoId=${nzoId} priority=${priority}`);
        res.json({ success: true });
        triggerTopicPoll(`sabnzbd:${session.instanceId}`).catch(() => { });
    } catch (error) {
        logger.error(`[SABnzbd Proxy] Priority error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to change priority' });
    }
});

export default router;
