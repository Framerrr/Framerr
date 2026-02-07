/**
 * Media Search History Database Functions
 * 
 * Manages per-widget search history for the Media Search widget.
 * Stores recent searches in SQLite with configurable limit.
 */

import { getDb } from '../database/db';

const MAX_HISTORY_PER_WIDGET = 7;

// ============================================================================
// TYPES
// ============================================================================

export interface SearchHistoryEntry {
    id: number;
    widgetId: string;
    query: string;
    timestamp: number;
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get recent search history for a widget
 */
export function getSearchHistory(widgetId: string): SearchHistoryEntry[] {
    const db = getDb();
    const stmt = db.prepare(`
        SELECT id, widgetId, query, timestamp
        FROM media_search_history
        WHERE widgetId = ?
        ORDER BY timestamp DESC
        LIMIT ?
    `);
    return stmt.all(widgetId, MAX_HISTORY_PER_WIDGET) as SearchHistoryEntry[];
}

/**
 * Add a search query to widget history
 * Deduplicates (case-insensitive) and limits to MAX_HISTORY_PER_WIDGET
 */
export function addSearchHistory(widgetId: string, query: string): SearchHistoryEntry {
    const db = getDb();
    const trimmedQuery = query.trim();

    // Delete any existing entry with the same query (case-insensitive)
    const deleteStmt = db.prepare(`
        DELETE FROM media_search_history
        WHERE widgetId = ? AND LOWER(query) = LOWER(?)
    `);
    deleteStmt.run(widgetId, trimmedQuery);

    // Insert new entry
    const insertStmt = db.prepare(`
        INSERT INTO media_search_history (widgetId, query, timestamp)
        VALUES (?, ?, ?)
    `);
    const timestamp = Date.now();
    const result = insertStmt.run(widgetId, trimmedQuery, timestamp);

    // Cleanup old entries beyond limit
    const cleanupStmt = db.prepare(`
        DELETE FROM media_search_history
        WHERE widgetId = ? AND id NOT IN (
            SELECT id FROM media_search_history
            WHERE widgetId = ?
            ORDER BY timestamp DESC
            LIMIT ?
        )
    `);
    cleanupStmt.run(widgetId, widgetId, MAX_HISTORY_PER_WIDGET);

    return {
        id: result.lastInsertRowid as number,
        widgetId,
        query: trimmedQuery,
        timestamp
    };
}

/**
 * Clear all search history for a widget
 */
export function clearSearchHistory(widgetId: string): void {
    const db = getDb();
    const stmt = db.prepare(`
        DELETE FROM media_search_history
        WHERE widgetId = ?
    `);
    stmt.run(widgetId);
}

/**
 * Clear all search history across all widgets (used from Jobs & Cache settings)
 */
export function clearAllSearchHistory(): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM media_search_history').run();
    return result.changes;
}

/**
 * Get total search history count across all widgets
 */
export function getSearchHistoryCount(): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM media_search_history').get() as { count: number };
    return row.count;
}
