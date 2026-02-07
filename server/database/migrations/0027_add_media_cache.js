/**
 * Migration: Add media_cache table
 * 
 * Stores cached TMDB metadata (titles, posters, overviews, etc.)
 * to avoid repeated API calls to Overseerr/TMDB.
 */

module.exports = {
    version: 27,
    name: 'add_media_cache',
    up: (db) => {
        // Create media_cache table
        db.exec(`
            CREATE TABLE IF NOT EXISTS media_cache (
                tmdb_id INTEGER NOT NULL,
                media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
                title TEXT NOT NULL,
                original_title TEXT,
                poster_path TEXT,
                backdrop_path TEXT,
                overview TEXT,
                release_date TEXT,
                vote_average REAL,
                vote_count INTEGER,
                genres TEXT,
                runtime INTEGER,
                number_of_seasons INTEGER,
                tagline TEXT,
                status TEXT,
                last_accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (tmdb_id, media_type)
            );

            CREATE INDEX IF NOT EXISTS idx_media_cache_last_accessed 
            ON media_cache(last_accessed_at);
        `);
    },

    down: (db) => {
        db.exec(`
            DROP TABLE IF EXISTS media_cache;
        `);
    }
};
