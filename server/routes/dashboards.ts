import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';
import {
    listDashboards,
    getDashboard,
    createDashboard,
    updateDashboardMeta,
    deleteDashboard,
    setDashboardPrefs,
    regenerateWidgetIds,
} from '../db/dashboards';
import * as templateDb from '../db/templates';
import widgetsRouter from './widgets';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

type CreateSource =
    | { type: 'blank' }
    | { type: 'clone'; dashboardId: string }
    | { type: 'template'; templateId: string };

interface CreateDashboardBody {
    name?: string;
    source?: CreateSource;
}

async function userCanAccessTemplate(
    template: NonNullable<Awaited<ReturnType<typeof templateDb.getTemplateById>>>,
    userId: string
): Promise<boolean> {
    if (template.ownerId === userId) return true;
    const shares = await templateDb.getTemplateShares(template.id);
    return shares.some(s => s.sharedWith === userId || s.sharedWith === 'everyone');
}

/**
 * GET /api/dashboards
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const result = listDashboards(authReq.user!.id);
        res.json(result);
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Dashboards] Failed to list: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to fetch dashboards' });
    }
});

/**
 * POST /api/dashboards
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const body = req.body as CreateDashboardBody;
        const source = body.source ?? { type: 'blank' as const };
        const name = typeof body.name === 'string' ? body.name : 'Dashboard';

        if (
            typeof source !== 'object' ||
            source === null ||
            !('type' in source) ||
            !['blank', 'clone', 'template'].includes(source.type)
        ) {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }

        let dashboard;

        if (source.type === 'blank') {
            dashboard = createDashboard(userId, { name, widgets: [] });
        } else if (source.type === 'clone') {
            if (typeof source.dashboardId !== 'string') {
                res.status(400).json({ error: 'Invalid request body' });
                return;
            }
            const src = getDashboard(userId, source.dashboardId);
            if (!src) {
                res.status(404).json({ error: 'Dashboard not found' });
                return;
            }
            dashboard = createDashboard(userId, {
                name,
                icon: src.icon,
                fixedDisplay: src.fixedDisplay,
                widgets: regenerateWidgetIds(src.widgets),
                mobileLayoutMode: src.mobileLayoutMode,
                mobileWidgets: src.mobileWidgets
                    ? regenerateWidgetIds(src.mobileWidgets)
                    : undefined,
            });
        } else {
            if (typeof source.templateId !== 'string') {
                res.status(400).json({ error: 'Invalid request body' });
                return;
            }
            const template = await templateDb.getTemplateById(source.templateId);
            if (!template) {
                res.status(404).json({ error: 'Template not found' });
                return;
            }
            if (!(await userCanAccessTemplate(template, userId))) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            dashboard = createDashboard(userId, {
                name: name.trim() || template.name,
                widgets: regenerateWidgetIds(template.widgets),
                mobileLayoutMode: template.mobileLayoutMode || 'linked',
                mobileWidgets:
                    template.mobileLayoutMode === 'independent' && template.mobileWidgets
                        ? regenerateWidgetIds(template.mobileWidgets)
                        : undefined,
            });
        }

        invalidateUserSettings(userId, 'dashboards');
        invalidateUserSettings(userId, 'widgets');

        res.status(201).json({ dashboard });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Dashboards] Failed to create: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to create dashboard' });
    }
});

/**
 * PUT /api/dashboards/preferences — must be registered before /:id
 */
router.put('/preferences', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { homeDashboardId, rememberLastDashboard } = req.body as {
            homeDashboardId?: string;
            rememberLastDashboard?: boolean;
        };

        const prefs = setDashboardPrefs(userId, {
            ...(homeDashboardId !== undefined ? { homeDashboardId } : {}),
            ...(rememberLastDashboard !== undefined ? { rememberLastDashboard } : {}),
        });

        if (!prefs) {
            res.status(400).json({ error: 'Invalid home dashboard' });
            return;
        }

        invalidateUserSettings(userId, 'dashboards');
        res.json(prefs);
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Dashboards] Failed to set preferences: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to update dashboard preferences' });
    }
});

/**
 * PATCH /api/dashboards/:id
 */
router.patch('/:id', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { name, position, icon, fixedDisplay } = req.body as {
            name?: string;
            position?: number;
            icon?: string | null;
            fixedDisplay?: boolean;
        };

        if (fixedDisplay !== undefined && typeof fixedDisplay !== 'boolean') {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }
        if (icon !== undefined && icon !== null && typeof icon !== 'string') {
            res.status(400).json({ error: 'Invalid icon' });
            return;
        }
        if (typeof icon === 'string' && icon.trim().length > 200) {
            res.status(400).json({ error: 'Invalid icon' });
            return;
        }

        const dashboard = updateDashboardMeta(userId, req.params.id, { name, position, icon, fixedDisplay });
        if (!dashboard) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        invalidateUserSettings(userId, 'dashboards');
        res.json({ dashboard });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Dashboards] Failed to update: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to update dashboard' });
    }
});

/**
 * DELETE /api/dashboards/:id
 */
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const result = deleteDashboard(userId, req.params.id);

        if (!result) {
            res.status(404).json({ error: 'Dashboard not found' });
            return;
        }

        invalidateUserSettings(userId, 'dashboards');
        invalidateUserSettings(userId, 'widgets');
        res.json(result);
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Dashboards] Failed to delete: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to delete dashboard' });
    }
});

router.use('/:dashboardId/widgets', widgetsRouter);

export default router;
