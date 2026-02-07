/**
 * Migration: Add integration_instance_id to service_monitors
 * Purpose: Link service monitors to specific framerr-monitoring integration instances
 * Version: 22
 * 
 * This enables multi-instance framerr-monitoring where each instance has its own set of monitors.
 * Widgets bind to a specific integration instance and only see monitors for that instance.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 22,
    name: 'add_integration_instance_id_to_service_monitors',
    up(db) {
        // Add the integration_instance_id column (nullable initially for migration)
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN integration_instance_id TEXT;
        `);

        // Add index for efficient lookups by integration instance
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_service_monitors_integration 
            ON service_monitors(integration_instance_id);
        `);

        logger.debug('[Migration 0022] Added integration_instance_id column to service_monitors');
    }
};
