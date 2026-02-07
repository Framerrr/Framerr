/**
 * Migration: Add icon_name column to service_monitors
 * Purpose: Store Lucide icon names as strings (e.g., 'Globe', 'Server')
 * Version: 12
 * 
 * The existing icon_id column references custom_icons table (for uploaded icons).
 * This new icon_name column stores Lucide icon names as strings.
 * icon_name takes precedence over icon_id for display.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 12,
    name: 'add_icon_name_column',
    up(db) {
        // Add icon_name column for Lucide icon names
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN icon_name TEXT;
        `);

        logger.debug('[Migration 0012] Added icon_name column to service_monitors');
    }
};
