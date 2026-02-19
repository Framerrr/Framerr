/**
 * Migration 0036: Add Metric History Sources
 *
 * Tracks per-metric source resolution for the metric history system.
 * Stores probe results (external history availability) per integration per metric.
 *
 * Part of the Metric History Recording feature (Phase 2).
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 36,
    name: 'add_metric_history_sources',

    up(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS metric_history_sources (
                integration_id TEXT NOT NULL,
                metric_key TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'pending',
                last_probed INTEGER,
                probe_status TEXT,
                PRIMARY KEY (integration_id, metric_key)
            );
        `);

        logger.debug('[Migration 0036] Created metric_history_sources table');
    }
};
