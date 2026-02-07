/**
 * Migration 0032: Fix media search history table
 * 
 * Recreates the media_search_history table without the foreign key constraint.
 * The widgetId is a layout widget ID (stored in user_preferences JSON), 
 * not a database table reference.
 */

const version = 32;
const name = 'fix_media_search_history_fk';

function up(db) {
    // Drop and recreate without FK
    db.exec(`
        DROP TABLE IF EXISTS media_search_history;
        
        CREATE TABLE media_search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            widgetId TEXT NOT NULL,
            query TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_media_search_history_widget 
        ON media_search_history(widgetId, timestamp DESC);
    `);
}

module.exports = { version, name, up };
