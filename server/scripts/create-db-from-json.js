#!/usr/bin/env node
/**
 * Create SQLite Database from JSON Backup
 * 
 * Creates a fresh framerr.db file from the JSON files in docs/dbmigration/temp/
 * Output: docs/dbmigration/output/framerr.db
 * 
 * Usage: node server/scripts/create-db-from-json.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Paths
const BACKUP_DIR = path.join(__dirname, '../../docs/dbmigration/temp');
const OUTPUT_DIR = path.join(__dirname, '../../docs/dbmigration/output');
const OUTPUT_DB = path.join(OUTPUT_DIR, 'framerr.db');
const SCHEMA_FILE = path.join(__dirname, '../database/schema.sql');

console.log('═══════════════════════════════════════════════════');
console.log('  Create Framerr SQLite Database from JSON');
console.log('═══════════════════════════════════════════════════\n');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Delete existing database if exists
if (fs.existsSync(OUTPUT_DB)) {
    fs.unlinkSync(OUTPUT_DB);
    console.log('[1/6] Deleted existing database');
} else {
    console.log('[1/6] No existing database');
}

// Read source files
console.log('[2/6] Reading JSON source files...');
const users = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'users.json'), 'utf8'));
const systemConfig = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'config.json'), 'utf8'));
const customIcons = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'custom-icons.json'), 'utf8'));

// Read user configs
const userConfigs = {};
const usersDir = path.join(BACKUP_DIR, 'users');
if (fs.existsSync(usersDir)) {
    for (const file of fs.readdirSync(usersDir)) {
        if (file.endsWith('.json')) {
            const userId = file.replace('.json', '');
            userConfigs[userId] = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
        }
    }
}

console.log(`  - ${users.users.length} users`);
console.log(`  - ${users.sessions.length} sessions (will skip expired)`);
console.log(`  - ${Object.keys(userConfigs).length} user configs`);
console.log(`  - ${customIcons.icons.length} custom icons`);

// Create database
console.log('\n[3/6] Creating database and initializing schema...');
const db = new Database(OUTPUT_DB);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Load and execute schema
const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
db.exec(schema);
console.log('  ✓ Schema initialized');

// Migrate users
console.log('\n[4/6] Migrating users...');
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
        console.log(`  ✓ User: ${user.username} (${user.group})`);
    }
});
migrateUsers();

// Skip expired sessions, only keep recent ones
console.log('\n[5/6] Migrating active sessions...');
const now = Date.now();
const activeSessions = users.sessions.filter(s => new Date(s.expiresAt).getTime() > now);
console.log(`  - ${activeSessions.length} active sessions (skipping ${users.sessions.length - activeSessions.length} expired)`);

if (activeSessions.length > 0) {
    const insertSession = db.prepare(`
        INSERT INTO sessions (token, user_id, ip_address, user_agent, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const migrateSessions = db.transaction(() => {
        for (const session of activeSessions) {
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
    console.log(`  ✓ Migrated ${activeSessions.length} sessions`);
} else {
    console.log('  - No active sessions to migrate');
}

// Migrate user configs
console.log('\n[6/6] Migrating user configurations...');
const insertConfig = db.prepare(`
    INSERT INTO user_preferences (user_id, dashboard_config, tabs, theme_config, sidebar_config, preferences)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const [userId, config] of Object.entries(userConfigs)) {
    const dashboardConfig = config.dashboard || { widgets: [] };
    const tabs = config.tabs || [];
    const themeConfig = config.theme || { mode: 'system', primaryColor: '#3b82f6' };
    const sidebarConfig = config.sidebar || { collapsed: false };
    const preferences = {
        ...config.preferences,
        ui: config.ui
    };

    insertConfig.run(
        userId,
        JSON.stringify(dashboardConfig),
        JSON.stringify(tabs),
        JSON.stringify(themeConfig),
        JSON.stringify(sidebarConfig),
        JSON.stringify(preferences)
    );

    console.log(`  ✓ Config for user ${userId.substring(0, 8)}...`);
    console.log(`    - ${dashboardConfig.widgets?.length || 0} widgets`);
    console.log(`    - ${tabs.length} tabs`);
}

// Migrate system config
console.log('\n[7/7] Migrating system configuration...');
const upsertConfig = db.prepare(`
    INSERT INTO system_config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const migrateSystemConfig = db.transaction(() => {
    if (systemConfig.server) {
        upsertConfig.run('server', JSON.stringify(systemConfig.server));
    }
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
    if (systemConfig.integrations) {
        upsertConfig.run('integrations', JSON.stringify(systemConfig.integrations));
    }
    if (systemConfig.groups) {
        upsertConfig.run('groups', JSON.stringify(systemConfig.groups));
    }
    if (systemConfig.defaultGroup) {
        upsertConfig.run('defaultGroup', JSON.stringify(systemConfig.defaultGroup));
    }
    if (systemConfig.tabGroups) {
        upsertConfig.run('tabGroups', JSON.stringify(systemConfig.tabGroups));
    }
    if (systemConfig.debug) {
        upsertConfig.run('debug', JSON.stringify(systemConfig.debug));
    }
    if (systemConfig.favicon) {
        upsertConfig.run('favicon', JSON.stringify(systemConfig.favicon));
    }
});
migrateSystemConfig();
console.log('  ✓ System config migrated');

// Migrate custom icons
if (customIcons.icons.length > 0) {
    console.log('\n[ICONS] Migrating custom icons...');
    const insertIcon = db.prepare(`
        INSERT INTO custom_icons (id, name, file_path, mime_type, uploaded_by, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const icon of customIcons.icons) {
        insertIcon.run(
            icon.id,
            icon.originalName,
            icon.filename,
            icon.mimeType,
            icon.uploadedBy,
            Math.floor(new Date(icon.uploadedAt).getTime() / 1000)
        );
        console.log(`  ✓ Icon: ${icon.originalName}`);
    }
}

// Verification
console.log('\n═══════════════════════════════════════════════════');
console.log('  Verification');
console.log('═══════════════════════════════════════════════════');

const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    sessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    userPrefs: db.prepare('SELECT COUNT(*) as c FROM user_preferences').get().c,
    systemConfig: db.prepare('SELECT COUNT(*) as c FROM system_config').get().c,
    customIcons: db.prepare('SELECT COUNT(*) as c FROM custom_icons').get().c
};

console.log(`Users: ${stats.users}`);
console.log(`Sessions: ${stats.sessions}`);
console.log(`User Preferences: ${stats.userPrefs}`);
console.log(`System Config Keys: ${stats.systemConfig}`);
console.log(`Custom Icons: ${stats.customIcons}`);

db.close();

console.log('\n═══════════════════════════════════════════════════');
console.log('  ✅ Database Created Successfully!');
console.log('═══════════════════════════════════════════════════');
console.log(`\nOutput: ${OUTPUT_DB}`);
console.log('\nNext steps:');
console.log('  1. Copy to Docker: docker cp docs/dbmigration/output/framerr.db framerr:/config/');
console.log('  2. Also copy custom-icons folder if needed');
console.log('  3. Restart container: docker restart framerr');
console.log('');
