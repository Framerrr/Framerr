/**
 * Migration: Add widget_shares table
 * Purpose: Widget-based sharing (replaces integration-based sharing)
 * Version: 19
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 19,
    name: 'add_widget_shares',
    up(db) {
        // Create widget_shares table for widget-based permission model
        // Users with widget share can access ALL compatible integrations
        db.exec(`
            CREATE TABLE IF NOT EXISTS widget_shares (
                id TEXT PRIMARY KEY,
                widget_type TEXT NOT NULL,
                share_type TEXT NOT NULL,
                share_target TEXT,
                shared_by TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(widget_type, share_type, share_target)
            );
        `);

        // Index for looking up shares by widget type
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_widget_shares_type 
            ON widget_shares(widget_type);
        `);

        // Index for looking up shares by target (user or group)
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_widget_shares_target 
            ON widget_shares(share_target);
        `);

        // Index for looking up shares by share_type
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_widget_shares_share_type 
            ON widget_shares(share_type);
        `);

        logger.debug('[Migration 0019] Created widget_shares table');
    }
};
