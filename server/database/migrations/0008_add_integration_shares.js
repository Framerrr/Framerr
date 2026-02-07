/**
 * Migration: Add integration_shares table
 * Purpose: Database-backed integration sharing system
 * Version: 8
 * 
 * This replaces the config-based sharing (systemConfig.integrations[name].sharing)
 * with a proper database table for atomic operations and audit trail.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 8,
    name: 'add_integration_shares',
    up(db) {
        db.exec(`
            -- ============================================================================
            -- TABLE: integration_shares
            -- Database-backed sharing for integrations (replaces config-based sharing)
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS integration_shares (
                id TEXT PRIMARY KEY,
                integration_name TEXT NOT NULL,       -- 'plex', 'sonarr', 'radarr', etc.
                share_type TEXT NOT NULL,             -- 'everyone', 'user', 'group'
                share_target TEXT,                    -- user_id, group_name, or NULL for 'everyone'
                shared_by TEXT NOT NULL,              -- admin user ID who created the share
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL
            );

            -- Index for fast lookup by integration name
            CREATE INDEX IF NOT EXISTS idx_integration_shares_name ON integration_shares(integration_name);
            
            -- Index for checking user/group access
            CREATE INDEX IF NOT EXISTS idx_integration_shares_target ON integration_shares(share_type, share_target);
            
            -- Prevent duplicate shares (same integration + type + target)
            CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_shares_unique 
                ON integration_shares(integration_name, share_type, share_target);

            -- ============================================================================
            -- MIGRATION: Import existing config-based shares
            -- This will be handled in TypeScript after table creation
            -- ============================================================================
        `);

        logger.debug('[Migration 0008] Created integration_shares table');
    }
};
