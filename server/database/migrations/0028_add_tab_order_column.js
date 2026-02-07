/**
 * Migration: Add tab_order column to tab_groups table
 * 
 * Enables ordering/sorting of per-user tab groups.
 */

module.exports = {
    version: 28,
    name: 'add_tab_order_column',
    up: (db) => {
        // Add tab_order column to tab_groups table
        db.exec(`
            ALTER TABLE tab_groups ADD COLUMN tab_order INTEGER DEFAULT 0;
        `);
    },

    down: (db) => {
        // SQLite doesn't support DROP COLUMN directly in older versions
        // For rollback, we'd need to recreate the table without the column
        // For now, we just leave the column (no harm)
    }
};
