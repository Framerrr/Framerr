/**
 * DB Query Utility - Run ad-hoc SQLite queries
 * Usage: npx tsx scripts/db-query.ts "SELECT * FROM integration_instances"
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'data', 'framerr.sqlite');
const query = process.argv[2];

if (!query) {
    console.error('Usage: npx tsx scripts/db-query.ts "YOUR SQL QUERY"');
    process.exit(1);
}

try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(query).all();
    console.log(JSON.stringify(rows, null, 2));
    db.close();
} catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
}
