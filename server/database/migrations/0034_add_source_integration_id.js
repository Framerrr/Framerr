/**
 * Migration: Add source_integration_id to service_monitors
 * 
 * Tracks which integration instance a monitor was imported from (e.g., Plex, Sonarr).
 * This is separate from integration_instance_id which links to the parent Service Monitoring instance.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 34,
    name: 'add_source_integration_id_to_service_monitors',
    up(db) {
        db.exec(`
            ALTER TABLE service_monitors ADD COLUMN source_integration_id TEXT;
        `);

        logger.debug('[Migration 0034] Added source_integration_id column to service_monitors');
    }
};
