/**
 * Pi-hole Proxy Routes
 *
 * - GET  /:id/proxy/summary              - Summary stats (authenticated read)
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
import { PiHoleAdapter } from '../../../integrations/pihole/adapter';

const router = Router();
const adapter = getPlugin('pihole')!.adapter as PiHoleAdapter;

interface PiHoleSession {
    instance: PluginInstance;
    instanceId: string;
}

async function withPiHoleSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<PiHoleSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'pihole') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('pihole', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.password) {
        res.status(400).json({ error: 'Invalid Pi-hole configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

function mapTopBlockedResponse(data: unknown): Array<{ domain: string; count: number }> {
    if (!data || typeof data !== 'object') return [];

    const record = data as Record<string, unknown>;

    // v6: { domains: [{ domain, count }, ...] }
    if (Array.isArray(record.domains)) {
        return (record.domains as Array<{ domain?: string; count?: number }>)
            .slice(0, 10)
            .map((entry) => ({
                domain: String(entry.domain ?? ''),
                count: Number(entry.count ?? 0),
            }))
            .filter((entry) => entry.domain);
    }

    if (Array.isArray(record.top_blocked)) {
        return (record.top_blocked as Array<{ domain?: string; count?: number }>)
            .slice(0, 10)
            .map((entry) => ({
                domain: String(entry.domain ?? ''),
                count: Number(entry.count ?? 0),
            }))
            .filter((entry) => entry.domain);
    }

    const topAds = record.top_ads;
    if (topAds && typeof topAds === 'object') {
        return Object.entries(topAds as Record<string, number>)
            .slice(0, 10)
            .map(([domain, count]) => ({ domain, count: Number(count) }));
    }

    return [];
}

async function ensureVersionDetected(instance: PluginInstance): Promise<'v5' | 'v6'> {
    const cached = adapter.getCachedVersion(instance.id);
    if (cached) return cached;

    await adapter.get(instance, '/api/stats/summary', { timeout: 15000 });
    return adapter.getCachedVersion(instance.id) ?? 'v5';
}

router.get('/:id/proxy/summary', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withPiHoleSession(req, res, next);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/api/stats/summary', { timeout: 15000 });
        res.json(response.data);
    } catch (error) {
        logger.error(`[Pi-hole Proxy] Summary error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Pi-hole summary' });
    }
});

router.get(
    '/:id/proxy/topblocked',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withPiHoleSession(req, res, next);
        if (!session) return;

        try {
            const response = await adapter.get!(session.instance, '/api/stats/top_domains', {
                timeout: 15000,
                params: { blocked: true, count: 10 },
            });
            res.json({ topBlocked: mapTopBlockedResponse(response.data) });
        } catch (error) {
            logger.error(`[Pi-hole Proxy] Top blocked error: error="${(error as Error).message}"`);
            res.status(500).json({ error: 'Failed to fetch top blocked domains' });
        }
    }
);

router.post(
    '/:id/proxy/protection/toggle',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const session = await withPiHoleSession(req, res, next, { adminOnly: true });
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
            const version = await ensureVersionDetected(session.instance);

            if (version === 'v6') {
                const body =
                    enabled === false && duration !== undefined
                        ? { blocking: false, timer: duration }
                        : { blocking: enabled };

                await adapter.post!(session.instance, '/api/dns/blocking', body, { timeout: 15000 });
            } else if (enabled === false && duration !== undefined) {
                await adapter.get!(session.instance, `/admin/api.php?disable=${duration}`, { timeout: 15000 });
            } else if (enabled) {
                await adapter.get!(session.instance, '/admin/api.php?enable', { timeout: 15000 });
            } else {
                await adapter.get!(session.instance, '/admin/api.php?disable', { timeout: 15000 });
            }

            logger.info(`[Pi-hole Proxy] Protection toggled: enabled=${enabled} duration=${duration ?? 'none'}`);
            res.json({ success: true });

            triggerTopicPoll(`pihole:${session.instanceId}`).catch(() => {});
        } catch (error) {
            logger.error(`[Pi-hole Proxy] Protection toggle error: error="${(error as Error).message}"`);
            res.status(500).json({ error: 'Failed to update Pi-hole protection' });
        }
    }
);

export default router;
