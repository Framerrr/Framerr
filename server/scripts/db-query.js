/**
 * Database Query Utility
 * Usage: npm run db:query "SELECT * FROM table_name"
 * 
 * Examples:
 *   npm run db:query "SELECT name FROM sqlite_master WHERE type='table'"  -- List all tables
 *   npm run db:query "SELECT * FROM users"
 *   npm run db:query "SELECT * FROM integration_instances"
 *   npm run db:query "PRAGMA table_info(users)"  -- Show table schema
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'framerr.db');
const query = process.argv[2];

if (!query) {
    console.log('Usage: npm run db:query "YOUR SQL QUERY"');
    console.log('');
    console.log('Examples:');
    console.log('  npm run db:query "SELECT name FROM sqlite_master WHERE type=\'table\'"');
    console.log('  npm run db:query "SELECT * FROM users"');
    console.log('  npm run db:query "PRAGMA table_info(users)"');
    process.exit(1);
}

try {
    const db = new Database(dbPath, { readonly: true });

    // Check if it's a SELECT/PRAGMA query (returns data) vs other statements
    const upperQuery = query.trim().toUpperCase();
    if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA')) {
        const rows = db.prepare(query).all();
        console.log(JSON.stringify(rows, null, 2));
    } else {
        console.log('Only SELECT and PRAGMA queries are allowed (read-only mode)');
        process.exit(1);
    }

    db.close();
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
