/**
 * qBittorrent Proxy Routes
 * 
 * Handles qBittorrent API proxying via the shared adapter:
 * - GET  /torrents           - Torrent list (SSE poller)
 * - GET  /transfer           - Global transfer stats (SSE poller)
 * - GET  /torrents/:hash/general - Combined properties+trackers+files (modal)
 * - POST /torrents/pause     - Pause torrent(s)
 * - POST /torrents/resume    - Resume torrent(s)
 * - POST /torrents/delete    - Delete torrent(s)
 * - POST /torrents/recheck   - Recheck torrent(s)
 * - POST /torrents/setForceStart - Force start torrent(s)
 * - POST /torrents/filePrio  - Set file priority
 * - POST /torrents/setSpeedLimit - Set per-torrent speed limits
 */

import { Router, Request, Response } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { triggerTopicPoll } from '../../../services/sse/PollerOrchestrator';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';
import { PluginInstance } from '../../../integrations/types';

const router = Router();
const adapter = getPlugin('qbittorrent')!.adapter;

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface QbSession {
    instance: PluginInstance;
    instanceId: string;
}

/**
 * Validates integration access and returns a qBittorrent session context.
 * Sends appropriate error responses and returns null if access is denied.
 */
async function withQbSession(
    req: Request,
    res: Response,
    opts: { adminOnly?: boolean } = {}
): Promise<QbSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'qbittorrent') {
        res.status(404).json({ error: 'qBittorrent integration not found' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('qbittorrent', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid qBittorrent configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

// ============================================================================
// READ ENDPOINTS (all authenticated users with access)
// ============================================================================

/**
 * GET /:id/proxy/torrents - Get torrent list
 */
router.get('/:id/proxy/torrents', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/api/v2/torrents/info', {
            timeout: 10000,
        });
        res.json(response.data);
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Torrents error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch torrents' });
    }
});

/**
 * GET /:id/proxy/transfer - Get transfer stats
 */
router.get('/:id/proxy/transfer', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/api/v2/transfer/info', {
            timeout: 10000,
        });
        res.json(response.data);
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Transfer error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch transfer stats' });
    }
});

/**
 * GET /:id/proxy/torrents/:hash/general - Combined properties + trackers + files
 * Used by TorrentDetailModal to load all detail data in one request.
 * Admin-only since modal is admin-only.
 */
router.get('/:id/proxy/torrents/:hash/general', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hash } = req.params;

    try {
        const [properties, trackers, files] = await Promise.all([
            adapter.get!(session.instance, '/api/v2/torrents/properties', {
                params: { hash }, timeout: 10000,
            }),
            adapter.get!(session.instance, '/api/v2/torrents/trackers', {
                params: { hash }, timeout: 10000,
            }),
            adapter.get!(session.instance, '/api/v2/torrents/files', {
                params: { hash }, timeout: 10000,
            }),
        ]);

        res.json({
            properties: properties.data,
            trackers: trackers.data,
            files: files.data,
        });
    } catch (error) {
        logger.error(`[qBittorrent Proxy] General info error: hash="${hash}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch torrent details' });
    }
});

// ============================================================================
// ACTION ENDPOINTS (admin-only)
// ============================================================================

/**
 * Helper: POST a form-urlencoded action to qBittorrent.
 * Supports a fallback endpoint for API version compatibility
 * (e.g. v5+ uses "stop"/"start", older uses "pause"/"resume").
 */
async function qbPostAction(
    session: QbSession,
    endpoint: string,
    formParams: URLSearchParams,
    label: string,
    res: Response,
    fallbackEndpoint?: string
): Promise<void> {
    try {
        const resp = await adapter.post!(session.instance, `/api/v2/${endpoint}`, formParams, {
            timeout: 10000,
        });
        logger.info(`[qBittorrent Proxy] ${label} OK via ${endpoint} (${resp.status})`);
        res.json({ success: true });
        // Nudge the poller to immediately re-fetch and push fresh state to all SSE clients
        triggerTopicPoll(`qbittorrent:${session.instanceId}`).catch(() => { });
    } catch (error: unknown) {
        // If 404 and we have a fallback, try the alternate endpoint name
        const status = (error as { context?: { status?: number } }).context?.status
            ?? (error as { response?: { status?: number } }).response?.status;
        if (fallbackEndpoint && status === 404) {
            logger.info(`[qBittorrent Proxy] ${label}: ${endpoint} returned 404, trying fallback ${fallbackEndpoint}`);
            try {
                const resp = await adapter.post!(session.instance, `/api/v2/${fallbackEndpoint}`, formParams, {
                    timeout: 10000,
                });
                logger.info(`[qBittorrent Proxy] ${label} OK via fallback ${fallbackEndpoint} (${resp.status})`);
                res.json({ success: true });
                triggerTopicPoll(`qbittorrent:${session.instanceId}`).catch(() => { });
                return;
            } catch (fallbackError) {
                logger.error(`[qBittorrent Proxy] ${label} error (fallback): error="${(fallbackError as Error).message}"`);
                res.status(500).json({ error: `Failed to ${label.toLowerCase()}` });
                return;
            }
        }
        logger.error(`[qBittorrent Proxy] ${label} error: error="${(error as Error).message}"`);
        res.status(500).json({ error: `Failed to ${label.toLowerCase()}` });
    }
}

/**
 * POST /:id/proxy/torrents/pause
 * Body: { hashes: string[] }  — use ["all"] for all torrents
 * Tries "stop" (v5+) first, falls back to "pause" (v4.x)
 */
router.post('/:id/proxy/torrents/pause', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes } = req.body as { hashes: string[] };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const form = new URLSearchParams();
    form.append('hashes', hashes.join('|'));
    await qbPostAction(session, 'torrents/stop', form, 'Pause', res, 'torrents/pause');
});

/**
 * POST /:id/proxy/torrents/resume
 * Body: { hashes: string[] }
 * Tries "start" (v5+) first, falls back to "resume" (v4.x)
 */
router.post('/:id/proxy/torrents/resume', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes } = req.body as { hashes: string[] };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const form = new URLSearchParams();
    form.append('hashes', hashes.join('|'));
    await qbPostAction(session, 'torrents/start', form, 'Resume', res, 'torrents/resume');
});

/**
 * POST /:id/proxy/torrents/delete
 * Body: { hashes: string[], deleteFiles: boolean }
 */
router.post('/:id/proxy/torrents/delete', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes, deleteFiles } = req.body as { hashes: string[]; deleteFiles?: boolean };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const form = new URLSearchParams();
    form.append('hashes', hashes.join('|'));
    form.append('deleteFiles', String(deleteFiles ?? false));
    await qbPostAction(session, 'torrents/delete', form, 'Delete', res);
});

/**
 * POST /:id/proxy/torrents/recheck
 * Body: { hashes: string[] }
 */
router.post('/:id/proxy/torrents/recheck', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes } = req.body as { hashes: string[] };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const form = new URLSearchParams();
    form.append('hashes', hashes.join('|'));
    await qbPostAction(session, 'torrents/recheck', form, 'Recheck', res);
});

/**
 * POST /:id/proxy/torrents/setForceStart
 * Body: { hashes: string[], value: boolean }
 */
router.post('/:id/proxy/torrents/setForceStart', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes, value } = req.body as { hashes: string[]; value: boolean };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const form = new URLSearchParams();
    form.append('hashes', hashes.join('|'));
    form.append('value', String(value ?? true));
    await qbPostAction(session, 'torrents/setForceStart', form, 'Force start', res);
});

/**
 * POST /:id/proxy/torrents/filePrio
 * Body: { hash: string, id: number[], priority: number }
 * Priority: 0=skip, 1=normal, 6=high, 7=maximal
 */
router.post('/:id/proxy/torrents/filePrio', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hash, id: fileIds, priority } = req.body as { hash: string; id: number[]; priority: number };
    if (!hash || !fileIds?.length || priority === undefined) {
        res.status(400).json({ error: 'hash, id[], and priority required' });
        return;
    }

    const form = new URLSearchParams();
    form.append('hash', hash);
    form.append('id', fileIds.join('|'));
    form.append('priority', String(priority));
    await qbPostAction(session, 'torrents/filePrio', form, 'Set file priority', res);
});

/**
 * POST /:id/proxy/torrents/setSpeedLimit
 * Body: { hashes: string[], dlLimit?: number, ulLimit?: number }
 * Limits in bytes/sec. 0 = unlimited.
 */
router.post('/:id/proxy/torrents/setSpeedLimit', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const session = await withQbSession(req, res, { adminOnly: true });
    if (!session) return;

    const { hashes, dlLimit, ulLimit } = req.body as { hashes: string[]; dlLimit?: number; ulLimit?: number };
    if (!hashes?.length) { res.status(400).json({ error: 'hashes required' }); return; }

    const hashStr = hashes.join('|');

    try {
        const promises: Promise<unknown>[] = [];

        if (dlLimit !== undefined) {
            const form = new URLSearchParams();
            form.append('hashes', hashStr);
            form.append('limit', String(dlLimit));
            promises.push(adapter.post!(session.instance, '/api/v2/torrents/setDownloadLimit', form, {
                timeout: 10000,
            }));
        }
        if (ulLimit !== undefined) {
            const form = new URLSearchParams();
            form.append('hashes', hashStr);
            form.append('limit', String(ulLimit));
            promises.push(adapter.post!(session.instance, '/api/v2/torrents/setUploadLimit', form, {
                timeout: 10000,
            }));
        }

        await Promise.all(promises);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[qBittorrent Proxy] Set speed limit error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to set speed limit' });
    }
});

export default router;
