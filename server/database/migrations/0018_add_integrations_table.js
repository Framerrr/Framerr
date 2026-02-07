/**
 * Migration: Add integration_instances table
 * Purpose: Multi-instance integration storage with encrypted config
 * Version: 18
 * 
 * NOTE: Named 'integration_instances' to avoid conflict with legacy 'integrations' table
 * which uses a different schema (service_name-based). The legacy table will be
 * migrated/dropped in a later phase.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 18,
    name: 'add_integration_instances_table',
    up(db) {
        // Create integration_instances table for multi-instance integration support
        // This is the new model - each row is one integration instance (e.g., "Radarr - 4K Movies")
        db.exec(`
            CREATE TABLE IF NOT EXISTS integration_instances (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                display_name TEXT NOT NULL,
                config_encrypted TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER
            );
        `);

        // Index for filtering by integration type
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_integration_instances_type 
            ON integration_instances(type);
        `);

        // Index for enabled integrations (common query filter)
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_integration_instances_enabled 
            ON integration_instances(enabled);
        `);

        logger.debug('[Migration 0018] Created integration_instances table');
    }
};
