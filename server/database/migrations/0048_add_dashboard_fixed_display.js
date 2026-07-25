/**
 * Migration 0048: Per-dashboard fixed-display (kiosk) mode
 *
 * Backfills from user preferences.squareCells for cutover from the global experimental toggle.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 48,
    name: 'add_dashboard_fixed_display',

    up(db) {
        db.exec(`ALTER TABLE dashboards ADD COLUMN fixed_display INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`
            UPDATE dashboards SET fixed_display = 1
            WHERE user_id IN (
                SELECT user_id FROM user_preferences
                WHERE preferences IS NOT NULL
                  AND json_valid(preferences)
                  AND json_extract(preferences, '$.squareCells') = 1
            );
        `);
        logger.debug('[Migration 0048] Added fixed_display to dashboards + backfilled from squareCells pref');
    },
};
