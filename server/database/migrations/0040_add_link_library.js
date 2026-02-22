/**
 * Migration 0040: Add link_library table
 * 
 * Creates a per-user link library for storing reusable link templates.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 40,
    name: 'add_link_library',

    up(db) {
        db.exec(`
            CREATE TABLE link_library (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                icon TEXT NOT NULL DEFAULT 'Link',
                size TEXT NOT NULL DEFAULT 'circle',
                type TEXT NOT NULL DEFAULT 'link',
                url TEXT DEFAULT '',
                style TEXT DEFAULT '{}',
                action TEXT DEFAULT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_link_library_user ON link_library(user_id);
        `);

        logger.debug('[Migration 0040] Created link_library table');
    }
};

