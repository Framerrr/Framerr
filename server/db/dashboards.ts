/**
 * Dashboard data access — multi-dashboard storage (dashboards table + user prefs).
 */

import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface Dashboard {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    fixedDisplay: boolean;
    widgets: unknown[];
    mobileLayoutMode: 'linked' | 'independent';
    mobileWidgets?: unknown[];
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardMeta {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    fixedDisplay: boolean;
    mobileLayoutMode: 'linked' | 'independent';
    position: number;
    widgetCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardPrefs {
    homeDashboardId: string;
    rememberLastDashboard: boolean;
}

interface DashboardRow {
    id: string;
    user_id: string;
    name: string;
    icon: string | null;
    fixed_display: number;
    widgets: string;
    mobile_layout_mode: string;
    mobile_widgets: string | null;
    position: number;
    created_at: number;
    updated_at: number;
}

interface UserPrefsRow {
    home_dashboard_id: string | null;
    remember_last_dashboard: number;
}

function parseWidgets(json: string): unknown[] {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        logger.warn('[Dashboards] Failed to parse widgets JSON');
        return [];
    }
}

function parseOptionalWidgets(json: string | null): unknown[] | undefined {
    if (json == null) return undefined;
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : undefined;
    } catch {
        logger.warn('[Dashboards] Failed to parse mobile_widgets JSON');
        return undefined;
    }
}

function normalizeIcon(icon: string | null | undefined): string | null {
    if (typeof icon !== 'string') return null;
    const trimmed = icon.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function rowToDashboard(row: DashboardRow): Dashboard {
    const mobileWidgets = parseOptionalWidgets(row.mobile_widgets);
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        icon: normalizeIcon(row.icon),
        fixedDisplay: row.fixed_display === 1,
        widgets: parseWidgets(row.widgets),
        mobileLayoutMode:
            row.mobile_layout_mode === 'independent' ? 'independent' : 'linked',
        ...(mobileWidgets !== undefined ? { mobileWidgets } : {}),
        position: row.position,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
    };
}

function rowToDashboardMeta(row: DashboardRow): DashboardMeta {
    const widgets = parseWidgets(row.widgets);
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        icon: normalizeIcon(row.icon),
        fixedDisplay: row.fixed_display === 1,
        mobileLayoutMode:
            row.mobile_layout_mode === 'independent' ? 'independent' : 'linked',
        position: row.position,
        widgetCount: widgets.length,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
    };
}

function ensureUserPreferencesRow(userId: string): void {
    getDb()
        .prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)')
        .run(userId);
}

function getDashboardRowsForUser(userId: string): DashboardRow[] {
    return getDb()
        .prepare(
            `SELECT id, user_id, name, icon, fixed_display, widgets, mobile_layout_mode, mobile_widgets, position, created_at, updated_at
             FROM dashboards WHERE user_id = ? ORDER BY position ASC, created_at ASC`
        )
        .all(userId) as DashboardRow[];
}

function readUserPrefs(userId: string): UserPrefsRow {
    ensureUserPreferencesRow(userId);
    const row = getDb()
        .prepare(
            'SELECT home_dashboard_id, remember_last_dashboard FROM user_preferences WHERE user_id = ?'
        )
        .get(userId) as UserPrefsRow | undefined;

    return {
        home_dashboard_id: row?.home_dashboard_id ?? null,
        remember_last_dashboard: row?.remember_last_dashboard ?? 0,
    };
}

function insertDashboardRow(
    userId: string,
    data: {
        name: string;
        icon?: string | null;
        fixedDisplay?: boolean;
        widgets: unknown[];
        mobileLayoutMode: 'linked' | 'independent';
        mobileWidgets?: unknown[];
        position: number;
    }
): Dashboard {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const trimmedName = data.name.trim();
    const name = trimmedName.length > 0 ? trimmedName : 'Dashboard';
    const icon = normalizeIcon(data.icon);

    getDb()
        .prepare(
            `INSERT INTO dashboards (
                id, user_id, name, icon, fixed_display, widgets, mobile_layout_mode, mobile_widgets, position, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            id,
            userId,
            name,
            icon,
            data.fixedDisplay ? 1 : 0,
            JSON.stringify(data.widgets ?? []),
            data.mobileLayoutMode,
            data.mobileWidgets != null ? JSON.stringify(data.mobileWidgets) : null,
            data.position,
            now,
            now
        );

    const row = getDb()
        .prepare(
            `SELECT id, user_id, name, icon, fixed_display, widgets, mobile_layout_mode, mobile_widgets, position, created_at, updated_at
             FROM dashboards WHERE id = ?`
        )
        .get(id) as DashboardRow;

    return rowToDashboard(row);
}

function healHomeDashboardId(userId: string, rows: DashboardRow[]): string {
    const prefs = readUserPrefs(userId);
    const ids = new Set(rows.map(r => r.id));
    let homeId = prefs.home_dashboard_id;

    if (!homeId || !ids.has(homeId)) {
        homeId = rows[0].id;
        getDb()
            .prepare('UPDATE user_preferences SET home_dashboard_id = ? WHERE user_id = ?')
            .run(homeId, userId);
    }

    return homeId;
}

function ensureAtLeastOneDashboard(userId: string): DashboardRow[] {
    let rows = getDashboardRowsForUser(userId);
    if (rows.length === 0) {
        insertDashboardRow(userId, {
            name: 'Dashboard',
            widgets: [],
            mobileLayoutMode: 'linked',
            position: 0,
        });
        rows = getDashboardRowsForUser(userId);
    }
    return rows;
}

/**
 * Regenerate widget ids (shared by clone / template apply).
 */
export function regenerateWidgetIds(widgets: unknown[]): unknown[] {
    return widgets.map((tw, index) => ({
        ...(typeof tw === 'object' && tw !== null ? tw : {}),
        id: `widget-${Date.now()}-${index}`,
    }));
}

export function listDashboards(userId: string): {
    dashboards: DashboardMeta[];
    homeDashboardId: string;
    rememberLastDashboard: boolean;
} {
    try {
        return getDb().transaction(() => {
            ensureUserPreferencesRow(userId);
            const rows = ensureAtLeastOneDashboard(userId);
            const homeDashboardId = healHomeDashboardId(userId, rows);
            const prefs = readUserPrefs(userId);

            return {
                dashboards: rows.map(rowToDashboardMeta),
                homeDashboardId,
                rememberLastDashboard: prefs.remember_last_dashboard === 1,
            };
        })();
    } catch (error) {
        logger.error(
            `[Dashboards] listDashboards failed: user=${userId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function getDashboard(userId: string, dashboardId: string): Dashboard | null {
    try {
        const row = getDb()
            .prepare(
                `SELECT id, user_id, name, icon, fixed_display, widgets, mobile_layout_mode, mobile_widgets, position, created_at, updated_at
                 FROM dashboards WHERE id = ? AND user_id = ?`
            )
            .get(dashboardId, userId) as DashboardRow | undefined;

        return row ? rowToDashboard(row) : null;
    } catch (error) {
        logger.error(
            `[Dashboards] getDashboard failed: user=${userId} id=${dashboardId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function createDashboard(
    userId: string,
    data: {
        name: string;
        icon?: string | null;
        widgets?: unknown[];
        mobileLayoutMode?: 'linked' | 'independent';
        mobileWidgets?: unknown[];
        fixedDisplay?: boolean;
    }
): Dashboard {
    try {
        const maxRow = getDb()
            .prepare('SELECT MAX(position) as maxPos FROM dashboards WHERE user_id = ?')
            .get(userId) as { maxPos: number | null } | undefined;

        const position = (maxRow?.maxPos ?? -1) + 1;

        return insertDashboardRow(userId, {
            name: data.name,
            icon: data.icon,
            fixedDisplay: data.fixedDisplay ?? false,
            widgets: data.widgets ?? [],
            mobileLayoutMode: data.mobileLayoutMode ?? 'linked',
            mobileWidgets: data.mobileWidgets,
            position,
        });
    } catch (error) {
        logger.error(
            `[Dashboards] createDashboard failed: user=${userId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function updateDashboardMeta(
    userId: string,
    dashboardId: string,
    updates: { name?: string; position?: number; icon?: string | null; fixedDisplay?: boolean }
): Dashboard | null {
    try {
        const existing = getDashboard(userId, dashboardId);
        if (!existing) return null;

        const sets: string[] = ['updated_at = strftime(\'%s\', \'now\')'];
        const params: (string | number | null)[] = [];

        if (updates.name !== undefined) {
            const trimmed = updates.name.trim();
            sets.push('name = ?');
            params.push(trimmed.length > 0 ? trimmed : 'Dashboard');
        }
        if (updates.position !== undefined) {
            sets.push('position = ?');
            params.push(updates.position);
        }
        if (updates.icon !== undefined) {
            sets.push('icon = ?');
            params.push(normalizeIcon(updates.icon));
        }
        if (updates.fixedDisplay !== undefined) {
            sets.push('fixed_display = ?');
            params.push(updates.fixedDisplay ? 1 : 0);
        }

        if (params.length === 0) {
            return existing;
        }

        params.push(dashboardId, userId);
        getDb()
            .prepare(
                `UPDATE dashboards SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
            )
            .run(...params);

        return getDashboard(userId, dashboardId);
    } catch (error) {
        logger.error(
            `[Dashboards] updateDashboardMeta failed: user=${userId} id=${dashboardId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function saveDashboardWidgets(
    userId: string,
    dashboardId: string,
    data: {
        widgets: unknown[];
        mobileLayoutMode?: 'linked' | 'independent';
        mobileWidgets?: unknown[];
    }
): Dashboard | null {
    try {
        const existing = getDashboard(userId, dashboardId);
        if (!existing) return null;

        const mobileLayoutMode = data.mobileLayoutMode ?? existing.mobileLayoutMode;
        const mobileWidgetsJson =
            data.mobileWidgets !== undefined
                ? JSON.stringify(data.mobileWidgets)
                : existing.mobileWidgets !== undefined
                  ? JSON.stringify(existing.mobileWidgets)
                  : null;

        getDb()
            .prepare(
                `UPDATE dashboards
                 SET widgets = ?, mobile_layout_mode = ?, mobile_widgets = ?, updated_at = strftime('%s', 'now')
                 WHERE id = ? AND user_id = ?`
            )
            .run(
                JSON.stringify(data.widgets),
                mobileLayoutMode,
                mobileWidgetsJson,
                dashboardId,
                userId
            );

        return getDashboard(userId, dashboardId);
    } catch (error) {
        logger.error(
            `[Dashboards] saveDashboardWidgets failed: user=${userId} id=${dashboardId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function deleteDashboard(
    userId: string,
    dashboardId: string
): { dashboards: DashboardMeta[]; homeDashboardId: string } | null {
    try {
        return getDb().transaction(() => {
            const existing = getDashboard(userId, dashboardId);
            if (!existing) return null;

            ensureUserPreferencesRow(userId);
            const prefsBefore = readUserPrefs(userId);
            const wasHome = prefsBefore.home_dashboard_id === dashboardId;

            getDb()
                .prepare('DELETE FROM dashboards WHERE id = ? AND user_id = ?')
                .run(dashboardId, userId);

            let rows = getDashboardRowsForUser(userId);

            if (rows.length === 0) {
                insertDashboardRow(userId, {
                    name: 'Dashboard',
                    widgets: [],
                    mobileLayoutMode: 'linked',
                    position: 0,
                });
                rows = getDashboardRowsForUser(userId);
                getDb()
                    .prepare(
                        'UPDATE user_preferences SET home_dashboard_id = ? WHERE user_id = ?'
                    )
                    .run(rows[0].id, userId);
            } else if (wasHome) {
                getDb()
                    .prepare(
                        'UPDATE user_preferences SET home_dashboard_id = ? WHERE user_id = ?'
                    )
                    .run(rows[0].id, userId);
            }

            const homeDashboardId = healHomeDashboardId(userId, rows);
            const finalRows = getDashboardRowsForUser(userId);

            return {
                dashboards: finalRows.map(rowToDashboardMeta),
                homeDashboardId,
            };
        })();
    } catch (error) {
        logger.error(
            `[Dashboards] deleteDashboard failed: user=${userId} id=${dashboardId} error="${(error as Error).message}"`
        );
        throw error;
    }
}

export function getDashboardPrefs(userId: string): DashboardPrefs {
    const state = listDashboards(userId);
    return {
        homeDashboardId: state.homeDashboardId,
        rememberLastDashboard: state.rememberLastDashboard,
    };
}

export function setDashboardPrefs(
    userId: string,
    updates: { homeDashboardId?: string; rememberLastDashboard?: boolean }
): DashboardPrefs | null {
    try {
        return getDb().transaction(() => {
            ensureUserPreferencesRow(userId);
            const rows = ensureAtLeastOneDashboard(userId);
            healHomeDashboardId(userId, rows);

            if (updates.homeDashboardId !== undefined) {
                const owned = rows.some(r => r.id === updates.homeDashboardId);
                if (!owned) {
                    return null;
                }
                getDb()
                    .prepare(
                        'UPDATE user_preferences SET home_dashboard_id = ? WHERE user_id = ?'
                    )
                    .run(updates.homeDashboardId, userId);
            }

            if (updates.rememberLastDashboard !== undefined) {
                getDb()
                    .prepare(
                        'UPDATE user_preferences SET remember_last_dashboard = ? WHERE user_id = ?'
                    )
                    .run(updates.rememberLastDashboard ? 1 : 0, userId);
            }

            const prefs = readUserPrefs(userId);
            const homeDashboardId = healHomeDashboardId(userId, getDashboardRowsForUser(userId));

            return {
                homeDashboardId,
                rememberLastDashboard: prefs.remember_last_dashboard === 1,
            };
        })();
    } catch (error) {
        logger.error(
            `[Dashboards] setDashboardPrefs failed: user=${userId} error="${(error as Error).message}"`
        );
        throw error;
    }
}
