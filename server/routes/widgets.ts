import { Router, Request, Response } from 'express';
import { getUserConfig, updateUserConfig } from '../db/userConfig';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';

const router = Router();

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

/**
 * GET /api/widgets
 * Get current user's dashboard widgets (desktop and mobile)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);
        const dashboard = userConfig.dashboard || {};

        res.json({
            widgets: dashboard.widgets || [],
            mobileLayoutMode: dashboard.mobileLayoutMode || 'linked',
            mobileWidgets: dashboard.mobileWidgets || undefined
        });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to get: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch widgets' });
    }
});

/**
 * PUT /api/widgets
 * Update current user's dashboard widgets (desktop and/or mobile)
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { widgets, mobileLayoutMode, mobileWidgets } = req.body as WidgetsBody;

        // Validate widgets array
        if (!Array.isArray(widgets)) {
            res.status(400).json({ error: 'Widgets must be an array' });
            return;
        }

        // Validate mobileWidgets if provided
        if (mobileWidgets !== undefined && !Array.isArray(mobileWidgets)) {
            res.status(400).json({ error: 'Mobile widgets must be an array' });
            return;
        }

        // Get current config
        const userConfig = await getUserConfig(authReq.user!.id);

        // Update dashboard with widgets and mobile settings
        const updatedDashboard = {
            ...userConfig.dashboard,
            widgets: widgets,
            ...(mobileLayoutMode !== undefined && { mobileLayoutMode }),
            ...(mobileWidgets !== undefined && { mobileWidgets })
        };

        // Save to user config
        await updateUserConfig(authReq.user!.id, {
            dashboard: updatedDashboard
        });

        logger.debug(`[Widgets] Updated: user=${authReq.user!.id} count=${widgets.length} mobileMode=${updatedDashboard.mobileLayoutMode}`);

        res.json({
            success: true,
            widgets: widgets,
            mobileLayoutMode: updatedDashboard.mobileLayoutMode,
            mobileWidgets: updatedDashboard.mobileWidgets
        });

        // Broadcast after response for faster UX
        invalidateUserSettings(authReq.user!.id, 'widgets');

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to update: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to save widgets' });
    }
});

interface WidgetConfigBody {
    config: Record<string, unknown>;
}

interface DashboardWidget {
    id: string;
    type: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * PATCH /api/widgets/:widgetId/config
 * Update a single widget's config without affecting other widgets
 * Used by automatic fallback persistence
 */
router.patch('/:widgetId/config', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { widgetId } = req.params;
        const { config } = req.body as WidgetConfigBody;

        if (!config || typeof config !== 'object') {
            res.status(400).json({ error: 'Config must be an object' });
            return;
        }

        // Get current config
        const userConfig = await getUserConfig(authReq.user!.id);
        const widgets = (userConfig.dashboard?.widgets || []) as DashboardWidget[];
        const mobileWidgets = (userConfig.dashboard?.mobileWidgets || []) as DashboardWidget[];

        // Find and update the widget in desktop widgets
        let found = false;
        const updatedWidgets = widgets.map(w => {
            if (w.id === widgetId) {
                found = true;

                // LAYER 3: Protect existing integrationId from accidental clearing
                // If new config has null/undefined integrationId BUT existing widget has one,
                // preserve the existing value unless explicitly requested
                const existingIntegrationId = (w.config as Record<string, unknown>)?.integrationId;
                let finalConfig = { ...w.config, ...config };

                if (existingIntegrationId && (config.integrationId === null || config.integrationId === undefined)) {
                    // Check for explicit clear flag
                    if (!(config as Record<string, unknown>).forceClearIntegration) {
                        logger.warn(`[Widgets] BLOCKED: Attempted to clear integrationId on widget=${widgetId} - preserving existing value`);
                        finalConfig.integrationId = existingIntegrationId;
                    } else {
                        logger.info(`[Widgets] Force clearing integrationId on widget=${widgetId}`);
                    }
                }

                return {
                    ...w,
                    config: finalConfig
                };
            }
            return w;
        });

        // Also update in mobile widgets if present
        const updatedMobileWidgets = mobileWidgets.map(w => {
            if (w.id === widgetId) {
                return {
                    ...w,
                    config: { ...w.config, ...config }
                };
            }
            return w;
        });

        if (!found) {
            res.status(404).json({ error: 'Widget not found' });
            return;
        }

        // Save to user config
        await updateUserConfig(authReq.user!.id, {
            dashboard: {
                ...userConfig.dashboard,
                widgets: updatedWidgets,
                ...(mobileWidgets.length > 0 && { mobileWidgets: updatedMobileWidgets })
            }
        });

        logger.debug(`[Widgets] Config updated: user=${authReq.user!.id} widget=${widgetId}`);

        res.json({ success: true });

        // Broadcast after response
        invalidateUserSettings(authReq.user!.id, 'widgets');

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to update config: user=${authReq.user?.id} widget=${req.params.widgetId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update widget config' });
    }
});

/**
 * POST /api/widgets/reset
 * Reset current user's widgets to empty (both desktop and mobile)
 */
router.post('/reset', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;

        // Reset widgets and mobile state to defaults
        const updatedDashboard = {
            layout: [],
            widgets: [],
            mobileLayoutMode: 'linked' as const,
            mobileWidgets: undefined
        };

        await updateUserConfig(authReq.user!.id, {
            dashboard: updatedDashboard
        });

        logger.debug(`[Widgets] Reset: user=${authReq.user!.id}`);

        res.json({
            success: true,
            widgets: [],
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined
        });

        invalidateUserSettings(authReq.user!.id, 'widgets');

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to reset: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reset widgets' });
    }
});

/**
 * POST /api/widgets/unlink
 * Transition mobile dashboard from linked to independent
 * Copies current desktop widgets to mobile widgets
 */
router.post('/unlink', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);
        const currentWidgets = userConfig.dashboard?.widgets || [];

        // Copy desktop widgets to mobile and set mode to independent
        const updatedDashboard = {
            ...userConfig.dashboard,
            mobileLayoutMode: 'independent' as const,
            mobileWidgets: JSON.parse(JSON.stringify(currentWidgets))
        };

        await updateUserConfig(authReq.user!.id, {
            dashboard: updatedDashboard
        });

        logger.debug(`[Widgets] Mobile unlinked: user=${authReq.user!.id} count=${currentWidgets.length}`);

        res.json({
            success: true,
            mobileLayoutMode: 'independent',
            mobileWidgets: updatedDashboard.mobileWidgets
        });

        invalidateUserSettings(authReq.user!.id, 'widgets');

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to unlink mobile: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to unlink mobile dashboard' });
    }
});

/**
 * POST /api/widgets/reconnect
 * Transition mobile dashboard from independent back to linked
 * Clears mobile widgets and resumes auto-generation from desktop
 */
router.post('/reconnect', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);

        // Clear mobile widgets and set mode to linked
        const updatedDashboard = {
            ...userConfig.dashboard,
            mobileLayoutMode: 'linked' as const,
            mobileWidgets: undefined
        };

        await updateUserConfig(authReq.user!.id, {
            dashboard: updatedDashboard
        });

        logger.debug(`[Widgets] Mobile reconnected: user=${authReq.user!.id}`);

        res.json({
            success: true,
            mobileLayoutMode: 'linked',
            mobileWidgets: undefined
        });

        invalidateUserSettings(authReq.user!.id, 'widgets');

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Widgets] Failed to reconnect mobile: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reconnect mobile dashboard' });
    }
});

export default router;
