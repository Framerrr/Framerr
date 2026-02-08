/**
 * Framerr Database Migration System
 * 
 * Handles automatic schema migrations on server startup.
 * Uses PRAGMA user_version for version tracking.
 * 
 * Features:
 * - Auto-backup before migrations
 * - Forward-only migrations (industry standard)
 * - Downgrade detection with helpful error
 * - Transaction-wrapped migrations
 */

import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import logger from '../utils/logger';
import { getDb } from './db';

// Type definitions for better-sqlite3 database instance
type DatabaseInstance = ReturnType<typeof Database>;

// Migration file structure
interface Migration {
    version: number;
    name?: string;
    filename: string;
    up: (db: DatabaseInstance) => void;
}

// Migration status result
export interface MigrationStatus {
    needsMigration: boolean;
    isDowngrade: boolean;
    currentVersion: number;
    expectedVersion: number;
}

// Migration run result
export interface MigrationResult {
    success: boolean;
    migratedFrom?: number;
    migratedTo?: number;
    error?: string;
}

// Backup info structure
interface BackupInfo {
    filename: string;
    path: string;
    size: number;
    created: Date;
}

// Data directory configuration
// FRAMERR_DB_PATH: Direct path to database file (for local dev outside repo)
// DATA_DIR: Directory containing framerr.db (default behavior)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.FRAMERR_DB_PATH || path.join(DATA_DIR, 'framerr.db');
export const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const MAX_BACKUPS = 3;

/**
 * Get current schema version from database
 */
export function getCurrentVersion(db: DatabaseInstance): number {
    const result = db.pragma('user_version', { simple: true }) as number;
    return result || 0;
}

/**
 * Set schema version in database
 */
export function setVersion(db: DatabaseInstance, version: number): void {
    db.pragma(`user_version = ${version}`);
}

/**
 * Get expected schema version (highest migration available)
 */
export function getExpectedVersion(): number {
    const migrations = loadMigrations();
    if (migrations.length === 0) return 1; // Base version
    return Math.max(...migrations.map(m => m.version));
}

/**
 * Load all migration files from migrations directory
 */
export function loadMigrations(): Migration[] {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        logger.debug('[Migrator] No migrations directory found');
        return [];
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js'))
        .sort(); // Alphabetical = version order due to naming convention

    const migrations: Migration[] = [];
    for (const file of files) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const migration = require(path.join(migrationsDir, file));
            if (migration.version && migration.up) {
                migrations.push({
                    ...migration,
                    filename: file
                });
            }
        } catch (error) {
            logger.error(`[Migrator] Failed to load ${file}: error="${(error as Error).message}"`);
        }
    }

    return migrations.sort((a, b) => a.version - b.version);
}

/**
 * Get pending migrations that need to be run
 */
export function getPendingMigrations(db: DatabaseInstance): Migration[] {
    const currentVersion = getCurrentVersion(db);
    const migrations = loadMigrations();
    return migrations.filter(m => m.version > currentVersion);
}

/**
 * Create backup of database file
 */
export function createBackup(): string | null {
    if (!fs.existsSync(DB_PATH)) {
        logger.debug('[Migrator] No database to backup');
        return null;
    }

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentVersion = getCurrentVersion(getDb());
    const backupPath = path.join(BACKUP_DIR, `framerr-v${currentVersion}-${timestamp}.db`);

    try {
        fs.copyFileSync(DB_PATH, backupPath);
        logger.info(`[Migrator] Backup created: ${backupPath}`);

        // Clean up old backups
        cleanupOldBackups();

        return backupPath;
    } catch (error) {
        logger.error(`[Migrator] Backup failed: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Remove old backups, keep only MAX_BACKUPS most recent
 */
function cleanupOldBackups(): void {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('framerr-') && f.endsWith('.db'))
        .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Newest first

    // Delete backups beyond MAX_BACKUPS
    for (let i = MAX_BACKUPS; i < backups.length; i++) {
        try {
            fs.unlinkSync(backups[i].path);
            logger.debug(`[Migrator] Deleted old backup: ${backups[i].name}`);
        } catch (error) {
            logger.warn(`[Migrator] Failed to delete old backup: ${backups[i].name}`);
        }
    }
}

/**
 * Restore database from backup file
 */
export function restoreFromBackup(backupPath: string): boolean {
    if (!fs.existsSync(backupPath)) {
        logger.error(`[Migrator] Backup not found: ${backupPath}`);
        return false;
    }

    try {
        fs.copyFileSync(backupPath, DB_PATH);
        logger.info(`[Migrator] Database restored from: ${backupPath}`);
        return true;
    } catch (error) {
        logger.error(`[Migrator] Restore failed: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Check if database needs migration
 */
export function checkMigrationStatus(db: DatabaseInstance): MigrationStatus {
    const currentVersion = getCurrentVersion(db);
    const expectedVersion = getExpectedVersion();

    return {
        needsMigration: currentVersion < expectedVersion,
        isDowngrade: currentVersion > expectedVersion,
        currentVersion,
        expectedVersion
    };
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: DatabaseInstance): MigrationResult {
    const status = checkMigrationStatus(db);

    // Handle downgrade attempt
    if (status.isDowngrade) {
        const error = new Error(
            `Database schema (v${status.currentVersion}) is newer than this version of Framerr expects (v${status.expectedVersion}). ` +
            `Please upgrade Framerr or restore from a backup. Backups are stored in: ${BACKUP_DIR}`
        );
        logger.error(`[Migrator] ${error.message}`);
        return { success: false, error: error.message };
    }

    // No migration needed
    if (!status.needsMigration) {
        logger.debug(`[Migrator] Database at version ${status.currentVersion}, no migration needed`);
        return { success: true, migratedFrom: status.currentVersion, migratedTo: status.currentVersion };
    }

    const pending = getPendingMigrations(db);
    logger.info(`[Migrator] Running ${pending.length} migrations (v${status.currentVersion} → v${status.expectedVersion})`);

    // Create backup before migration
    const backupPath = createBackup();
    if (!backupPath && fs.existsSync(DB_PATH)) {
        logger.warn('[Migrator] Failed to create backup, proceeding anyway...');
    }

    let lastSuccessfulVersion = status.currentVersion;

    try {
        for (const migration of pending) {
            logger.debug(`[Migrator] Running migration ${migration.version}: ${migration.name || migration.filename}`);

            // Run migration in transaction
            const runMigration = db.transaction(() => {
                migration.up(db);
                setVersion(db, migration.version);
            });

            runMigration();
            lastSuccessfulVersion = migration.version;
            logger.debug(`[Migrator] ✓ Migration ${migration.version} complete`);
        }

        logger.info(`[Migrator] All migrations complete (v${status.currentVersion} → v${lastSuccessfulVersion})`);
        return {
            success: true,
            migratedFrom: status.currentVersion,
            migratedTo: lastSuccessfulVersion
        };

    } catch (error) {
        logger.error(`[Migrator] Migration failed at v${lastSuccessfulVersion + 1}: error="${(error as Error).message}"`);

        // Attempt to restore from backup
        if (backupPath) {
            logger.info('[Migrator] Attempting to restore from backup...');
            if (restoreFromBackup(backupPath)) {
                logger.info('[Migrator] Database restored successfully');
            } else {
                logger.error('[Migrator] Failed to restore backup! Manual intervention required.');
            }
        }

        return {
            success: false,
            migratedFrom: status.currentVersion,
            migratedTo: lastSuccessfulVersion,
            error: (error as Error).message
        };
    }
}

/**
 * List available backups
 */
export function listBackups(): BackupInfo[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('framerr-') && f.endsWith('.db'))
        .map(f => {
            const stat = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                filename: f,
                path: path.join(BACKUP_DIR, f),
                size: stat.size,
                created: stat.mtime
            };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime());
}
