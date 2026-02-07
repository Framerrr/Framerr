/**
 * Migration 0033: Optimize service monitor history
 * 
 * 1. Prune raw check history to 48 hours (aggregates preserve long-term data)
 * 2. Drop redundant indexes (composite index covers all query patterns)
 */

/** @param {import('better-sqlite3').Database} db */
exports.up = function (db) {
    // Prune history older than 48 hours
    const cutoff = Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60);
    const result = db.prepare('DELETE FROM service_monitor_history WHERE checked_at < ?').run(cutoff);
    console.log(`  [0033] Pruned ${result.changes} old history rows (keeping 48h)`);

    // Drop redundant indexes
    // idx_monitor_history_recent (monitor_id, checked_at DESC) covers all query patterns:
    //   - WHERE monitor_id = ? ORDER BY checked_at DESC (hot path)
    //   - WHERE monitor_id = ? (covered by composite leading column)
    //   - WHERE checked_at < ? (prune query, runs hourly on small dataset)
    db.exec('DROP INDEX IF EXISTS idx_monitor_history_monitor');
    db.exec('DROP INDEX IF EXISTS idx_monitor_history_checked');
    console.log('  [0033] Dropped redundant indexes (composite index retained)');
};

/** @param {import('better-sqlite3').Database} db */
exports.down = function (db) {
    // Recreate dropped indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_monitor_history_monitor ON service_monitor_history(monitor_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_monitor_history_checked ON service_monitor_history(checked_at)');
};
