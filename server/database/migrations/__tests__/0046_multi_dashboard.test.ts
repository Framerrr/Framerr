/**
 * Migration 0046 — multi-dashboard characterization tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import path from 'node:path';
import { register } from 'ts-node';

register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const migrationFile = path.join(__dirname, '..', '0046_multi_dashboard.js');
const migrationRequire = createRequire(migrationFile);

const migration46 = migrationRequire('./0046_multi_dashboard.js') as {
    version: number;
    up: (db: Database.Database) => void;
};

function createV45Schema(db: Database.Database): void {
    db.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            group_id TEXT NOT NULL DEFAULT 'user',
            is_setup_admin INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            last_login INTEGER
        );

        CREATE TABLE user_preferences (
            user_id TEXT PRIMARY KEY,
            dashboard_config TEXT DEFAULT '{"widgets":[]}',
            tabs TEXT DEFAULT '[]',
            theme_config TEXT DEFAULT '{"mode":"system"}',
            sidebar_config TEXT DEFAULT '{"collapsed":false}',
            preferences TEXT DEFAULT '{}',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE dashboard_backups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            widgets TEXT NOT NULL,
            mobile_layout_mode TEXT NOT NULL DEFAULT 'linked',
            mobile_widgets TEXT,
            backed_up_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
    `);
    db.pragma('user_version = 45');
}

function tableExists(db: Database.Database, name: string): boolean {
    const row = db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        )
        .get(name) as { name: string } | undefined;
    return Boolean(row);
}

describe('Migration 0046: multi_dashboard', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        createV45Schema(db);
    });

    it('seeds Home Dashboard rows, sets prefs, drops dashboard_backups', () => {
        db.prepare(
            `INSERT INTO users (id, username, password, group_id) VALUES (?, ?, ?, ?)`
        ).run('user-good', 'good', 'hash', 'user');
        db.prepare(
            `INSERT INTO users (id, username, password, group_id) VALUES (?, ?, ?, ?)`
        ).run('user-bad-json', 'badjson', 'hash', 'user');
        db.prepare(
            `INSERT INTO users (id, username, password, group_id) VALUES (?, ?, ?, ?)`
        ).run('user-mobile', 'mobile', 'hash', 'user');

        const goodConfig = JSON.stringify({
            layout: [],
            widgets: [{ id: 'w1', type: 'clock', config: {} }],
            mobileLayoutMode: 'linked',
        });
        db.prepare(
            `INSERT INTO user_preferences (user_id, dashboard_config) VALUES (?, ?)`
        ).run('user-good', goodConfig);

        db.prepare(
            `INSERT INTO user_preferences (user_id, dashboard_config) VALUES (?, ?)`
        ).run('user-bad-json', '{not valid json');

        const mobileConfig = JSON.stringify({
            layout: [],
            widgets: [{ id: 'd1', type: 'stats', config: {} }],
            mobileLayoutMode: 'independent',
            mobileWidgets: [{ id: 'm1', type: 'clock', config: {} }],
        });
        db.prepare(
            `INSERT INTO user_preferences (user_id, dashboard_config) VALUES (?, ?)`
        ).run('user-mobile', mobileConfig);

        expect(tableExists(db, 'dashboard_backups')).toBe(true);
        db.prepare(
            `INSERT INTO dashboard_backups (id, user_id, widgets, mobile_layout_mode)
             VALUES (?, ?, ?, ?)`
        ).run('backup-1', 'user-good', '[]', 'linked');

        db.transaction(() => {
            migration46.up(db);
            db.pragma('user_version = 46');
        })();

        expect(db.pragma('user_version', { simple: true })).toBe(46);
        expect(tableExists(db, 'dashboards')).toBe(true);
        expect(tableExists(db, 'dashboard_backups')).toBe(false);

        const goodDash = db
            .prepare(
                `SELECT d.name, d.widgets, d.mobile_layout_mode, d.mobile_widgets,
                        p.home_dashboard_id, p.remember_last_dashboard
                 FROM dashboards d
                 JOIN user_preferences p ON p.user_id = d.user_id
                 WHERE d.user_id = ?`
            )
            .get('user-good') as {
            name: string;
            widgets: string;
            mobile_layout_mode: string;
            mobile_widgets: string | null;
            home_dashboard_id: string;
            remember_last_dashboard: number;
        };

        expect(goodDash.name).toBe('Dashboard');
        expect(JSON.parse(goodDash.widgets)).toHaveLength(1);
        expect(goodDash.mobile_layout_mode).toBe('linked');
        expect(goodDash.remember_last_dashboard).toBe(0);
        expect(goodDash.home_dashboard_id).toBeTruthy();

        const badDash = db
            .prepare(`SELECT widgets FROM dashboards WHERE user_id = ?`)
            .get('user-bad-json') as { widgets: string };
        expect(JSON.parse(badDash.widgets)).toEqual([]);

        const mobileDash = db
            .prepare(
                `SELECT mobile_layout_mode, mobile_widgets FROM dashboards WHERE user_id = ?`
            )
            .get('user-mobile') as {
            mobile_layout_mode: string;
            mobile_widgets: string;
        };
        expect(mobileDash.mobile_layout_mode).toBe('independent');
        expect(JSON.parse(mobileDash.mobile_widgets)).toHaveLength(1);

        const dashboardCount = db
            .prepare('SELECT COUNT(*) as c FROM dashboards')
            .get() as { c: number };
        expect(dashboardCount.c).toBe(3);
    });
});
