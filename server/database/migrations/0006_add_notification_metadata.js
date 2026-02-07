/**
 * Migration: Add metadata column to notifications table
 * 
 * Allows notifications to store JSON metadata such as:
 * - requestId (for Overseerr actionable notifications)
 * - service (which integration created the notification)
 * - actionable (boolean flag for approve/decline capabilities)
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 6,
    name: 'add_notification_metadata',

    up: async (db) => {
        // Check if column already exists
        const tableInfo = db.pragma('table_info(notifications)');
        const hasMetadata = tableInfo.some(col => col.name === 'metadata');

        if (!hasMetadata) {
            db.exec(`
                ALTER TABLE notifications 
                ADD COLUMN metadata TEXT DEFAULT NULL
            `);
            logger.debug('[Migration 0006] Added metadata column to notifications');
        }
    }
};
