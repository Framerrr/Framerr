/**
 * DB Query Utility - Run ad-hoc SQLite queries
 * Usage: node scripts/db-query.js "SELECT * FROM integration_instances"
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'framerr.sqlite');
const query = process.argv[2];

if (!query) {
    console.error('Usage: node scripts/db-query.js "YOUR SQL QUERY"');
    process.exit(1);
}

try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(query).all();
    console.log(JSON.stringify(rows, null, 2));
    db.close();
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
