/**
 * Backup User Export/Import Routes
 *
 * User config export/import and system config export.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { getUserConfig, updateUserConfig } from '../../db/userConfig';
import {
    listDashboards,
    getDashboard,
    createDashboard,
    setDashboardPrefs,
    updateDashboardMeta,
} from '../../db/dashboards';
import { getDb } from '../../database/db';
import { getSystemConfig } from '../../db/systemConfig';
import { getAllUsers } from '../../db/users';
import logger from '../../utils/logger';
import { AuthenticatedRequest, ImportBody, ImportData, ImportedDashboardEntry } from './types';

const router = Router();

interface LegacyDashboardShape {
    widgets?: unknown[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: unknown[];
    layout?: unknown[];
}

function buildDashboardExportEntries(userId: string): {
    dashboards: ImportedDashboardEntry[];
    rememberLastDashboard: boolean;
} {
    const { dashboards, homeDashboardId, rememberLastDashboard } = listDashboards(userId);

    const exported = dashboards.map(meta => {
        const full = getDashboard(userId, meta.id)!;
        return {
            name: full.name,
            widgets: full.widgets,
            mobileLayoutMode: full.mobileLayoutMode,
            mobileWidgets: full.mobileWidgets,
            position: full.position,
            isHome: full.id === homeDashboardId,
            fixedDisplay: full.fixedDisplay,
        };
    });

    return { dashboards: exported, rememberLastDashboard };
}

function replaceDashboardsFromImport(
    userId: string,
    entries: ImportedDashboardEntry[],
    rememberLastDashboard?: boolean
): void {
    getDb().prepare('DELETE FROM dashboards WHERE user_id = ?').run(userId);

    const sorted = [...entries].sort((a, b) => a.position - b.position);
    let homeId: string | undefined;
    const createdIds: string[] = [];

    for (const entry of sorted) {
        const created = createDashboard(userId, {
            name: entry.name || 'Dashboard',
            widgets: entry.widgets ?? [],
            mobileLayoutMode: entry.mobileLayoutMode ?? 'linked',
            mobileWidgets: entry.mobileWidgets,
            fixedDisplay: entry.fixedDisplay ?? false,
        });
        createdIds.push(created.id);
        if (entry.isHome) {
            homeId = created.id;
        }
        if (entry.position !== created.position) {
            updateDashboardMeta(userId, created.id, { position: entry.position });
        }
    }

    if (!homeId && createdIds.length > 0) {
        homeId = createdIds[0];
    }

    if (homeId) {
        setDashboardPrefs(userId, {
            homeDashboardId: homeId,
            rememberLastDashboard: rememberLastDashboard ?? false,
        });
    }
}

/**
 * GET /api/backup/export
 */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);
        const { dashboards, rememberLastDashboard } = buildDashboardExportEntries(authReq.user!.id);

        const backup = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            user: {
                username: authReq.user!.username,
                displayName: authReq.user!.displayName,
            },
            data: {
                dashboards,
                rememberLastDashboard,
                tabs: userConfig.tabs,
                theme: userConfig.theme,
                sidebar: userConfig.sidebar,
            },
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `dashboard-backup-${authReq.user!.username}-${timestamp}.json`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(backup);

        logger.info(
            `[Backup] User config exported: user=${authReq.user!.id} username="${authReq.user!.username}" dashboards=${dashboards.length}`
        );
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Backup] Failed to export user config: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to export configuration' });
    }
});

/**
 * POST /api/backup/import
 */
router.post('/import', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { data } = req.body as ImportBody;

        if (!data || typeof data !== 'object') {
            res.status(400).json({
                error: 'Invalid backup data. Must include "data" object.',
            });
            return;
        }

        const importedFields: string[] = [];

        if (Array.isArray(data.dashboards) && data.dashboards.length > 0) {
            replaceDashboardsFromImport(
                userId,
                data.dashboards as ImportedDashboardEntry[],
                data.rememberLastDashboard
            );
            importedFields.push('dashboards');
        } else if (data.dashboard) {
            const legacy = data.dashboard as LegacyDashboardShape;
            replaceDashboardsFromImport(userId, [
                {
                    name: 'Dashboard',
                    widgets: legacy.widgets ?? [],
                    mobileLayoutMode: legacy.mobileLayoutMode ?? 'linked',
                    mobileWidgets: legacy.mobileWidgets,
                    position: 0,
                    isHome: true,
                },
            ]);
            importedFields.push('dashboards');
        }

        const configUpdates: Parameters<typeof updateUserConfig>[1] = {};
        if (data.tabs) {
            configUpdates.tabs = data.tabs as Parameters<typeof updateUserConfig>[1]['tabs'];
            importedFields.push('tabs');
        }
        if (data.theme) {
            configUpdates.theme = data.theme as Parameters<typeof updateUserConfig>[1]['theme'];
            importedFields.push('theme');
        }
        if (data.sidebar) {
            configUpdates.sidebar = data.sidebar as Parameters<typeof updateUserConfig>[1]['sidebar'];
            importedFields.push('sidebar');
        }

        if (importedFields.length === 0) {
            res.status(400).json({ error: 'No valid data to import' });
            return;
        }

        if (Object.keys(configUpdates).length > 0) {
            await updateUserConfig(userId, configUpdates);
        }

        logger.info(
            `[Backup] User config imported: user=${userId} fields=[${importedFields.join(',')}]`
        );

        res.json({
            success: true,
            imported: importedFields,
            message: 'Configuration imported successfully. Please refresh the page.',
        });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Backup] Failed to import user config: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to import configuration' });
    }
});

/**
 * GET /api/backup/system
 */
router.get('/system', requireAdmin, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const systemConfig = await getSystemConfig();
        const users = await getAllUsers();

        const userConfigs: Record<string, unknown> = {};
        for (const user of users) {
            try {
                const config = await getUserConfig(user.id);
                const dashboards = listDashboards(user.id);
                userConfigs[user.id] = {
                    username: user.username,
                    displayName: user.displayName,
                    group: user.group,
                    config,
                    dashboards,
                };
            } catch (err) {
                logger.warn(
                    `[Backup] Failed to load config for user: user="${user.username}" error="${(err as Error).message}"`
                );
            }
        }

        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: authReq.user!.username,
            system: systemConfig,
            users: userConfigs,
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `dashboard-system-backup-${timestamp}.json`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(backup);

        logger.info(
            `[Backup] System backup exported: admin="${authReq.user!.username}" users=${Object.keys(userConfigs).length}`
        );
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(
            `[Backup] Failed to export system backup: user=${authReq.user?.id} error="${(error as Error).message}"`
        );
        res.status(500).json({ error: 'Failed to export system backup' });
    }
});

export default router;
