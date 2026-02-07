/**
 * Migration: Add maintenance tracking to aggregates
 * Purpose: Track when hours had maintenance mode active for grey tick bar display
 * Version: 16
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 16,
    name: 'add_maintenance_to_aggregates',
    up(db) {
        // Add checks_maintenance column to track maintenance periods
        db.exec(`
            ALTER TABLE service_monitor_aggregates 
            ADD COLUMN checks_maintenance INTEGER DEFAULT 0;
        `);

        logger.debug('[Migration 0016] Added checks_maintenance column to service_monitor_aggregates');
    }
};
