/**
 * Migration: Add icon_ids column for batched notifications
 * 
 * Allows storing multiple icon IDs as JSON array for service status
 * notifications that batch multiple services together.
 * Version: 14
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 14,
    name: 'notification_icon_ids',

    up(db) {
        // Add icon_ids column for batched notifications (JSON array of icon IDs)
        db.exec(`
            ALTER TABLE notifications ADD COLUMN icon_ids TEXT DEFAULT NULL;
        `);
        logger.debug('[Migration 0014] Added icon_ids column to notifications table');
    },

    down: (db) => {
        // SQLite doesn't support DROP COLUMN in older versions
        // For rollback, we'd need to recreate the table
        logger.debug('[Migration 0014] Rollback: icon_ids column removal requires table recreation');
    }
};
