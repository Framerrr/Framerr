/**
 * Migration: Add Uptime Kuma integration columns
 * Purpose: Store UK source URL and readonly flag for imported monitors
 * Version: 11
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 11,
    name: 'add_uptime_kuma_columns',
    up(db) {
        // Add uptime_kuma_url column to track source UK instance
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN uptime_kuma_url TEXT;
        `);

        // Add is_readonly column to mark UK-imported monitors as non-editable
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN is_readonly INTEGER DEFAULT 0;
        `);

        logger.debug('[Migration 0011] Added uptime_kuma_url and is_readonly columns to service_monitors');
    }
};
