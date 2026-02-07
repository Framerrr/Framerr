#!/usr/bin/env node
/**
 * Diagnostic script to check user_preferences data in SQLite
 * 
 * Usage: docker exec framerr node /app/server/scripts/diagnose-user-data.js
 */

const { db } = require('../database/db');

console.log('\n=== User Data Diagnostic ===\n');

// Check all users
console.log('--- Users Table ---');
const users = db.prepare('SELECT id, username, group_id FROM users').all();
console.log(`Found ${users.length} users:`);
users.forEach(u => {
    console.log(`  - ${u.username} (${u.id.substring(0, 20)}...) [${u.group_id}]`);
});

// Check user_preferences
console.log('\n--- User Preferences Table ---');
const prefs = db.prepare('SELECT user_id FROM user_preferences').all();
console.log(`Found ${prefs.length} user_preferences records:`);
prefs.forEach(p => {
    console.log(`  - User ID: ${p.user_id.substring(0, 20)}...`);
});

// Check for users WITHOUT preferences
console.log('\n--- Users Missing Preferences ---');
const missing = db.prepare(`
    SELECT u.id, u.username 
    FROM users u
    LEFT JOIN user_preferences up ON u.id = up.user_id
    WHERE up.user_id IS NULL
`).all();

if (missing.length > 0) {
    console.log(`⚠️  Found ${missing.length} users without preferences:`);
    missing.forEach(m => {
        console.log(`  - ${m.username} (${m.id})`);
    });

    console.log('\n--- Creating Default Preferences ---');
    const insertPref = db.prepare(`
        INSERT INTO user_preferences (user_id, dashboard_config, tabs, theme_config, sidebar_config, preferences)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const user of missing) {
        insertPref.run(
            user.id,
            JSON.stringify({ widgets: [] }),
            JSON.stringify([]),
            JSON.stringify({ mode: 'system', primaryColor: '#3b82f6' }),
            JSON.stringify({ collapsed: false }),
            JSON.stringify({ dashboardGreeting: { enabled: true, text: 'Your personal dashboard' } })
        );
        console.log(`  ✓ Created default preferences for ${user.username}`);
    }

    console.log('\n✓ Fixed missing preferences!');
} else {
    console.log('✓ All users have preferences');
}

// Summary
console.log('\n=== Summary ===');
console.log(`Users: ${users.length}`);
console.log(`User Preferences: ${db.prepare('SELECT COUNT(*) as c FROM user_preferences').get().c}`);
console.log(`Notifications: ${db.prepare('SELECT COUNT(*) as c FROM notifications').get().c}`);
console.log(`Sessions: ${db.prepare('SELECT COUNT(*) as c FROM sessions').get().c}`);
console.log('');
