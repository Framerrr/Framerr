/**
 * AdGuard Home Proxy Routes
 *
 * - GET  /:id/proxy/summary              - 24h stats (authenticated read)
 * - GET  /:id/proxy/topblocked           - Top blocked domains (authenticated read)
 * - POST /:id/proxy/protection/toggle    - Enable/disable/pause protection (admin-only)
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
import { mapAdGuardTopBlocked } from '../../../integrations/adguard/poller';

const router = Router();
const adapter = getPlugin('adguard')!.adapter;

interface AdGuardSession {
    instance: PluginInstance;
    instanceId: string;
}

async function withAdGuardSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<AdGuardSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'adguard') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('adguard', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url) {
        res.status(400).json({ error: 'Invalid AdGuard configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

router.get('/:id/proxy/summary', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withAdGuardSession(req, res, next);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/control/stats', { timeout: 15000 });
        res.json(response.data);
    } catch (error) {
        logger.error(`[AdGuard Proxy] Summary error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch AdGuard stats' });
    }
});

router.get(
    '/:id/proxy/topblocked',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withAdGuardSession(req, res, next);
        if (!session) return;

        try {
            const response = await adapter.get!(session.instance, '/control/stats', { timeout: 15000 });
            const stats = response.data as { top_blocked_domains?: unknown };
            res.json({ topBlocked: mapAdGuardTopBlocked(stats.top_blocked_domains) });
        } catch (error) {
            logger.error(`[AdGuard Proxy] Top blocked error: error="${(error as Error).message}"`);
            res.status(500).json({ error: 'Failed to fetch top blocked domains' });
        }
    }
);

router.post(
    '/:id/proxy/protection/toggle',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withAdGuardSession(req, res, next, { adminOnly: true });
        if (!session) return;

        const { enabled, duration } = req.body as { enabled?: boolean; duration?: number };

        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled boolean required' });
            return;
        }

        if (duration !== undefined && (typeof duration !== 'number' || duration <= 0)) {
            res.status(400).json({ error: 'duration must be a positive number of seconds' });
            return;
        }

        try {
            const body =
                enabled === false && duration !== undefined
                    ? { enabled: false, duration: duration * 1000 }
                    : { enabled };

            await adapter.post!(session.instance, '/control/protection', body, { timeout: 15000 });

            logger.info(`[AdGuard Proxy] Protection toggled: enabled=${enabled} duration=${duration ?? 'none'}`);
            res.json({ success: true });

            triggerTopicPoll(`adguard:${session.instanceId}`).catch(() => {});
        } catch (error) {
            logger.error(`[AdGuard Proxy] Protection toggle error: error="${(error as Error).message}"`);
            res.status(500).json({ error: 'Failed to update AdGuard protection' });
        }
    }
);

export default router;
