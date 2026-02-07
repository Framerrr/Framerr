/**
 * Migration: Add media_library tables for local media indexing
 * 
 * Creates tables for indexing media from Plex, Jellyfin, and Emby
 * with FTS5 full-text search support.
 * 
 * Version: 30
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 30,
    name: 'add_media_library',
    up(db) {
        logger.info('[Migration 0030] Creating media_library tables...');

        // Main media library table - stores indexed media items
        db.exec(`
            CREATE TABLE IF NOT EXISTS media_library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                integration_instance_id TEXT NOT NULL,
                media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'show', 'season', 'episode', 'music', 'photo')),
                library_key TEXT,
                item_key TEXT NOT NULL,
                title TEXT NOT NULL,
                original_title TEXT,
                sort_title TEXT,
                year INTEGER,
                thumb TEXT,
                art TEXT,
                summary TEXT,
                genres TEXT,
                studio TEXT,
                director TEXT,
                actors TEXT,
                rating REAL,
                content_rating TEXT,
                duration INTEGER,
                added_at INTEGER,
                updated_at INTEGER,
                tmdb_id INTEGER,
                imdb_id TEXT,
                indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(integration_instance_id, item_key)
            );

            CREATE INDEX IF NOT EXISTS idx_media_library_integration
            ON media_library(integration_instance_id);

            CREATE INDEX IF NOT EXISTS idx_media_library_type
            ON media_library(media_type);

            CREATE INDEX IF NOT EXISTS idx_media_library_title
            ON media_library(title);

            CREATE INDEX IF NOT EXISTS idx_media_library_year
            ON media_library(year);

            CREATE INDEX IF NOT EXISTS idx_media_library_tmdb
            ON media_library(tmdb_id);
        `);

        logger.info('[Migration 0030] Created media_library table');

        // Library sync status table - tracks sync progress per integration
        db.exec(`
            CREATE TABLE IF NOT EXISTS library_sync_status (
                integration_instance_id TEXT PRIMARY KEY,
                total_items INTEGER DEFAULT 0,
                indexed_items INTEGER DEFAULT 0,
                last_sync_started TEXT,
                last_sync_completed TEXT,
                sync_status TEXT DEFAULT 'idle' CHECK(sync_status IN ('idle', 'syncing', 'error', 'completed')),
                error_message TEXT
            );
        `);

        logger.info('[Migration 0030] Created library_sync_status table');

        // FTS5 virtual table for full-text search
        db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS media_library_fts USING fts5(
                title,
                original_title,
                summary,
                actors,
                director,
                content=media_library,
                content_rowid=id
            );
        `);

        logger.info('[Migration 0030] Created FTS5 virtual table');

        // Triggers to keep FTS in sync with main table
        db.exec(`
            -- Insert trigger
            CREATE TRIGGER IF NOT EXISTS media_library_ai AFTER INSERT ON media_library BEGIN
                INSERT INTO media_library_fts(rowid, title, original_title, summary, actors, director)
                VALUES (NEW.id, NEW.title, NEW.original_title, NEW.summary, NEW.actors, NEW.director);
            END;

            -- Delete trigger
            CREATE TRIGGER IF NOT EXISTS media_library_ad AFTER DELETE ON media_library BEGIN
                INSERT INTO media_library_fts(media_library_fts, rowid, title, original_title, summary, actors, director)
                VALUES ('delete', OLD.id, OLD.title, OLD.original_title, OLD.summary, OLD.actors, OLD.director);
            END;

            -- Update trigger
            CREATE TRIGGER IF NOT EXISTS media_library_au AFTER UPDATE ON media_library BEGIN
                INSERT INTO media_library_fts(media_library_fts, rowid, title, original_title, summary, actors, director)
                VALUES ('delete', OLD.id, OLD.title, OLD.original_title, OLD.summary, OLD.actors, OLD.director);
                INSERT INTO media_library_fts(rowid, title, original_title, summary, actors, director)
                VALUES (NEW.id, NEW.title, NEW.original_title, NEW.summary, NEW.actors, NEW.director);
            END;
        `);

        logger.info('[Migration 0030] Created FTS sync triggers');
        logger.info('[Migration 0030] Complete: media_library, library_sync_status, and FTS5 tables ready');
    }
};
