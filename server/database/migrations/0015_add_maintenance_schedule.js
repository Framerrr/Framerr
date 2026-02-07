/**
 * Migration: Add maintenance_schedule column
 * Purpose: Store scheduled maintenance windows per monitor (JSON)
 * Version: 15
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 15,
    name: 'add_maintenance_schedule',
    up(db) {
        // Add maintenance_schedule column for automated maintenance windows
        // JSON format: { enabled, frequency, startTime, endTime, weeklyDays?, monthlyDay? }
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN maintenance_schedule TEXT;
        `);

        logger.debug('[Migration 0015] Added maintenance_schedule column to service_monitors');
    }
};
