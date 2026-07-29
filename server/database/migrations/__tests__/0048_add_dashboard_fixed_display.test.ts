/**
 * Migration 0048 — fixed_display column + squareCells backfill characterization tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import path from 'node:path';
import { register } from 'ts-node';

register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const migrationFile = path.join(__dirname, '..', '0048_add_dashboard_fixed_display.js');
const migrationRequire = createRequire(migrationFile);

const migration48 = migrationRequire('./0048_add_dashboard_fixed_display.js') as {
    version: number;
    up: (db: Database.Database) => void;
};

function createV47Schema(db: Database.Database): void {
    db.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            group_id TEXT NOT NULL DEFAULT 'user'
        );

        CREATE TABLE user_preferences (
            user_id TEXT PRIMARY KEY,
            preferences TEXT DEFAULT '{}'
        );

        CREATE TABLE dashboards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            icon TEXT,
            widgets TEXT NOT NULL DEFAULT '[]',
            mobile_layout_mode TEXT NOT NULL DEFAULT 'linked',
            mobile_widgets TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
    `);
    db.pragma('user_version = 47');
}

function insertUserWithDashboards(
    db: Database.Database,
    userId: string,
    prefs: string | null,
    dashboardCount: number,
): string[] {
    db.prepare(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`).run(
        userId,
        userId,
        'hash'
    );
    if (prefs !== null) {
        db.prepare(`INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?)`).run(
            userId,
            prefs
        );
    }
    const ids: string[] = [];
    for (let i = 0; i < dashboardCount; i++) {
        const id = `${userId}-dash-${i}`;
        ids.push(id);
        db.prepare(
            `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, icon, position)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, userId, `Dash ${i}`, '[]', 'linked', 'layout-dashboard', i);
    }
    return ids;
}

describe('Migration 0048: add_dashboard_fixed_display', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        createV47Schema(db);
    });

    it('backfills fixed_display from squareCells pref cases', () => {
        insertUserWithDashboards(db, 'user-true', '{"squareCells":true}', 2);
        insertUserWithDashboards(db, 'user-false', '{"squareCells":false}', 1);
        insertUserWithDashboards(db, 'user-absent', '{}', 1);
        insertUserWithDashboards(db, 'user-bad', '{not valid json', 1);
        insertUserWithDashboards(db, 'user-noprefs', null, 1);

        db.transaction(() => {
            migration48.up(db);
            db.pragma('user_version = 48');
        })();

        const trueRows = db
            .prepare(`SELECT fixed_display FROM dashboards WHERE user_id = ?`)
            .all('user-true') as { fixed_display: number }[];
        expect(trueRows).toHaveLength(2);
        expect(trueRows.every(r => r.fixed_display === 1)).toBe(true);

        expect(
            (db.prepare(`SELECT fixed_display FROM dashboards WHERE user_id = ?`).get('user-false') as { fixed_display: number }).fixed_display
        ).toBe(0);
        expect(
            (db.prepare(`SELECT fixed_display FROM dashboards WHERE user_id = ?`).get('user-absent') as { fixed_display: number }).fixed_display
        ).toBe(0);
        expect(
            (db.prepare(`SELECT fixed_display FROM dashboards WHERE user_id = ?`).get('user-bad') as { fixed_display: number }).fixed_display
        ).toBe(0);
        expect(
            (db.prepare(`SELECT fixed_display FROM dashboards WHERE user_id = ?`).get('user-noprefs') as { fixed_display: number }).fixed_display
        ).toBe(0);
    });

    it('defaults fixed_display to 0 on new rows and preserves other columns', () => {
        insertUserWithDashboards(db, 'user-preserve', '{}', 1);
        const dashId = 'user-preserve-dash-0';
        db.prepare(`UPDATE dashboards SET mobile_layout_mode = ?, icon = ? WHERE id = ?`).run(
            'independent',
            'star',
            dashId
        );

        db.transaction(() => migration48.up(db))();

        const row = db
            .prepare(
                `SELECT fixed_display, mobile_layout_mode, icon, widgets FROM dashboards WHERE id = ?`
            )
            .get(dashId) as {
            fixed_display: number;
            mobile_layout_mode: string;
            icon: string;
            widgets: string;
        };
        expect(row.fixed_display).toBe(0);
        expect(row.mobile_layout_mode).toBe('independent');
        expect(row.icon).toBe('star');
        expect(JSON.parse(row.widgets)).toEqual([]);

        const newId = 'new-after-migration';
        db.prepare(
            `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, position)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(newId, 'user-preserve', 'New', '[]', 'linked', 1);

        const inserted = db
            .prepare(`SELECT fixed_display FROM dashboards WHERE id = ?`)
            .get(newId) as { fixed_display: number };
        expect(inserted.fixed_display).toBe(0);
    });
});
