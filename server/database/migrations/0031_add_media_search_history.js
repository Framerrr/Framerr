/**
 * Migration 0031: Add media search history table
 * 
 * Creates a per-widget search history table for the Media Search widget.
 * Stores recent searches with timestamps.
 * Note: widgetId references a widget in the user's layout JSON, not a database table.
 */

const version = 31;
const name = 'add_media_search_history';

function up(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS media_search_history (
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

