/**
 * Migration: Account linking improvements
 * Purpose: Add Plex setup tokens table and has_local_password flag
 * Version: 17
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 17,
    name: 'account_linking',
    up(db) {
        // Add has_local_password column to users table
        // Default to 1 (true) since existing users either:
        // - Created with password (local)
        // - Created via old Plex SSO (need migration check separately)
        db.exec(`
            ALTER TABLE users 
            ADD COLUMN has_local_password INTEGER DEFAULT 1;
        `);

        // Create plex_setup_tokens table for secure handoff during Plex setup flow
        db.exec(`
            CREATE TABLE IF NOT EXISTS plex_setup_tokens (
                token TEXT PRIMARY KEY,
                plex_id TEXT NOT NULL,
                plex_username TEXT NOT NULL,
                plex_email TEXT,
                plex_thumb TEXT,
                expires_at INTEGER NOT NULL,
                used INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );
        `);

        // Create index for cleanup of expired tokens
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_plex_setup_tokens_expires 
            ON plex_setup_tokens(expires_at);
        `);

        logger.debug('[Migration 0017] Added has_local_password column and plex_setup_tokens table');
    }
};
