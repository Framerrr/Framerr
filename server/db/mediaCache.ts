/**
 * Media Cache Database Layer
 * 
 * CRUD operations for cached TMDB metadata.
 */

import { getDb } from '../database/db';
import logger from '../utils/logger';

/** Media cache entry type */
export interface MediaCacheEntry {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    originalTitle?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    overview?: string | null;
    releaseDate?: string | null;
    voteAverage?: number | null;
    voteCount?: number | null;
    genres?: string[] | null;
    runtime?: number | null;
    numberOfSeasons?: number | null;
    tagline?: string | null;
    status?: string | null;
    lastAccessedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

/** Row shape from database */
interface MediaCacheRow {
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    original_title: string | null;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string | null;
    release_date: string | null;
    vote_average: number | null;
    vote_count: number | null;
    genres: string | null;
    runtime: number | null;
    number_of_seasons: number | null;
    tagline: string | null;
    status: string | null;
    last_accessed_at: string;
    created_at: string;
    updated_at: string;
}

/** Convert DB row to entry */
function rowToEntry(row: MediaCacheRow): MediaCacheEntry {
    return {
        tmdbId: row.tmdb_id,
        mediaType: row.media_type,
        title: row.title,
        originalTitle: row.original_title,
        posterPath: row.poster_path,
        backdropPath: row.backdrop_path,
        overview: row.overview,
        releaseDate: row.release_date,
        voteAverage: row.vote_average,
        voteCount: row.vote_count,
        genres: row.genres ? JSON.parse(row.genres) : null,
        runtime: row.runtime,
        numberOfSeasons: row.number_of_seasons,
        tagline: row.tagline,
        status: row.status,
        lastAccessedAt: row.last_accessed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Get cached media entry by TMDB ID and type
 */
export function getCachedMedia(tmdbId: number, mediaType: 'movie' | 'tv'): MediaCacheEntry | null {
    try {
        const db = getDb();

        // Update last accessed timestamp
        db.prepare(`
            UPDATE media_cache 
            SET last_accessed_at = CURRENT_TIMESTAMP 
            WHERE tmdb_id = ? AND media_type = ?
        `).run(tmdbId, mediaType);

        const row = db.prepare(`
            SELECT * FROM media_cache WHERE tmdb_id = ? AND media_type = ?
        `).get(tmdbId, mediaType) as MediaCacheRow | undefined;

        return row ? rowToEntry(row) : null;
    } catch (error) {
        logger.error(`[MediaCache] Failed to get: tmdbId=${tmdbId} type=${mediaType} error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Bulk get cached media entries
 */
export function bulkGetCachedMedia(
    tmdbIds: number[],
    mediaType: 'movie' | 'tv'
): Map<number, MediaCacheEntry> {
    const result = new Map<number, MediaCacheEntry>();

    if (tmdbIds.length === 0) return result;

    try {
        const db = getDb();
        const placeholders = tmdbIds.map(() => '?').join(',');

        // Update last accessed for all
        db.prepare(`
            UPDATE media_cache 
            SET last_accessed_at = CURRENT_TIMESTAMP 
            WHERE tmdb_id IN (${placeholders}) AND media_type = ?
        `).run(...tmdbIds, mediaType);

        const rows = db.prepare(`
            SELECT * FROM media_cache 
            WHERE tmdb_id IN (${placeholders}) AND media_type = ?
        `).all(...tmdbIds, mediaType) as MediaCacheRow[];

        for (const row of rows) {
            result.set(row.tmdb_id, rowToEntry(row));
        }
    } catch (error) {
        logger.error(`[MediaCache] Failed to bulk get: count=${tmdbIds.length} error="${(error as Error).message}"`);
    }

    return result;
}

/**
 * Save or update cached media entry
 */
export function setCachedMedia(entry: MediaCacheEntry): boolean {
    try {
        const db = getDb();

        db.prepare(`
            INSERT INTO media_cache (
                tmdb_id, media_type, title, original_title, poster_path, backdrop_path,
                overview, release_date, vote_average, vote_count, genres, runtime,
                number_of_seasons, tagline, status, last_accessed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(tmdb_id, media_type) DO UPDATE SET
                title = excluded.title,
                original_title = excluded.original_title,
                poster_path = excluded.poster_path,
                backdrop_path = excluded.backdrop_path,
                overview = excluded.overview,
                release_date = excluded.release_date,
                vote_average = excluded.vote_average,
                vote_count = excluded.vote_count,
                genres = excluded.genres,
                runtime = excluded.runtime,
                number_of_seasons = excluded.number_of_seasons,
                tagline = excluded.tagline,
                status = excluded.status,
                last_accessed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            entry.tmdbId,
            entry.mediaType,
            entry.title,
            entry.originalTitle ?? null,
            entry.posterPath ?? null,
            entry.backdropPath ?? null,
            entry.overview ?? null,
            entry.releaseDate ?? null,
            entry.voteAverage ?? null,
            entry.voteCount ?? null,
            entry.genres ? JSON.stringify(entry.genres) : null,
            entry.runtime ?? null,
            entry.numberOfSeasons ?? null,
            entry.tagline ?? null,
            entry.status ?? null
        );

        return true;
    } catch (error) {
        logger.error(`[MediaCache] Failed to set: tmdbId=${entry.tmdbId} error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Get stale entries not accessed in the given number of days
 */
export function getStaleEntries(maxAgeDays: number = 30): MediaCacheEntry[] {
    try {
        const db = getDb();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

        const rows = db.prepare(`
            SELECT * FROM media_cache 
            WHERE last_accessed_at < ?
            ORDER BY last_accessed_at ASC
        `).all(cutoffDate.toISOString()) as MediaCacheRow[];

        return rows.map(rowToEntry);
    } catch (error) {
        logger.error(`[MediaCache] Failed to get stale entries: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Remove cached media entry
 */
export function removeCachedMedia(tmdbId: number, mediaType: 'movie' | 'tv'): boolean {
    try {
        const db = getDb();
        const result = db.prepare(`
            DELETE FROM media_cache WHERE tmdb_id = ? AND media_type = ?
        `).run(tmdbId, mediaType);

        return result.changes > 0;
    } catch (error) {
        logger.error(`[MediaCache] Failed to remove: tmdbId=${tmdbId} error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Cleanup stale entries from database
 */
export function cleanupStaleEntries(maxAgeDays: number = 30): number {
    try {
        const db = getDb();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

        const result = db.prepare(`
            DELETE FROM media_cache WHERE last_accessed_at < ?
        `).run(cutoffDate.toISOString());

        if (result.changes > 0) {
            logger.info(`[MediaCache] Cleaned up stale: deleted=${result.changes}`);
        }

        return result.changes;
    } catch (error) {
        logger.error(`[MediaCache] Failed to cleanup: error="${(error as Error).message}"`);
        return 0;
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; movieCount: number; tvCount: number } {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM media_cache').get() as { count: number };
        const movies = db.prepare("SELECT COUNT(*) as count FROM media_cache WHERE media_type = 'movie'").get() as { count: number };
        const tv = db.prepare("SELECT COUNT(*) as count FROM media_cache WHERE media_type = 'tv'").get() as { count: number };

        return {
            count: total.count,
            movieCount: movies.count,
            tvCount: tv.count
        };
    } catch {
        return { count: 0, movieCount: 0, tvCount: 0 };
    }
}

/**
 * Flush all cache entries (used from Jobs & Cache settings)
 */
export function flushAllCache(): number {
    try {
        const db = getDb();
        const result = db.prepare('DELETE FROM media_cache').run();
        logger.info(`[MediaCache] Flushed all entries: deleted=${result.changes}`);
        return result.changes;
    } catch (error) {
        logger.error(`[MediaCache] Flush failed: error="${(error as Error).message}"`);
        return 0;
    }
}

