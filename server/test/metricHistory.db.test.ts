/**
 * Metric History DB Layer Tests
 *
 * Tests the raw database functions in server/db/metricHistory.ts
 * using an in-memory SQLite database for isolation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Create in-memory DB and mock getDb before importing the module under test
const testDb = new Database(':memory:');

vi.mock('../database/db', () => ({
    getDb: () => testDb,
}));

// Mock logger to silence output during tests
vi.mock('../utils/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Import the module under test AFTER mocking
import {
    insertRaw,
    insertAggregated,
    query,
    getRawForAggregation,
    deleteOlderThan,
    deleteByResolutionOlderThan,
    deleteAll,
    deleteForIntegration,
    getStorageStats,
} from '../db/metricHistory';

// ============================================================================
// SETUP
// ============================================================================

function createTable(): void {
    testDb.exec(`
        CREATE TABLE IF NOT EXISTS metric_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            integration_id TEXT NOT NULL,
            metric_key TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            resolution TEXT NOT NULL DEFAULT 'raw',
            value REAL,
            value_min REAL,
            value_avg REAL,
            value_max REAL,
            sample_count INTEGER NOT NULL DEFAULT 1,
            UNIQUE(integration_id, metric_key, timestamp, resolution)
        );
        CREATE INDEX IF NOT EXISTS idx_metric_history_lookup
            ON metric_history(integration_id, metric_key, resolution, timestamp);
    `);
}

function clearTable(): void {
    testDb.exec('DELETE FROM metric_history');
}

// ============================================================================
// TESTS
// ============================================================================

describe('metricHistory DB functions', () => {
    beforeEach(() => {
        createTable();
        clearTable();
    });

    afterEach(() => {
        clearTable();
    });

    // ========================================================================
    // INSERT
    // ========================================================================

    describe('insertRaw', () => {
        it('should insert a raw data point', () => {
            insertRaw('int-1', 'cpu', 1000, 42.5);

            const rows = testDb.prepare('SELECT * FROM metric_history').all() as Array<Record<string, unknown>>;
            expect(rows).toHaveLength(1);
            expect(rows[0].integration_id).toBe('int-1');
            expect(rows[0].metric_key).toBe('cpu');
            expect(rows[0].timestamp).toBe(1000);
            expect(rows[0].resolution).toBe('raw');
            expect(rows[0].value).toBe(42.5);
            expect(rows[0].sample_count).toBe(1);
        });

        it('should ignore duplicate insertions (same integration+metric+timestamp+resolution)', () => {
            insertRaw('int-1', 'cpu', 1000, 42.5);
            insertRaw('int-1', 'cpu', 1000, 99.9); // duplicate

            const rows = testDb.prepare('SELECT * FROM metric_history').all() as Array<Record<string, unknown>>;
            expect(rows).toHaveLength(1);
            expect(rows[0].value).toBe(42.5); // original preserved
        });

        it('should allow different metric keys for same integration+timestamp', () => {
            insertRaw('int-1', 'cpu', 1000, 42.5);
            insertRaw('int-1', 'memory', 1000, 65.0);

            const rows = testDb.prepare('SELECT * FROM metric_history').all() as Array<Record<string, unknown>>;
            expect(rows).toHaveLength(2);
        });
    });

    describe('insertAggregated', () => {
        it('should insert an aggregated data point', () => {
            insertAggregated('int-1', 'cpu', 1000, '1min', 20, 50, 80, 4);

            const rows = testDb.prepare('SELECT * FROM metric_history').all() as Array<Record<string, unknown>>;
            expect(rows).toHaveLength(1);
            expect(rows[0].resolution).toBe('1min');
            expect(rows[0].value_min).toBe(20);
            expect(rows[0].value_avg).toBe(50);
            expect(rows[0].value_max).toBe(80);
            expect(rows[0].sample_count).toBe(4);
            expect(rows[0].value).toBeNull(); // raw value is null for aggregated
        });
    });

    // ========================================================================
    // QUERY
    // ========================================================================

    describe('query', () => {
        it('should return rows matching integration, metric, resolution, and time range', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);
            insertRaw('int-1', 'cpu', 300, 30);
            insertRaw('int-1', 'cpu', 400, 40);

            const rows = query('int-1', 'cpu', 'raw', 150, 350);
            expect(rows).toHaveLength(2);
            expect(rows[0].timestamp).toBe(200);
            expect(rows[1].timestamp).toBe(300);
        });

        it('should return empty array when no matching data', () => {
            const rows = query('nonexistent', 'cpu', 'raw', 0, 9999);
            expect(rows).toHaveLength(0);
        });

        it('should filter by resolution', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertAggregated('int-1', 'cpu', 100, '1min', 5, 10, 15, 4);

            const rawRows = query('int-1', 'cpu', 'raw', 0, 999);
            expect(rawRows).toHaveLength(1);
            expect(rawRows[0].resolution).toBe('raw');

            const aggRows = query('int-1', 'cpu', '1min', 0, 999);
            expect(aggRows).toHaveLength(1);
            expect(aggRows[0].resolution).toBe('1min');
        });

        it('should return rows ordered by timestamp ascending', () => {
            insertRaw('int-1', 'cpu', 300, 30);
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);

            const rows = query('int-1', 'cpu', 'raw', 0, 999);
            expect(rows[0].timestamp).toBe(100);
            expect(rows[1].timestamp).toBe(200);
            expect(rows[2].timestamp).toBe(300);
        });
    });

    // ========================================================================
    // AGGREGATION HELPERS
    // ========================================================================

    describe('getRawForAggregation', () => {
        it('should return rows of specified resolution older than cutoff', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);
            insertRaw('int-1', 'cpu', 300, 30);

            const rows = getRawForAggregation('raw', 250);
            expect(rows).toHaveLength(2);
            expect(rows[0].timestamp).toBe(100);
            expect(rows[1].timestamp).toBe(200);
        });

        it('should not return rows at or after cutoff', () => {
            insertRaw('int-1', 'cpu', 100, 10);

            const rows = getRawForAggregation('raw', 100);
            expect(rows).toHaveLength(0);
        });

        it('should only return matching resolution', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertAggregated('int-1', 'cpu', 100, '1min', 5, 10, 15, 4);

            const rows = getRawForAggregation('1min', 999);
            expect(rows).toHaveLength(1);
            expect(rows[0].resolution).toBe('1min');
        });
    });

    // ========================================================================
    // DELETE
    // ========================================================================

    describe('deleteOlderThan', () => {
        it('should delete rows older than cutoff for specific integration', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);
            insertRaw('int-2', 'cpu', 100, 10); // different integration

            const deleted = deleteOlderThan('int-1', 150);
            expect(deleted).toBe(1);

            const remaining = testDb.prepare('SELECT * FROM metric_history').all();
            expect(remaining).toHaveLength(2);
        });
    });

    describe('deleteByResolutionOlderThan', () => {
        it('should delete rows of specified resolution older than cutoff', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);
            insertAggregated('int-1', 'cpu', 100, '1min', 5, 10, 15, 4);

            const deleted = deleteByResolutionOlderThan('raw', 150);
            expect(deleted).toBe(1);

            const remaining = testDb.prepare('SELECT * FROM metric_history').all();
            expect(remaining).toHaveLength(2); // 1 raw at 200, 1 aggregated at 100
        });
    });

    describe('deleteAll', () => {
        it('should delete all metric history data', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-2', 'memory', 200, 20);
            insertAggregated('int-1', 'cpu', 300, '1min', 5, 10, 15, 4);

            const deleted = deleteAll();
            expect(deleted).toBe(3);

            const remaining = testDb.prepare('SELECT * FROM metric_history').all();
            expect(remaining).toHaveLength(0);
        });
    });

    describe('deleteForIntegration', () => {
        it('should delete all data for a specific integration', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'memory', 200, 20);
            insertRaw('int-2', 'cpu', 100, 30);

            const deleted = deleteForIntegration('int-1');
            expect(deleted).toBe(2);

            const remaining = testDb.prepare('SELECT * FROM metric_history').all();
            expect(remaining).toHaveLength(1);
        });
    });

    // ========================================================================
    // STATS
    // ========================================================================

    describe('getStorageStats', () => {
        it('should return total row count and per-integration breakdown', () => {
            insertRaw('int-1', 'cpu', 100, 10);
            insertRaw('int-1', 'cpu', 200, 20);
            insertRaw('int-2', 'memory', 300, 30);

            const stats = getStorageStats();
            expect(stats.totalRows).toBe(3);
            expect(stats.integrations).toHaveLength(2);

            const int1 = stats.integrations.find(i => i.integrationId === 'int-1');
            expect(int1).toBeDefined();
            expect(int1!.rowCount).toBe(2);
            expect(int1!.oldestTimestamp).toBe(100);
            expect(int1!.newestTimestamp).toBe(200);
        });

        it('should return zero stats when empty', () => {
            const stats = getStorageStats();
            expect(stats.totalRows).toBe(0);
            expect(stats.integrations).toHaveLength(0);
        });
    });
});
