/**
 * Migration 0035: Add Metric History
 *
 * Creates the metric_history table for recording system status metrics over time.
 * Supports tiered resolution (raw, 1min, 5min, 15min) with min/avg/max aggregation.
 *
 * Part of the Metric History Recording feature (Phase 1).
 * Gated behind experimental settings toggle.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 35,
    name: 'add_metric_history',

    up(db) {
        db.exec(`
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
                sample_count INTEGER DEFAULT 1,
                UNIQUE(integration_id, metric_key, timestamp, resolution)
            );

            CREATE INDEX IF NOT EXISTS idx_mh_lookup
                ON metric_history(integration_id, metric_key, resolution, timestamp);
        `);

        logger.debug('[Migration 0035] Created metric_history table');
    }
};
