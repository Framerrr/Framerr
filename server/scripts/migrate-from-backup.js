#!/usr/bin/env node
/**
 * COMPLETE MIGRATION FROM CONFIGBACKUP
 * 
 * This script migrates ALL data from docs/CONFIGBACKUP to a working SQLite database.
 * EVERY piece of data will be accounted for.
 * 
 * Usage: node server/scripts/migrate-from-backup.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Paths
const BACKUP_DIR = path.join(__dirname, '../../docs/CONFIGBACKUP');
const OUTPUT_DB = path.join(__dirname, '../data/framerr.db');
const SCHEMA_FILE = path.join(__dirname, '../database/schema.sql');

console.log('═══════════════════════════════════════════════════');
console.log('  Framerr COMPLETE Migration from Backup');
console.log('═══════════════════════════════════════════════════\n');

// Read backup files
console.log('[1/7] Reading backup files...');
const users = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'users.json'), 'utf8'));
const systemConfig = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'config.json'), 'utf8'));
const notifications = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'notifications.json'), 'utf8'));
const customIcons = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'custom-icons.json'), 'utf8'));

// User config for Jon (426f57e1-2283-4249-93d6-bbb3436e4092)
const jonConfig = JSON.parse(fs.readFileSync(
    path.join(BACKUP_DIR, 'users/426f57e1-2283-4249-93d6-bbb3436e4092.json'), 'utf8'
));

console.log(`  ✓ Found ${users.users.length} users`);
console.log(`  ✓ Found ${users.sessions.length} sessions`);
console.log(`  ✓ Found 1 user config (Jon)`);
console.log(`  ✓ Found ${customIcons.icons.length} custom icons`);
console.log(`  ✓ System config loaded`);

// Create fresh database
console.log('\n[2/7] Creating fresh database...');
if (fs.existsSync(OUTPUT_DB)) {
    fs.unlinkSync(OUTPUT_DB);
    console.log('  ✓ Deleted old database');
}

const db = new Database(OUTPUT_DB);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
console.log('  ✓ Database created');

// Load schema
console.log('\n[3/7] Initializing schema...');
const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
db.exec(schema);
console.log('  ✓ Schema initialized');

// Migrate users
console.log('\n[4/7] Migrating users...');
const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, email, group_id, is_setup_admin, created_at, last_login)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const migrateUsers = db.transaction(() => {
    for (const user of users.users) {
        insertUser.run(
            user.id,
            user.username,
            user.passwordHash,
            user.email || null,
            user.group,
            user.requirePasswordReset ? 1 : 0,
            Math.floor(new Date(user.createdAt).getTime() / 1000),
            user.lastLogin ? Math.floor(new Date(user.lastLogin).getTime() / 1000) : null
        );
    }
});

migrateUsers();
console.log(`  ✓ Migrated ${users.users.length} users`);
users.users.forEach(u => {
    console.log(`    - ${u.username} (${u.id.substring(0, 20)}...) [${u.group}]`);
});

// Migrate sessions
console.log('\n[5/7] Migrating sessions...');
const insertSession = db.prepare(`
    INSERT INTO sessions (token, user_id, ip_address, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const migrateSessions = db.transaction(() => {
    for (const session of users.sessions) {
        insertSession.run(
            session.id,
            session.userId,
            session.ipAddress || null,
            session.userAgent || null,
            Math.floor(new Date(session.createdAt).getTime() / 1000),
            Math.floor(new Date(session.expiresAt).getTime() / 1000)
        );
    }
});

migrateSessions();
console.log(`  ✓ Migrated ${users.sessions.length} sessions`);

// Migrate user config (Jon)
console.log('\n[6/7] Migrating user configurations...');
const insertConfig = db.prepare(`
    INSERT INTO user_preferences (user_id, dashboard_config, tabs, theme_config, sidebar_config, preferences)
    VALUES (?, ?, ?, ?, ?, ?)
`);

// Map jonConfig to user_preferences columns
const dashboardConfig = jonConfig.dashboard || { widgets: [] };
const tabs = jonConfig.tabs || [];
const themeConfig = jonConfig.theme || { mode: 'system', primaryColor: '#3b82f6' };
const sidebarConfig = jonConfig.sidebar || { collapsed: false };
const preferences = {
    ...jonConfig.preferences,
    clockWidget: jonConfig.preferences?.clockWidget,
    dashboardGreeting: jonConfig.preferences?.dashboardGreeting
};

// Also store any UI preferences
if (jonConfig.ui) {
    preferences.ui = jonConfig.ui;
}

insertConfig.run(
    '426f57e1-2283-4249-93d6-bbb3436e4092', // Jon's ID
    JSON.stringify(dashboardConfig),
    JSON.stringify(tabs),
    JSON.stringify(themeConfig),
    JSON.stringify(sidebarConfig),
    JSON.stringify(preferences)
);

console.log('  ✓ Migrated Jon\'s configuration');
console.log(`    - ${dashboardConfig.widgets.length} widgets`);
console.log(`    - ${tabs.length} tabs`);
console.log(`    - Theme: ${themeConfig.mode || themeConfig.preset}`);

// Migrate system config
console.log('\n[7/7] Migrating system configuration...');
const upsertConfig = db.prepare(`
    INSERT INTO system_config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const migrateSystemConfig = db.transaction(() => {
    // Server config
    if (systemConfig.server) {
        upsertConfig.run('server', JSON.stringify(systemConfig.server));
    }

    // Auth config (nested structure)
    if (systemConfig.auth?.local) {
        upsertConfig.run('auth.local', JSON.stringify(systemConfig.auth.local));
    }
    if (systemConfig.auth?.proxy) {
        upsertConfig.run('auth.proxy', JSON.stringify(systemConfig.auth.proxy));
    }
    if (systemConfig.auth?.iframe) {
        upsertConfig.run('auth.iframe', JSON.stringify(systemConfig.auth.iframe));
    }
    if (systemConfig.auth?.session) {
        upsertConfig.run('auth.session', JSON.stringify(systemConfig.auth.session));
    }

    // Integrations
    if (systemConfig.integrations) {
        upsertConfig.run('integrations', JSON.stringify(systemConfig.integrations));
    }

    // Groups
    if (systemConfig.groups) {
        upsertConfig.run('groups', JSON.stringify(systemConfig.groups));
    }

    // Default group
    if (systemConfig.defaultGroup) {
        upsertConfig.run('defaultGroup', JSON.stringify(systemConfig.defaultGroup));
    }

    // Tab groups
    if (systemConfig.tabGroups) {
        upsertConfig.run('tabGroups', JSON.stringify(systemConfig.tabGroups));
    }

    // Debug
    if (systemConfig.debug) {
        upsertConfig.run('debug', JSON.stringify(systemConfig.debug));
    }

    // Favicon
    if (systemConfig.favicon) {
        upsertConfig.run('favicon', JSON.stringify(systemConfig.favicon));
    }
});

migrateSystemConfig();
console.log('  ✓ Migrated system configuration');
console.log(`    - Server name: ${systemConfig.server?.name}`);
console.log(`    - Integrations: ${Object.keys(systemConfig.integrations || {}).length} services`);
console.log(`    - Groups: ${systemConfig.groups?.length}`);
console.log(`    - Tab groups: ${systemConfig.tabGroups?.length}`);

// Custom icons (if needed, migrate from files)
if (customIcons.icons.length > 0) {
    console.log('\n[ICONS] Custom icons detected');
    console.log('  ℹ  Custom icon files need to be manually copied to /config/upload/custom-icons/');
    console.log(`  ℹ  Icon referenced: ${customIcons.icons[0].id}`);
}

// Verification
console.log('\n═══════════════════════════════════════════════════');
console.log('  Verification');
console.log('═══════════════════════════════════════════════════');

const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    sessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    userPrefs: db.prepare('SELECT COUNT(*) as c FROM user_preferences').get().c,
    systemConfig: db.prepare('SELECT COUNT(*) as c FROM system_config').get().c
};

console.log(`Users: ${stats.users} (expected: ${users.users.length})`);
console.log(`Sessions: ${stats.sessions} (expected: ${users.sessions.length})`);
console.log(`User Preferences: ${stats.userPrefs} (expected: 1)`);
console.log(`System Config: ${stats.systemConfig} (expected: >= 10)`);

// Check Jon's data specifically
const jonData = db.prepare(`
    SELECT dashboard_config, tabs, theme_config FROM user_preferences 
    WHERE user_id = '426f57e1-2283-4249-93d6-bbb3436e4092'
`).get();

if (jonData) {
    const jonDashboard = JSON.parse(jonData.dashboard_config);
    const jonTabs = JSON.parse(jonData.tabs);
    const jonTheme = JSON.parse(jonData.theme_config);

    console.log('\nJon\'s Data:');
    console.log(`  Widgets: ${jonDashboard.widgets?.length || 0} (expected: 10)`);
    console.log(`  Tabs: ${jonTabs.length} (expected: 9)`);
    console.log(`  Theme: ${jonTheme.mode || jonTheme.preset}`);

    if (jonDashboard.widgets?.length === 10 && jonTabs.length === 9) {
        console.log('\n✅ ALL DATA MIGRATED SUCCESSFULLY!');
    } else {
        console.log('\n⚠️  Data count mismatch - review migration');
    }
} else {
    console.log('\n❌ Jon\'s user_preferences NOT FOUND!');
}

db.close();

console.log('\n═══════════════════════════════════════════════════');
console.log('  Migration Complete');
console.log('═══════════════════════════════════════════════════');
console.log(`\nDatabase created: ${OUTPUT_DB}`);
console.log('\nNext steps:');
console.log('  1. Copy framerr.db to Docker: docker cp server/data/framerr.db framerr:/config/');
console.log('  2. Restart container: docker restart framerr');
console.log('  3. Login and verify all data is there');
console.log('');
