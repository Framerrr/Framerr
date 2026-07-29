/**
 * Migration 0046: Multi-dashboard storage
 *
 * - Creates dashboards table (one row per user dashboard)
 * - Adds home_dashboard_id and remember_last_dashboard to user_preferences
 * - Seeds Home dashboard from legacy dashboard_config per user
 * - Drops dashboard_backups (template revert removed)
 */
const crypto = require('crypto');
const logger = require('../../utils/logger').default;

module.exports = {
    version: 46,
    name: 'multi_dashboard',

    up(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS dashboards (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                widgets TEXT NOT NULL DEFAULT '[]',
                mobile_layout_mode TEXT NOT NULL DEFAULT 'linked',
                mobile_widgets TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);
        `);

        logger.debug('[Migration 0046] Created dashboards table');

        db.exec(`
            ALTER TABLE user_preferences ADD COLUMN home_dashboard_id TEXT;
        `);
        db.exec(`
            ALTER TABLE user_preferences ADD COLUMN remember_last_dashboard INTEGER NOT NULL DEFAULT 0;
        `);

        logger.debug('[Migration 0046] Added home_dashboard_id and remember_last_dashboard columns');

        const insertDashboard = db.prepare(`
            INSERT INTO dashboards (
                id, user_id, name, widgets, mobile_layout_mode, mobile_widgets, position
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const setHome = db.prepare(`
            UPDATE user_preferences SET home_dashboard_id = ? WHERE user_id = ?
        `);

        const prefRows = db.prepare(
            'SELECT user_id, dashboard_config FROM user_preferences'
        ).all();

        for (const row of prefRows) {
            let config = { widgets: [] };
            if (row.dashboard_config) {
                try {
                    config = JSON.parse(row.dashboard_config);
                } catch {
                    logger.debug(
                        `[Migration 0046] Malformed dashboard_config for user=${row.user_id}, using empty widgets`
                    );
                }
            }

            const dashboardId = crypto.randomUUID();
            const widgetsJson = JSON.stringify(
                Array.isArray(config.widgets) ? config.widgets : []
            );
            const mobileLayoutMode =
                config.mobileLayoutMode === 'independent' ? 'independent' : 'linked';
            const mobileWidgetsJson =
                config.mobileWidgets != null
                    ? JSON.stringify(config.mobileWidgets)
                    : null;

            insertDashboard.run(
                dashboardId,
                row.user_id,
                'Dashboard',
                widgetsJson,
                mobileLayoutMode,
                mobileWidgetsJson,
                0
            );

            setHome.run(dashboardId, row.user_id);
        }

        logger.debug(`[Migration 0046] Seeded ${prefRows.length} Home dashboard row(s)`);

        db.exec('DROP TABLE IF EXISTS dashboard_backups;');
        logger.debug('[Migration 0046] Dropped dashboard_backups table');
    },
};
