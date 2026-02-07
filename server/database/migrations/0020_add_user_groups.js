/**
 * Migration: Add user_groups tables
 * Purpose: Custom user groups for sharing (Family, Friends, Power Users, etc.)
 * Version: 20
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 20,
    name: 'add_user_groups',
    up(db) {
        // Create user_groups table for custom groupings
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_groups (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // Create user_group_members junction table
        // A user can be in multiple groups
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_group_members (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, group_id)
            );
        `);

        // Index for looking up groups by user
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_group_members_user 
            ON user_group_members(user_id);
        `);

        // Index for looking up users by group
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_group_members_group 
            ON user_group_members(group_id);
        `);

        logger.debug('[Migration 0020] Created user_groups and user_group_members tables');
    }
};
