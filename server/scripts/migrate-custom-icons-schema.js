const Database = require('better-sqlite3');
const path = require('path');

// Migration script to convert custom_icons from base64 storage to file-based storage
// This handles databases that were created with the old schema

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'framerr.db');

console.log('Starting custom_icons schema migration...');
console.log(`Database: ${DB_PATH}`);

const db = new Database(DB_PATH);

try {
    // Check if the old 'data' column exists
    const tableInfo = db.prepare("PRAGMA table_info(custom_icons)").all();
    const hasDataColumn = tableInfo.some(col => col.name === 'data');
    const hasFilePathColumn = tableInfo.some(col => col.name === 'file_path');

    if (hasDataColumn && !hasFilePathColumn) {
        console.log('  Old schema detected (has data column). Migrating to file-based storage...');

        // Create new table with file_path column
        db.exec(`
            -- Create new table with file_path
            CREATE TABLE custom_icons_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_by TEXT,
                uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
            );
            
            -- Copy data from old table (skip data column, use name as file_path)
            INSERT INTO custom_icons_new (id, name, file_path, mime_type, uploaded_by, uploaded_at)
            SELECT id, name, name as file_path, mime_type, uploaded_by, uploaded_at
            FROM custom_icons;
            
            -- Drop old table
            DROP TABLE custom_icons;
            
            -- Rename new table
            ALTER TABLE custom_icons_new RENAME TO custom_icons;
            
            -- Recreate index
            CREATE INDEX IF NOT EXISTS idx_custom_icons_uploaded_by ON custom_icons(uploaded_by);
        `);

        console.log('  ✅ Migration complete! Schema updated to use file_path.');
    } else if (hasFilePathColumn) {
        console.log('  ✅ Schema already up to date (has file_path column).');
    } else {
        console.log('  ℹ  No custom_icons table found or unexpected schema. Skipping migration.');
    }

} catch (error) {
    console.error('  ❌ Migration failed:', error.message);
    process.exit(1);
} finally {
    db.close();
}

console.log('Migration script complete.');
