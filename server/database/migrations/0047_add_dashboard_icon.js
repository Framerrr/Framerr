/**
 * Migration 0047: Per-dashboard icon
 *
 * Stores an IconPicker identifier on each dashboard (null = LayoutDashboard default).
 * Used by desktop sidebar, mobile tab bar, and dashboard pickers.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 47,
    name: 'add_dashboard_icon',

    up(db) {
        db.exec(`
            ALTER TABLE dashboards ADD COLUMN icon TEXT;
        `);
        logger.debug('[Migration 0047] Added icon column to dashboards');
    },
};
