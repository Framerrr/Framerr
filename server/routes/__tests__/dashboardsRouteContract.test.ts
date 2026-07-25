/**
 * Dashboards route contract tests (multi-dashboard Phase 2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');

vi.mock('../../database/db', () => ({
    getDb: () => testDb,
}));

vi.mock('../../utils/invalidateUserSettings', () => ({
    invalidateUserSettings: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import dashboardsRouter from '../dashboards';
import { v4 as uuidv4 } from 'uuid';

function createSchema(): void {
    testDb.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            group_id TEXT NOT NULL DEFAULT 'user'
        );

        CREATE TABLE user_preferences (
            user_id TEXT PRIMARY KEY,
            tabs TEXT DEFAULT '[]',
            theme_config TEXT DEFAULT '{}',
            sidebar_config TEXT DEFAULT '{}',
            preferences TEXT DEFAULT '{}',
            home_dashboard_id TEXT,
            remember_last_dashboard INTEGER NOT NULL DEFAULT 0
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
    testDb.exec('DELETE FROM user_preferences');
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
    app.use('/api/dashboards', dashboardsRouter);
    return app;
}

describe('dashboardsRouteContract', () => {
    beforeEach(() => {
        testDb.exec('DROP TABLE IF EXISTS dashboards');
        testDb.exec('DROP TABLE IF EXISTS user_preferences');
        testDb.exec('DROP TABLE IF EXISTS users');
        createSchema();
        resetDb();
    });

    it('first GET creates user_preferences row and blank Home Dashboard', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'fresh-user',
            'fresh',
            'hash'
        );

        const app = createApp('fresh-user');
        const res = await request(app).get('/api/dashboards');

        expect(res.status).toBe(200);
        expect(res.body.dashboards).toHaveLength(1);
        expect(res.body.dashboards[0].name).toBe('Dashboard');
        expect(res.body.rememberLastDashboard).toBe(false);
        expect(res.body.homeDashboardId).toBe(res.body.dashboards[0].id);

        const pref = testDb
            .prepare('SELECT user_id FROM user_preferences WHERE user_id = ?')
            .get('fresh-user');
        expect(pref).toBeTruthy();
    });

    it('DELETE last dashboard recreates blank Home', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-a',
            'a',
            'hash'
        );
        const app = createApp('user-a');

        const list = await request(app).get('/api/dashboards');
        const onlyId = list.body.dashboards[0].id;

        const del = await request(app).delete(`/api/dashboards/${onlyId}`);
        expect(del.status).toBe(200);
        expect(del.body.dashboards).toHaveLength(1);
        expect(del.body.dashboards[0].id).not.toBe(onlyId);
        expect(del.body.homeDashboardId).toBe(del.body.dashboards[0].id);
    });

    it('POST creates an additional dashboard', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-post',
            'post',
            'hash'
        );
        const app = createApp('user-post');
        await request(app).get('/api/dashboards');

        const created = await request(app)
            .post('/api/dashboards')
            .send({ name: 'Second', source: { type: 'blank' } });

        expect(created.status).toBe(201);
        expect(created.body.dashboard.name).toBe('Second');

        const list = await request(app).get('/api/dashboards');
        expect(list.body.dashboards).toHaveLength(2);
    });

    it('DELETE Home promotes lowest-position survivor', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-b',
            'b',
            'hash'
        );
        const app = createApp('user-b');

        const initial = await request(app).get('/api/dashboards');
        const homeId = initial.body.homeDashboardId as string;

        const secondId = uuidv4();
        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, position, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`
            )
            .run(secondId, 'user-b', 'Second', '[]', 'linked', 1);

        const del = await request(app).delete(`/api/dashboards/${homeId}`);
        expect(del.status).toBe(200);
        expect(del.body.dashboards).toHaveLength(1);
        expect(del.body.dashboards[0].name).toBe('Second');
        expect(del.body.homeDashboardId).toBe(secondId);
    });

    it('PUT /preferences returns 400 for foreign home dashboard id', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-c',
            'c',
            'hash'
        );
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'other-user',
            'other',
            'hash'
        );

        const otherApp = createApp('other-user');
        const otherList = await request(otherApp).get('/api/dashboards');
        const foreignHomeId = otherList.body.homeDashboardId;

        const app = createApp('user-c');
        await request(app).get('/api/dashboards');

        const res = await request(app)
            .put('/api/dashboards/preferences')
            .send({ homeDashboardId: foreignHomeId });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid home dashboard');
    });

    it('scoped widgets GET returns 404 for another users dashboard id', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'owner',
            'owner',
            'hash'
        );
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'intruder',
            'intruder',
            'hash'
        );

        const ownerApp = createApp('owner');
        const ownerList = await request(ownerApp).get('/api/dashboards');
        const ownerDashId = ownerList.body.homeDashboardId;

        const intruderApp = createApp('intruder');
        const res = await request(intruderApp).get(
            `/api/dashboards/${ownerDashId}/widgets`
        );

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Dashboard not found');
    });

    it('list response includes fixedDisplay default false', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-fd-list',
            'fdlist',
            'hash'
        );
        const app = createApp('user-fd-list');
        const res = await request(app).get('/api/dashboards');
        expect(res.status).toBe(200);
        expect(res.body.dashboards[0].fixedDisplay).toBe(false);
    });

    it('PATCH fixedDisplay persists and isolates dashboards', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-fd-patch',
            'fdpatch',
            'hash'
        );
        const app = createApp('user-fd-patch');
        const list = await request(app).get('/api/dashboards');
        const dashA = list.body.dashboards[0].id as string;

        const secondId = uuidv4();
        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, icon, fixed_display, widgets, mobile_layout_mode, position, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`
            )
            .run(secondId, 'user-fd-patch', 'Second', null, 0, '[]', 'linked', 1);

        const patch = await request(app)
            .patch(`/api/dashboards/${dashA}`)
            .send({ fixedDisplay: true });
        expect(patch.status).toBe(200);
        expect(patch.body.dashboard.fixedDisplay).toBe(true);

        const rowB = testDb
            .prepare(`SELECT fixed_display FROM dashboards WHERE id = ?`)
            .get(secondId) as { fixed_display: number };
        expect(rowB.fixed_display).toBe(0);
    });

    it('PATCH rejects non-boolean fixedDisplay with 400', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-fd-bad',
            'fdbad',
            'hash'
        );
        const app = createApp('user-fd-bad');
        const list = await request(app).get('/api/dashboards');
        const dashId = list.body.dashboards[0].id;

        const res = await request(app)
            .patch(`/api/dashboards/${dashId}`)
            .send({ fixedDisplay: 'yes' });
        expect(res.status).toBe(400);
    });

    it('PATCH name-only leaves fixedDisplay unchanged', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-fd-name',
            'fdname',
            'hash'
        );
        const app = createApp('user-fd-name');
        const list = await request(app).get('/api/dashboards');
        const dashId = list.body.dashboards[0].id as string;
        testDb.prepare(`UPDATE dashboards SET fixed_display = 1 WHERE id = ?`).run(dashId);

        const res = await request(app).patch(`/api/dashboards/${dashId}`).send({ name: 'Renamed' });
        expect(res.status).toBe(200);
        expect(res.body.dashboard.fixedDisplay).toBe(true);
        expect(res.body.dashboard.name).toBe('Renamed');
    });

    it('clone copies fixedDisplay; blank template create defaults false', async () => {
        testDb.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
            'user-fd-clone',
            'fdclone',
            'hash'
        );
        const app = createApp('user-fd-clone');
        const list = await request(app).get('/api/dashboards');
        const srcId = list.body.dashboards[0].id as string;
        testDb.prepare(`UPDATE dashboards SET fixed_display = 1 WHERE id = ?`).run(srcId);

        const cloned = await request(app)
            .post('/api/dashboards')
            .send({ name: 'Kiosk Copy', source: { type: 'clone', dashboardId: srcId } });
        expect(cloned.status).toBe(201);
        expect(cloned.body.dashboard.fixedDisplay).toBe(true);

        const blank = await request(app)
            .post('/api/dashboards')
            .send({ name: 'Normal', source: { type: 'blank' } });
        expect(blank.status).toBe(201);
        expect(blank.body.dashboard.fixedDisplay).toBe(false);
    });
});
