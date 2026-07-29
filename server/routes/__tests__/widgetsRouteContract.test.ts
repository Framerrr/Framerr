/**
 * Widgets route contract tests — PUT integrationId clear-protection (TASK-20260725-002)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const testDb = new Database(':memory:');

vi.mock('../../database/db', () => ({
    getDb: () => testDb,
}));

vi.mock('../../utils/invalidateUserSettings', () => ({
    invalidateUserSettings: vi.fn(),
}));

vi.mock('../../db/mediaSearchHistory', () => ({
    clearSearchHistoryForWidgets: vi.fn(() => 0),
}));

vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import widgetsRouter from '../widgets';

function createSchema(): void {
    testDb.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            group_id TEXT NOT NULL DEFAULT 'user'
        );

        CREATE TABLE dashboards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            icon TEXT,
            fixed_display INTEGER NOT NULL DEFAULT 0,
            widgets TEXT NOT NULL DEFAULT '[]',
            mobile_layout_mode TEXT NOT NULL DEFAULT 'linked',
            mobile_widgets TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
    `);
}

function resetDb(): void {
    testDb.exec('DELETE FROM dashboards');
    testDb.exec('DELETE FROM users');
}

function createApp(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = { id: userId, username: userId, group: 'user' };
        next();
    });
    app.use('/api/dashboards/:dashboardId/widgets', widgetsRouter);
    return app;
}

function readWidgets(dashboardId: string): unknown[] {
    const row = testDb
        .prepare('SELECT widgets FROM dashboards WHERE id = ?')
        .get(dashboardId) as { widgets: string };
    return JSON.parse(row.widgets);
}

function readMobileWidgets(dashboardId: string): unknown[] {
    const row = testDb
        .prepare('SELECT mobile_widgets FROM dashboards WHERE id = ?')
        .get(dashboardId) as { mobile_widgets: string | null };
    return row.mobile_widgets ? JSON.parse(row.mobile_widgets) : [];
}

describe('widgetsRouteContract PUT integrationId protection', () => {
    const userId = 'widget-user';
    let dashboardId: string;
    let app: ReturnType<typeof createApp>;
    const widgetId = 'w-tautulli-1';

    beforeEach(() => {
        testDb.exec('DROP TABLE IF EXISTS dashboards');
        testDb.exec('DROP TABLE IF EXISTS users');
        createSchema();
        resetDb();

        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            userId,
            userId,
            'hash',
        );

        dashboardId = uuidv4();
        const storedWidgets = [
            {
                id: widgetId,
                type: 'tautulli',
                config: { integrationId: 'tautulli-bound', title: 'Old Title' },
            },
        ];
        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, icon, widgets, mobile_layout_mode, mobile_widgets, position, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, strftime('%s', 'now'), strftime('%s', 'now'))`,
            )
            .run(
                dashboardId,
                userId,
                'Home',
                null,
                JSON.stringify(storedWidgets),
                'independent',
                JSON.stringify([
                    {
                        id: 'mobile-w1',
                        type: 'tautulli',
                        config: { integrationId: 'mobile-bound' },
                    },
                ]),
            );

        app = createApp(userId);
    });

    it('preserves integrationId when incoming PUT config drops it without forceClearIntegration', async () => {
        const res = await request(app)
            .put(`/api/dashboards/${dashboardId}/widgets`)
            .send({
                widgets: [{ id: widgetId, type: 'tautulli', config: { title: 'New Title' } }],
            });

        expect(res.status).toBe(200);
        const saved = readWidgets(dashboardId) as { config: Record<string, unknown> }[];
        expect(saved[0].config.integrationId).toBe('tautulli-bound');
        expect(saved[0].config.title).toBe('New Title');
        expect(res.body.widgets[0].config.integrationId).toBe('tautulli-bound');
    });

    it('allows intentional clear when forceClearIntegration is true', async () => {
        const res = await request(app)
            .put(`/api/dashboards/${dashboardId}/widgets`)
            .send({
                widgets: [
                    {
                        id: widgetId,
                        type: 'tautulli',
                        config: { forceClearIntegration: true },
                    },
                ],
            });

        expect(res.status).toBe(200);
        const saved = readWidgets(dashboardId) as { config: Record<string, unknown> }[];
        expect(saved[0].config.integrationId).toBeUndefined();
    });

    it('accepts a different incoming integrationId', async () => {
        const res = await request(app)
            .put(`/api/dashboards/${dashboardId}/widgets`)
            .send({
                widgets: [
                    {
                        id: widgetId,
                        type: 'tautulli',
                        config: { integrationId: 'tautulli-new' },
                    },
                ],
            });

        expect(res.status).toBe(200);
        const saved = readWidgets(dashboardId) as { config: Record<string, unknown> }[];
        expect(saved[0].config.integrationId).toBe('tautulli-new');
    });

    it('passes through new widgets without prior integrationId protection', async () => {
        const newId = 'brand-new-widget';
        const res = await request(app)
            .put(`/api/dashboards/${dashboardId}/widgets`)
            .send({
                widgets: [
                    { id: widgetId, type: 'tautulli', config: { integrationId: 'tautulli-bound' } },
                    { id: newId, type: 'tautulli', config: {} },
                ],
            });

        expect(res.status).toBe(200);
        const saved = readWidgets(dashboardId) as { id: string; config: Record<string, unknown> }[];
        const created = saved.find((w) => w.id === newId);
        expect(created?.config.integrationId).toBeUndefined();
    });

    it('applies the same protection to mobileWidgets', async () => {
        const res = await request(app)
            .put(`/api/dashboards/${dashboardId}/widgets`)
            .send({
                widgets: [{ id: widgetId, type: 'tautulli', config: { integrationId: 'tautulli-bound' } }],
                mobileWidgets: [{ id: 'mobile-w1', type: 'tautulli', config: {} }],
            });

        expect(res.status).toBe(200);
        const mobile = readMobileWidgets(dashboardId) as { config: Record<string, unknown> }[];
        expect(mobile[0].config.integrationId).toBe('mobile-bound');
    });
});
