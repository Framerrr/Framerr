/**
 * Prowlarr Proxy Routes
 *
 * Handles Prowlarr API proxying:
 * - POST /indexer/testall            - Test all indexers (admin-only)
 * - POST /indexer/:indexerId/test    - Test one indexer (GET-then-POST, admin-only)
 * - POST /indexer/:indexerId/enable  - Enable/disable indexer (GET-then-PUT, admin-only)
 * - GET  /history                    - Paginated grab/query history
 * - GET  /indexerstats               - Aggregate per-indexer stats (query params provisional)
 * - GET  /search                     - Reserved, not yet implemented (future interactive search)
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { triggerTopicPoll } from '../../../services/sse/PollerOrchestrator';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';
import { PluginInstance } from '../../../integrations/types';
import { AdapterError } from '../../../integrations/errors';

const router = Router();
const adapter = getPlugin('prowlarr')!.adapter;

/** Prowlarr returns HTTP 400 when a provider test fails — the run still completed. */
function isProwlarrTestFailureStatus(error: unknown): boolean {
    return error instanceof AdapterError && error.context?.status === 400;
}

/**
 * Pull human-readable messages from Prowlarr validation / testall 400 bodies.
 * Individual test: [{ errorMessage: "..." }, ...]
 * Test-all: [{ id, validationFailures: [{ errorMessage }], isValid }, ...]
 */
function extractProwlarrTestMessage(data: unknown): string | null {
    if (!data) return null;

    if (typeof data === 'string' && data.trim()) return data.trim();

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null) {
            const obj = data as Record<string, unknown>;
            if (typeof obj.errorMessage === 'string' && obj.errorMessage.trim()) {
                return obj.errorMessage.trim();
            }
            if (typeof obj.message === 'string' && obj.message.trim()) {
                return obj.message.trim();
            }
        }
        return null;
    }

    const messages: string[] = [];
    for (const item of data) {
        if (typeof item === 'string' && item.trim()) {
            messages.push(item.trim());
            continue;
        }
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;

        if (typeof row.errorMessage === 'string' && row.errorMessage.trim()) {
            messages.push(row.errorMessage.trim());
            continue;
        }

        const failures = row.validationFailures;
        if (Array.isArray(failures)) {
            for (const failure of failures) {
                if (failure && typeof failure === 'object') {
                    const msg = (failure as Record<string, unknown>).errorMessage;
                    if (typeof msg === 'string' && msg.trim()) messages.push(msg.trim());
                }
            }
        }
    }

    if (messages.length === 0) return null;
    return messages[0];
}

/** Count failed entries in a Prowlarr testall 400 body. */
function countProwlarrTestAllFailures(data: unknown): number {
    if (!Array.isArray(data)) return 0;

    let failed = 0;
    for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;

        if (row.isValid === false) {
            failed += 1;
            continue;
        }

        // Fallback if isValid omitted: any validationFailures ⇒ failed
        if (Array.isArray(row.validationFailures) && row.validationFailures.length > 0) {
            failed += 1;
        }
    }
    return failed;
}

function formatTestAllFailureMessage(data: unknown): string {
    const failedCount = countProwlarrTestAllFailures(data);
    if (failedCount <= 0) {
        return extractProwlarrTestMessage(data) || 'Some indexers failed';
    }
    if (failedCount === 1) {
        const detail = extractProwlarrTestMessage(data);
        return detail ? `1 indexer failed: ${detail}` : '1 indexer failed';
    }
    return `${failedCount} indexers failed`;
}

function prowlarrTestFailurePayload(
    error: unknown,
    mode: 'single' | 'all' = 'single'
): { hasFailures: true; message: string | null; failedCount: number; data: unknown } {
    const data = error instanceof AdapterError ? error.context?.data ?? null : null;
    const failedCount = mode === 'all' ? countProwlarrTestAllFailures(data) : 1;
    return {
        hasFailures: true,
        message: mode === 'all' ? formatTestAllFailureMessage(data) : extractProwlarrTestMessage(data),
        failedCount,
        data,
    };
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface ProwlarrSession {
    instance: PluginInstance;
    instanceId: string;
}

async function withProwlarrSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<ProwlarrSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'prowlarr') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('prowlarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.apiKey) {
        res.status(400).json({ error: 'Invalid Prowlarr configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

// ============================================================================
// READ ENDPOINTS
// ============================================================================

/**
 * GET /:id/proxy/history - Paginated Prowlarr history
 */
router.get('/:id/proxy/history', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withProwlarrSession(req, res, next);
    if (!session) return;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    try {
        const response = await adapter.get!(session.instance, '/api/v1/history', {
            params: {
                page,
                pageSize,
                sortKey: 'date',
                sortDirection: 'descending',
            },
            timeout: 15000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Prowlarr Proxy] History error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Prowlarr history' });
    }
});

/**
 * GET /:id/proxy/indexerstats - Aggregate indexer stats
 * Query params: startDate, endDate (provisional — live-verify against Prowlarr OpenAPI)
 */
router.get('/:id/proxy/indexerstats', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withProwlarrSession(req, res, next);
    if (!session) return;

    const MS_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const defaultStart = new Date(now - 30 * MS_DAY).toISOString().split('T')[0];
    const defaultEnd = new Date(now).toISOString().split('T')[0];

    const startDate = (req.query.startDate as string) || defaultStart;
    const endDate = (req.query.endDate as string) || defaultEnd;

    try {
        const response = await adapter.get!(session.instance, '/api/v1/indexerstats', {
            params: { startDate, endDate },
            timeout: 15000,
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Prowlarr Proxy] Indexerstats error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Prowlarr indexer stats' });
    }
});

// ============================================================================
// ACTION ENDPOINTS (admin-only)
// ============================================================================

/**
 * POST /:id/proxy/indexer/testall - Test all enabled indexers
 * Must be registered before /indexer/:indexerId/* so "testall" is not captured as an id.
 */
router.post(
    '/:id/proxy/indexer/testall',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withProwlarrSession(req, res, next, { adminOnly: true });
        if (!session) return;

        try {
            const response = await adapter.request!(session.instance, 'POST', '/api/v1/indexer/testall', undefined, {
                timeout: 120000,
            });

            logger.info('[Prowlarr Proxy] Test-all indexers completed');
            res.json({ success: true, hasFailures: false, data: response.data ?? null });

            triggerTopicPoll(`prowlarr:${session.instanceId}`).catch(() => {});
        } catch (error) {
            // *Arr convention: HTTP 400 = one or more indexers failed the test, not a transport error.
            if (isProwlarrTestFailureStatus(error)) {
                logger.info(
                    '[Prowlarr Proxy] Test-all completed with indexer failures (Prowlarr HTTP 400)'
                );
                res.json({ success: true, ...prowlarrTestFailurePayload(error, 'all') });
                triggerTopicPoll(`prowlarr:${session.instanceId}`).catch(() => {});
                return;
            }

            logger.error(`[Prowlarr Proxy] Test-all error: error="${(error as Error).message}"`);
            res.status(500).json({ error: 'Failed to test indexers' });
        }
    }
);

/**
 * POST /:id/proxy/indexer/:indexerId/test - Test a single indexer (GET resource, then POST /test)
 */
router.post(
    '/:id/proxy/indexer/:indexerId/test',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withProwlarrSession(req, res, next, { adminOnly: true });
        if (!session) return;

        const indexerId = parseInt(req.params.indexerId);
        if (isNaN(indexerId)) {
            res.status(400).json({ error: 'Invalid indexer ID' });
            return;
        }

        try {
            const current = await adapter.get!(session.instance, `/api/v1/indexer/${indexerId}`, {
                timeout: 10000,
            });

            const response = await adapter.request!(
                session.instance,
                'POST',
                '/api/v1/indexer/test',
                current.data,
                { timeout: 60000 }
            );

            logger.info(`[Prowlarr Proxy] Indexer tested: id=${indexerId}`);
            res.json({ success: true, hasFailures: false, data: response.data ?? null });

            triggerTopicPoll(`prowlarr:${session.instanceId}`).catch(() => {});
        } catch (error) {
            if (isProwlarrTestFailureStatus(error)) {
                logger.info(
                    `[Prowlarr Proxy] Indexer test completed with failure: id=${indexerId} (Prowlarr HTTP 400)`
                );
                res.json({ success: true, ...prowlarrTestFailurePayload(error, 'single') });
                triggerTopicPoll(`prowlarr:${session.instanceId}`).catch(() => {});
                return;
            }

            logger.error(
                `[Prowlarr Proxy] Indexer test error: id=${indexerId} error="${(error as Error).message}"`
            );
            res.status(500).json({ error: 'Failed to test indexer' });
        }
    }
);

/**
 * POST /:id/proxy/indexer/:indexerId/enable - Enable or disable an indexer
 * Body: { enabled: boolean }
 */
router.post(
    '/:id/proxy/indexer/:indexerId/enable',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withProwlarrSession(req, res, next, { adminOnly: true });
        if (!session) return;

        const indexerId = parseInt(req.params.indexerId);
        const { enabled } = req.body as { enabled?: boolean };

        if (isNaN(indexerId)) {
            res.status(400).json({ error: 'Invalid indexer ID' });
            return;
        }

        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled boolean required' });
            return;
        }

        try {
            const current = await adapter.get!(session.instance, `/api/v1/indexer/${indexerId}`, {
                timeout: 10000,
            });

            const payload = { ...(current.data as Record<string, unknown>), enable: enabled };

            // forceSave skips Prowlarr's pre-save test. Without it, enabling a failing
            // indexer returns HTTP 400 even though the user only asked to toggle enable.
            await adapter.request!(session.instance, 'PUT', `/api/v1/indexer/${indexerId}`, payload, {
                params: { forceSave: true },
                timeout: 15000,
            });

            logger.info(`[Prowlarr Proxy] Indexer ${enabled ? 'enabled' : 'disabled'}: id=${indexerId}`);
            res.json({ success: true });

            triggerTopicPoll(`prowlarr:${session.instanceId}`).catch(() => {});
        } catch (error) {
            logger.error(
                `[Prowlarr Proxy] Indexer enable/disable error: id=${indexerId} error="${(error as Error).message}"`
            );
            res.status(500).json({ error: 'Failed to update indexer' });
        }
    }
);

export default router;
