/**
 * SQLite Database Connection Module
 * 
 * Provides a singleton connection to the SQLite database for Framerr.
 * Uses better-sqlite3 for synchronous, fast SQLite operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Determine database location
// FRAMERR_DB_PATH: Direct path to database file (for local dev outside repo)
// DATA_DIR: Directory containing framerr.db (default behavior)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.FRAMERR_DB_PATH || path.join(DATA_DIR, 'framerr.db');

// Ensure data directory exists (for both DATA_DIR and custom DB_PATH parent)
const dbDir = path.dirname(DB_PATH);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database instance type
type DatabaseInstance = ReturnType<typeof Database>;

// Internal database instance (use getDb() to access)
let _db: DatabaseInstance;

try {
    _db = new Database(DB_PATH, {
        // Verbose logging disabled - was causing UUID truncation in console output
        verbose: undefined
    });

    // Enable WAL mode for better concurrency (allows simultaneous reads and writes)
    _db.pragma('journal_mode = WAL');

    // Enable foreign key constraints
    _db.pragma('foreign_keys = ON');

    console.log(`[DB] Connected to SQLite database: ${DB_PATH}`);
    console.log(`[DB] WAL mode enabled, foreign keys enforced`);

} catch (error) {
    console.error('[DB] Failed to initialize database:', (error as Error).message);
    throw error;
}

/**
 * Initialize database schema from schema.sql file
 * This should be called once on first startup
 */
function initializeSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    try {
        // Execute schema in a transaction for atomicity
        _db.exec(schema);
        console.log('[DB] Schema initialized successfully');
    } catch (error) {
        console.error('[DB] Failed to initialize schema:', (error as Error).message);
        throw error;
    }
}

interface TableCountResult {
    count: number;
}

/**
 * Check if database is initialized (has tables)
 */
function isInitialized(): boolean {
    const result = _db.prepare(`
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type='table' AND name='users'
    `).get() as TableCountResult;

    return result.count > 0;
}

/**
 * Get the current database instance
 * This is the primary way to access the database - allows hot-swapping after restore
 */
function getDb(): DatabaseInstance {
    if (!_db) {
        console.error('[DB] CRITICAL: getDb() called but _db is undefined!');
        throw new Error('Database not initialized');
    }
    return _db;
}

/**
 * Reinitialize database connection
 * Used after restore to pick up the new database file
 */
function reinitializeDatabase(): void {
    console.log('[DB] Reinitializing database connection...');

    // Close existing connection
    if (_db) {
        try {
            _db.close();
        } catch (error) {
            console.warn('[DB] Error closing old connection:', (error as Error).message);
        }
    }

    // Create new connection to the (potentially replaced) database file
    _db = new Database(DB_PATH, {
        verbose: undefined
    });

    // Enable WAL mode and foreign keys on new connection
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Invalidate any in-memory caches that hold stale data from the old database
    try {
        const { invalidateConfigCache } = require('../db/systemConfig');
        invalidateConfigCache();
    } catch (error) {
        console.warn('[DB] Could not invalidate config cache:', (error as Error).message);
    }

    console.log('[DB] Database connection reinitialized');
}

/**
 * Close database connection
 * Should only be called on graceful shutdown
 */
function closeDatabase(): void {
    if (_db) {
        _db.close();
        console.log('[DB] Database connection closed');
    }
}

// Export database accessor and utilities
// NOTE: getDb() is the primary way to access the database (allows hot-swap after restore)
export {
    getDb,
    initializeSchema,
    isInitialized,
    reinitializeDatabase,
    closeDatabase
};
