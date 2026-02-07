/**
 * Migration: Add is_system column to custom_icons
 * Version: 4
 * 
 * Adds is_system flag to distinguish system-provided icons from user uploads.
 * System icons cannot be deleted via the API.
 */

module.exports = {
    version: 4,
    name: 'add_system_icons_column',
    up(db) {
        // Check if column already exists (idempotent migration)
        const columns = db.prepare(`PRAGMA table_info(custom_icons)`).all();
        const hasColumn = columns.some(col => col.name === 'is_system');

        if (!hasColumn) {
            db.exec(`
                ALTER TABLE custom_icons ADD COLUMN is_system INTEGER DEFAULT 0;
            `);
        }
    }
};
