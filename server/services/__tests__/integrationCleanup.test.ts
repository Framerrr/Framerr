/**
 * Integration cleanup — dashboards table scrub (post migration 0046)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');

vi.mock('../../database/db', () => ({
    getDb: () => testDb,
}));

vi.mock('../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { scrubIntegrationFromConfigs } from '../integrationCleanup';

const DELETED_ID = 'integration-to-delete';

function createSchema(): void {
    testDb.exec(`
        CREATE TABLE dashboards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            widgets TEXT NOT NULL DEFAULT '[]',
            mobile_layout_mode TEXT NOT NULL DEFAULT 'linked',
            mobile_widgets TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE dashboard_templates (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category_id TEXT,
            widgets TEXT NOT NULL DEFAULT '[]',
            thumbnail TEXT,
            is_draft INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            shared_from_id TEXT,
            user_modified INTEGER DEFAULT 0,
            version INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            mobile_layout_mode TEXT DEFAULT 'linked',
            mobile_widgets TEXT
        );
    `);
}

describe('scrubIntegrationFromConfigs (dashboards table)', () => {
    beforeEach(() => {
        testDb.exec('DROP TABLE IF EXISTS dashboards');
        testDb.exec('DROP TABLE IF EXISTS dashboard_templates');
        createSchema();
    });

    it('scrubs integration ids from dashboards and templates', () => {
        const desktopWidgets = [
            { id: 'w1', type: 'stats', config: { integrationId: DELETED_ID } },
            {
                id: 'w2',
                type: 'multi',
                config: { fooIntegrationIds: [DELETED_ID, 'keep-me'] },
            },
            {
                id: 'w3',
                type: 'legacy',
                config: { fooIntegrationId: DELETED_ID },
            },
        ];
        const mobileWidgets = [
            { id: 'm1', type: 'clock', config: { integrationId: DELETED_ID } },
        ];

        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, mobile_widgets, position)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
                'dash-1',
                'user-1',
                'Dashboard',
                JSON.stringify(desktopWidgets),
                'independent',
                JSON.stringify(mobileWidgets),
                0
            );

        testDb
            .prepare(
                `INSERT INTO dashboard_templates (id, owner_id, name, widgets, mobile_widgets)
                 VALUES (?, ?, ?, ?, ?)`
            )
            .run(
                'tpl-1',
                'user-1',
                'Template',
                JSON.stringify([
                    { id: 't1', type: 'stats', config: { integrationId: DELETED_ID } },
                ]),
                null
            );

        scrubIntegrationFromConfigs(DELETED_ID);

        const dashRow = testDb
            .prepare('SELECT widgets, mobile_widgets FROM dashboards WHERE id = ?')
            .get('dash-1') as { widgets: string; mobile_widgets: string };

        const parsedDesktop = JSON.parse(dashRow.widgets) as Array<{
            config: Record<string, unknown>;
        }>;
        expect(parsedDesktop[0].config.integrationId).toBeUndefined();
        expect(parsedDesktop[1].config.fooIntegrationIds).toEqual(['keep-me']);
        expect(parsedDesktop[2].config.fooIntegrationId).toBeUndefined();

        const parsedMobile = JSON.parse(dashRow.mobile_widgets) as Array<{
            config: Record<string, unknown>;
        }>;
        expect(parsedMobile[0].config.integrationId).toBeUndefined();

        const tplRow = testDb
            .prepare('SELECT widgets FROM dashboard_templates WHERE id = ?')
            .get('tpl-1') as { widgets: string };
        const tplWidgets = JSON.parse(tplRow.widgets) as Array<{
            config: Record<string, unknown>;
        }>;
        expect(tplWidgets[0].config.integrationId).toBeUndefined();
    });

    it('skips malformed dashboard JSON without aborting other rows', () => {
        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, position)
                 VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run('dash-bad', 'user-1', 'Bad', '{broken', 'linked', 0);

        testDb
            .prepare(
                `INSERT INTO dashboards (id, user_id, name, widgets, mobile_layout_mode, position)
                 VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
                'dash-good',
                'user-1',
                'Good',
                JSON.stringify([
                    { id: 'w1', type: 'stats', config: { integrationId: DELETED_ID } },
                ]),
                'linked',
                1
            );

        expect(() => scrubIntegrationFromConfigs(DELETED_ID)).not.toThrow();

        const goodRow = testDb
            .prepare('SELECT widgets FROM dashboards WHERE id = ?')
            .get('dash-good') as { widgets: string };
        const widgets = JSON.parse(goodRow.widgets) as Array<{
            config: Record<string, unknown>;
        }>;
        expect(widgets[0].config.integrationId).toBeUndefined();

        const badRow = testDb
            .prepare('SELECT widgets FROM dashboards WHERE id = ?')
            .get('dash-bad') as { widgets: string };
        expect(badRow.widgets).toBe('{broken');
    });
});
