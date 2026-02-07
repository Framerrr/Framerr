#!/usr/bin/env node
/**
 * Framerr JSON to SQLite Migration Script
 * 
 * Migrates all data from JSON files to SQLite database.
 * Preserves all user data: accounts, configs, tabs, widgets, notifications.
 * 
 * Usage:
 *   node server/scripts/migrate-to-sqlite.js [--dry-run]
 * 
 * Flags:
 *   --dry-run    Preview migration without making changes
 */

const fs = require('fs');
const path = require('path');
const { db, initializeSchema, isInitialized } = require('../database/db');

// Determine data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// JSON file paths
const JSON_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    systemConfig: path.join(DATA_DIR, 'config.json'),
    userConfigs: path.join(DATA_DIR, 'user-configs'),
    notifications: path.join(DATA_DIR, 'notifications.json'),
    customIcons: path.join(DATA_DIR, 'custom-icons.json')
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

/**
 * Read JSON file safely
 */
function readJSONFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[ERROR] Failed to read ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Validate migration source data
 */
function validateSourceData() {
    console.log('\n[VALIDATE] Checking JSON source files...');

    const checks = {
        users: fs.existsSync(JSON_FILES.users),
        systemConfig: fs.existsSync(JSON_FILES.systemConfig),
        userConfigs: fs.existsSync(JSON_FILES.userConfigs),
        notifications: fs.existsSync(JSON_FILES.notifications)
    };

    console.log('  users.json:', checks.users ? '✓' : '✗');
    console.log('  config.json:', checks.systemConfig ? '✓' : '✗');
    console.log('  user-configs/:', checks.userConfigs ? '✓' : '✗');
    console.log('  notifications.json:', checks.notifications ? '✓' : '✗');

    return checks;
}

/**
 * Migrate users and sessions
 */
function migrateUsers() {
    console.log('\n[MIGRATE] Users and sessions...');

    const usersData = readJSONFile(JSON_FILES.users);
    if (!usersData) {
        console.log('  No users.json found, skipping');
        return { users: 0, sessions: 0 };
    }

    const { users = [], sessions = [] } = usersData;

    if (isDryRun) {
        console.log(`  Would migrate ${users.length} users`);
        console.log(`  Would migrate ${sessions.length} sessions`);
        return { users: users.length, sessions: sessions.length };
    }

    // Migrate users
    const insertUser = db.prepare(`
        INSERT INTO users (id, username, password, email, group_id, is_setup_admin, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrateUsersTransaction = db.transaction(() => {
        for (const user of users) {
            // Handle NULL passwords (proxy auth users) by providing placeholder
            const password = user.password || '*PROXY_AUTH*';

            insertUser.run(
                user.id,
                user.username,
                password,
                user.email || null,
                user.groupId || user.group || 'user',
                user.isSetupAdmin ? 1 : 0,
                Math.floor(new Date(user.createdAt).getTime() / 1000),
                user.lastLogin ? Math.floor(new Date(user.lastLogin).getTime() / 1000) : null
            );
        }
    });

    migrateUsersTransaction();
    console.log(`  ✓ Migrated ${users.length} users`);

    // Migrate sessions
    if (sessions.length > 0) {
        const insertSession = db.prepare(`
            INSERT INTO sessions (token, user_id, ip_address, user_agent, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const migrateSessionsTransaction = db.transaction(() => {
            for (const session of sessions) {
                insertSession.run(
                    session.token,
                    session.userId,
                    session.ipAddress || null,
                    session.userAgent || null,
                    Math.floor(new Date(session.createdAt).getTime() / 1000),
                    Math.floor(new Date(session.expiresAt).getTime() / 1000)
                );
            }
        });

        migrateSessionsTransaction();
        console.log(`  ✓ Migrated ${sessions.length} sessions`);
    }

    return { users: users.length, sessions: sessions.length };
}

/**
 * Migrate user configurations
 */
function migrateUserConfigs() {
    console.log('\n[MIGRATE] User configurations...');

    if (!fs.existsSync(JSON_FILES.userConfigs)) {
        console.log('  No user-configs directory found, skipping');
        return 0;
    }

    const configFiles = fs.readdirSync(JSON_FILES.userConfigs)
        .filter(f => f.endsWith('.json'));

    if (isDryRun) {
        console.log(`  Would migrate ${configFiles.length} user configs`);
        return configFiles.length;
    }

    const insertConfig = db.prepare(`
        INSERT INTO user_preferences (user_id, dashboard_config, tabs, theme_config, sidebar_config, preferences)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const migrateConfigsTransaction = db.transaction(() => {
        for (const file of configFiles) {
            const userId = file.replace('.json', '');
            const configPath = path.join(JSON_FILES.userConfigs, file);
            const config = readJSONFile(configPath);

            if (config) {
                // Map old JSON structure to new schema columns
                const dashboardConfig = config.dashboard || { widgets: [] };
                const themeConfig = config.theme ?
                    (typeof config.theme === 'string' ? { mode: config.theme, primaryColor: '#3b82f6' } : config.theme)
                    : { mode: 'system', primaryColor: '#3b82f6' };
                const sidebarConfig = config.sidebar || { collapsed: false };
                const preferences = config.preferences || { dashboardGreeting: { enabled: true, text: 'Your personal dashboard' } };

                insertConfig.run(
                    userId,
                    JSON.stringify(dashboardConfig),
                    JSON.stringify(config.tabs || []),
                    JSON.stringify(themeConfig),
                    JSON.stringify(sidebarConfig),
                    JSON.stringify(preferences)
                );
            }
        }
    });

    migrateConfigsTransaction();
    console.log(`  ✓ Migrated ${configFiles.length} user configurations`);

    return configFiles.length;
}

/**
 * Migrate system configuration
 */
function migrateSystemConfig() {
    console.log('\n[MIGRATE] System configuration...');

    const configData = readJSONFile(JSON_FILES.systemConfig);
    if (!configData) {
        console.log('  No config.json found, using defaults');
        return 0;
    }

    if (isDryRun) {
        const keys = Object.keys(configData);
        console.log(`  Would migrate ${keys.length} config sections`);
        return keys.length;
    }

    const upsertConfig = db.prepare(`
        INSERT INTO system_config (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const migrateConfigTransaction = db.transaction(() => {
        // Migrate each top-level config section as a key-value pair
        if (configData.server) {
            upsertConfig.run('server', JSON.stringify(configData.server));
        }
        if (configData.auth?.local) {
            upsertConfig.run('auth.local', JSON.stringify(configData.auth.local));
        }
        if (configData.auth?.proxy) {
            upsertConfig.run('auth.proxy', JSON.stringify(configData.auth.proxy));
        }
        if (configData.auth?.iframe) {
            upsertConfig.run('auth.iframe', JSON.stringify(configData.auth.iframe));
        }
        if (configData.auth?.session) {
            upsertConfig.run('auth.session', JSON.stringify(configData.auth.session));
        }
        if (configData.integrations) {
            upsertConfig.run('integrations', JSON.stringify(configData.integrations));
        }
        if (configData.groups) {
            upsertConfig.run('groups', JSON.stringify(configData.groups));
        }
        if (configData.defaultGroup) {
            upsertConfig.run('defaultGroup', JSON.stringify(configData.defaultGroup));
        }
        if (configData.tabGroups) {
            upsertConfig.run('tabGroups', JSON.stringify(configData.tabGroups));
        }
        if (configData.debug) {
            upsertConfig.run('debug', JSON.stringify(configData.debug));
        }
        if (configData.favicon !== undefined) {
            upsertConfig.run('favicon', JSON.stringify(configData.favicon));
        }
    });

    migrateConfigTransaction();
    console.log('  ✓ Migrated system configuration');

    return 1;
}

/**
 * Migrate notifications
 */
function migrateNotifications() {
    console.log('\n[MIGRATE] Notifications...');

    const notifData = readJSONFile(JSON_FILES.notifications);
    if (!notifData) {
        console.log('  No notifications.json found, skipping');
        return 0;
    }

    const notifications = notifData.notifications || [];

    if (isDryRun) {
        console.log(`  Would migrate ${notifications.length} notifications`);
        return notifications.length;
    }

    if (notifications.length === 0) {
        console.log('  No notifications to migrate');
        return 0;
    }

    const insertNotif = db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const migrateNotifsTransaction = db.transaction(() => {
        for (const notif of notifications) {
            insertNotif.run(
                notif.id,
                notif.userId,
                notif.title,
                notif.message || null,
                notif.type || 'info',
                notif.read ? 1 : 0,
                Math.floor(new Date(notif.createdAt).getTime() / 1000)
            );
        }
    });

    migrateNotifsTransaction();
    console.log(`  ✓ Migrated ${notifications.length} notifications`);

    return notifications.length;
}

/**
 * Verify migrated data integrity
 */
function verifyMigration(stats) {
    console.log('\n[VERIFY] Data integrity...');

    if (isDryRun) {
        console.log('  Skipping verification (dry run)');
        return true;
    }

    // Verify user count
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    console.log(`  Users in database: ${userCount} (expected: ${stats.users})`);

    // Verify session count
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    console.log(`  Sessions in database: ${sessionCount} (expected: ${stats.sessions})`);

    // Verify config count
    const configCount = db.prepare('SELECT COUNT(*) as count FROM user_preferences').get().count;
    console.log(`  User configs in database: ${configCount} (expected: ${stats.configs})`);

    // Verify notification count
    const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
    console.log(`  Notifications in database: ${notifCount} (expected: ${stats.notifications})`);

    const allMatch = (
        userCount === stats.users &&
        sessionCount === stats.sessions &&
        configCount === stats.configs &&
        notifCount === stats.notifications
    );

    if (allMatch) {
        console.log('  ✓ All counts match - migration successful');
    } else {
        console.log('  ⚠️  Count mismatch detected - review migration');
    }

    return allMatch;
}

/**
 * Create JSON backups before migration
 */
function createBackups() {
    console.log('\n[BACKUP] Creating JSON backups...');

    const backupDir = path.join(DATA_DIR, 'json-backup-' + Date.now());

    if (isDryRun) {
        console.log(`  Would create backup at: ${backupDir}`);
        return backupDir;
    }

    fs.mkdirSync(backupDir, { recursive: true });

    // Copy JSON files to backup
    if (fs.existsSync(JSON_FILES.users)) {
        fs.copyFileSync(JSON_FILES.users, path.join(backupDir, 'users.json'));
    }
    if (fs.existsSync(JSON_FILES.systemConfig)) {
        fs.copyFileSync(JSON_FILES.systemConfig, path.join(backupDir, 'config.json'));
    }
    if (fs.existsSync(JSON_FILES.notifications)) {
        fs.copyFileSync(JSON_FILES.notifications, path.join(backupDir, 'notifications.json'));
    }

    console.log(`  ✓ Backup created: ${backupDir}`);
    return backupDir;
}

/**
 * Main migration function
 */
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Framerr JSON → SQLite Migration');
    console.log('═══════════════════════════════════════════════════');

    if (isDryRun) {
        console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Step 1: Validate source data
    const checks = validateSourceData();

    // Step 2: Initialize schema if needed
    if (!isDryRun) {
        if (!isInitialized()) {
            console.log('\n[SCHEMA] Database not initialized - creating tables...');
            initializeSchema();
            console.log('  ✓ Schema initialized successfully');
        } else {
            console.log('\n[SCHEMA] Database already initialized');
        }
    } else {
        console.log('\n[SCHEMA] Would initialize database schema if needed');
    }

    // Step 3: Create backups (unless dry run)
    const backupDir = createBackups();

    // Step 4: Migrate data
    const stats = {
        users: 0,
        sessions: 0,
        configs: 0,
        notifications: 0,
        systemConfig: 0
    };

    const userStats = migrateUsers();
    stats.users = userStats.users;
    stats.sessions = userStats.sessions;

    stats.configs = migrateUserConfigs();
    stats.systemConfig = migrateSystemConfig();
    stats.notifications = migrateNotifications();

    // Step 5: Verify migration
    if (!isDryRun) {
        verifyMigration(stats);
    }

    // Step 6: Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Migration Summary');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Users:         ${stats.users}`);
    console.log(`  Sessions:      ${stats.sessions}`);
    console.log(`  User Configs:  ${stats.configs}`);
    console.log(`  System Config: ${stats.systemConfig > 0 ? 'Yes' : 'No'}`);
    console.log(`  Notifications: ${stats.notifications}`);

    if (!isDryRun) {
        console.log(`\n  Backup: ${backupDir}`);
        console.log('\n✓ Migration complete!');
        console.log('\nNext steps:');
        console.log('  1. Test the application with SQLite');
        console.log('  2. If successful, delete JSON files');
        console.log('  3. If issues, restore from backup and report');
    } else {
        console.log('\n✓ Dry run complete - use without --dry-run to migrate');
    }
}

// Run migration
if (require.main === module) {
    main().catch(error => {
        console.error('\n[FATAL] Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

module.exports = { main };

