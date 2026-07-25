import { Router, Request, Response } from 'express';
import { getDashboard, saveDashboardWidgets } from '../db/dashboards';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';
import { clearSearchHistoryForWidgets } from '../db/mediaSearchHistory';

const router = Router({ mergeParams: true });

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface WidgetsBody {
    widgets: unknown[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: unknown[];
}

interface DashboardWidget {
    id: string;
    type: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
}

function resolveDashboard(req: Request, res: Response, userId: string) {
    const dashboardId = req.params.dashboardId;
    if (!dashboardId) {
        res.status(404).json({ error: 'Dashboard not found' });
        return null;
    }
    const dashboard = getDashboard(userId, dashboardId);
    if (!dashboard) {
        res.status(404).json({ error: 'Dashboard not found' });
        return null;
    }
    return dashboard;
}

/**
 * GET / — scoped widgets for a dashboard
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const dashboard = resolveDashboard(req, res, authReq.user!.id);
        if (!dashboard) return;

        res.json({
            widgets: dashboard.widgets || [],
            mobileLayoutMode: dashboard.mobileLayoutMode || 'linked',
            mobileWidgets: dashboard.mobileWidgets || undefined,
        });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to get: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to fetch widgets' });
    }
});

/**
 * PUT / — update dashboard widgets
 */
router.put('/', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const dashboard = resolveDashboard(req, res, userId);
        if (!dashboard) return;

        const { widgets, mobileLayoutMode, mobileWidgets } = req.body as WidgetsBody;

        if (!Array.isArray(widgets)) {
            res.status(400).json({ error: 'Widgets must be an array' });
            return;
        }

        if (mobileWidgets !== undefined && !Array.isArray(mobileWidgets)) {
            res.status(400).json({ error: 'Mobile widgets must be an array' });
            return;
        }

        const existingById = new Map(
            [...(dashboard.widgets || []), ...(dashboard.mobileWidgets || [])].map(
                (w) => [(w as DashboardWidget).id, w as DashboardWidget],
            ),
        );
        const protectIntegrationId = (w: DashboardWidget): DashboardWidget => {
            const prior = existingById.get(w.id);
            const priorId = (prior?.config as Record<string, unknown> | undefined)?.integrationId;
            const incoming = (w.config as Record<string, unknown> | undefined) ?? {};
            if (
                priorId &&
                (incoming.integrationId === null || incoming.integrationId === undefined) &&
                !incoming.forceClearIntegration
            ) {
                return { ...w, config: { ...incoming, integrationId: priorId } };
            }
            return w;
        };
        const protectedWidgets = (widgets as DashboardWidget[]).map(protectIntegrationId);
        const protectedMobile =
            mobileWidgets !== undefined
                ? (mobileWidgets as DashboardWidget[]).map(protectIntegrationId)
                : undefined;

        const updated = saveDashboardWidgets(userId, dashboard.id, {
            widgets: protectedWidgets,
            ...(mobileLayoutMode !== undefined ? { mobileLayoutMode } : {}),
            ...(protectedMobile !== undefined ? { mobileWidgets: protectedMobile } : {}),
        });

        if (!updated) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        logger.debug(
            `[Widgets] Updated: user=${userId} dashboard=${dashboard.id} count=${protectedWidgets.length} mobileMode=${updated.mobileLayoutMode}`
        );

        res.json({
            success: true,
            widgets: protectedWidgets,
            mobileLayoutMode: updated.mobileLayoutMode,
            mobileWidgets: updated.mobileWidgets,
        });

        invalidateUserSettings(userId, 'widgets');

        try {
            const oldWidgetIds = new Set(
                [
                    ...(dashboard.widgets || []) as DashboardWidget[],
                    ...(dashboard.mobileWidgets || []) as DashboardWidget[],
                ].map(w => w.id)
            );
            const newWidgetIds = new Set(
                [
                    ...protectedWidgets,
                    ...(protectedMobile || []),
                ].map((w) => w.id),
            );
            const removedIds = [...oldWidgetIds].filter(id => !newWidgetIds.has(id));
            if (removedIds.length > 0) {
                const cleaned = clearSearchHistoryForWidgets(removedIds);
                if (cleaned > 0) {
                    logger.debug(
                        `[Widgets] Cleaned up ${cleaned} orphaned search history entries for removed widgets`
                    );
                }
            }
        } catch (cleanupErr) {
            logger.warn(
                `[Widgets] Search history cleanup failed: ${(cleanupErr as Error).message}`
            );
        }
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to update: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to save widgets' });
    }
});

interface WidgetConfigBody {
    config: Record<string, unknown>;
}

/**
 * PATCH /:widgetId/config
 */
router.patch('/:widgetId/config', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const dashboard = resolveDashboard(req, res, userId);
        if (!dashboard) return;

        const { widgetId } = req.params;
        const { config } = req.body as WidgetConfigBody;

        if (!config || typeof config !== 'object') {
            res.status(400).json({ error: 'Config must be an object' });
            return;
        }

        const widgets = (dashboard.widgets || []) as DashboardWidget[];
        const mobileWidgets = (dashboard.mobileWidgets || []) as DashboardWidget[];

        logger.debug(
            `[Widgets] PATCH debug: user=${userId} dashboard=${dashboard.id} desktopWidgetCount=${widgets.length} mobileWidgetCount=${mobileWidgets.length}`
        );

        let found = false;
        const updatedWidgets = widgets.map(w => {
            if (w.id === widgetId) {
                found = true;
                const existingIntegrationId = (w.config as Record<string, unknown>)?.integrationId;
                let finalConfig = { ...w.config, ...config };

                if (
                    existingIntegrationId &&
                    (config.integrationId === null || config.integrationId === undefined)
                ) {
                    if (!(config as Record<string, unknown>).forceClearIntegration) {
                        logger.warn(
                            `[Widgets] BLOCKED: Attempted to clear integrationId on widget=${widgetId} - preserving existing value`
                        );
                        finalConfig.integrationId = existingIntegrationId;
                    } else {
                        logger.info(`[Widgets] Force clearing integrationId on widget=${widgetId}`);
                    }
                }

                return { ...w, config: finalConfig };
            }
            return w;
        });

        const updatedMobileWidgets = mobileWidgets.map(w => {
            if (w.id === widgetId) {
                found = true;
                const existingIntegrationId = (w.config as Record<string, unknown>)?.integrationId;
                let finalConfig = { ...w.config, ...config };

                if (
                    existingIntegrationId &&
                    (config.integrationId === null || config.integrationId === undefined)
                ) {
                    if (!(config as Record<string, unknown>).forceClearIntegration) {
                        logger.warn(
                            `[Widgets] BLOCKED: Attempted to clear integrationId on mobile widget=${widgetId} - preserving existing value`
                        );
                        finalConfig.integrationId = existingIntegrationId;
                    }
                }

                return { ...w, config: finalConfig };
            }
            return w;
        });

        if (!found) {
            logger.warn(
                `[Widgets] Widget not found for PATCH: user=${userId} dashboard=${dashboard.id} widgetId=${widgetId}`
            );
            res.status(404).json({ error: 'Widget not found' });
            return;
        }

        const saved = saveDashboardWidgets(userId, dashboard.id, {
            widgets: updatedWidgets,
            mobileWidgets: mobileWidgets.length > 0 ? updatedMobileWidgets : undefined,
        });

        if (!saved) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        logger.debug(`[Widgets] Config updated: user=${userId} dashboard=${dashboard.id} widget=${widgetId}`);
        res.json({ success: true });
        invalidateUserSettings(userId, 'widgets');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to update config: user=${authReq.user?.id} widget=${req.params.widgetId} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to update widget config' });
    }
});

/**
 * POST /reset
 */
router.post('/reset', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const dashboard = resolveDashboard(req, res, userId);
        if (!dashboard) return;

        const oldWidgetIds = [
            ...(dashboard.widgets || []) as DashboardWidget[],
            ...(dashboard.mobileWidgets || []) as DashboardWidget[],
        ].map(w => w.id);

        const saved = saveDashboardWidgets(userId, dashboard.id, {
            widgets: [],
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined,
        });

        if (!saved) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        logger.debug(`[Widgets] Reset: user=${userId} dashboard=${dashboard.id}`);

        res.json({
            success: true,
            widgets: [],
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined,
        });

        invalidateUserSettings(userId, 'widgets');

        if (oldWidgetIds.length > 0) {
            try {
                const cleaned = clearSearchHistoryForWidgets(oldWidgetIds);
                if (cleaned > 0) {
                    logger.debug(`[Widgets] Reset cleaned up ${cleaned} orphaned search history entries`);
                }
            } catch (cleanupErr) {
                logger.warn(
                    `[Widgets] Search history cleanup on reset failed: ${(cleanupErr as Error).message}`
                );
            }
        }
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to reset: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to reset widgets' });
    }
});

/**
 * POST /unlink
 */
router.post('/unlink', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const dashboard = resolveDashboard(req, res, userId);
        if (!dashboard) return;

        const currentWidgets = dashboard.widgets || [];
        const mobileWidgets = JSON.parse(JSON.stringify(currentWidgets));

        const saved = saveDashboardWidgets(userId, dashboard.id, {
            widgets: currentWidgets,
            mobileLayoutMode: 'independent',
            mobileWidgets,
        });

        if (!saved) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        logger.debug(
            `[Widgets] Mobile unlinked: user=${userId} dashboard=${dashboard.id} count=${currentWidgets.length}`
        );

        res.json({
            success: true,
            mobileLayoutMode: 'independent',
            mobileWidgets,
        });

        invalidateUserSettings(userId, 'widgets');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to unlink mobile: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to unlink mobile dashboard' });
    }
});

/**
 * POST /reconnect
 */
router.post('/reconnect', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const dashboard = resolveDashboard(req, res, userId);
        if (!dashboard) return;

        const saved = saveDashboardWidgets(userId, dashboard.id, {
            widgets: dashboard.widgets,
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined,
        });

        if (!saved) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        logger.debug(`[Widgets] Mobile reconnected: user=${userId} dashboard=${dashboard.id}`);

        res.json({
            success: true,
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined,
        });

        invalidateUserSettings(userId, 'widgets');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Widgets] Failed to reconnect mobile: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to reconnect mobile dashboard' });
    }
});

export default router;
