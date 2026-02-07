/**
 * Migration 0001: Initial Schema
 * 
 * Creates the base 8 tables for a fresh Framerr installation.
 * This replaces the old schema.sql approach - fresh databases now run all migrations.
 * 
 * Tables created:
 * - users (accounts with authentication)
 * - sessions (active login sessions)
 * - user_preferences (dashboard config, tabs, themes)
 * - tab_groups (tab organization)
 * - notifications (user notifications)
 * - integrations (service configurations)
 * - system_config (key-value system settings)
 * - custom_icons (uploaded icons - WITHOUT is_system column, added in migration 4)
 * 
 * NOTE: linked_accounts and push_subscriptions are created in migrations 2 and 3.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 1,
    name: 'initial_schema',

    /**
     * Up migration - creates base schema tables
     */
    up(db) {
        // TABLE 1: users
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                group_id TEXT NOT NULL DEFAULT 'user',
                is_setup_admin INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                last_login INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
        `);

        // TABLE 2: sessions
        db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                expires_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        `);

        // TABLE 3: user_preferences
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY,
                dashboard_config TEXT DEFAULT '{"widgets":[]}',
                tabs TEXT DEFAULT '[]',
                theme_config TEXT DEFAULT '{"mode":"system","primaryColor":"#3b82f6"}',
                sidebar_config TEXT DEFAULT '{"collapsed":false}',
                preferences TEXT DEFAULT '{"dashboardGreeting":{"enabled":true,"text":"Your personal dashboard"}}',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // TABLE 4: tab_groups
        db.exec(`
            CREATE TABLE IF NOT EXISTS tab_groups (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                icon TEXT,
                tabs TEXT DEFAULT '[]',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_tab_groups_user_id ON tab_groups(user_id);
        `);

        // TABLE 5: notifications
        db.exec(`
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                type TEXT DEFAULT 'info',
                read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
        `);

        // TABLE 6: integrations
        db.exec(`
            CREATE TABLE IF NOT EXISTS integrations (
                service_name TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                url TEXT,
                api_key TEXT,
                settings TEXT DEFAULT '{}',
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );
        `);

        // TABLE 7: system_config with seed data
        db.exec(`
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );
            
            INSERT OR IGNORE INTO system_config (key, value) VALUES 
                ('groups', '{"admin":{"name":"Admin","permissions":["manage_users","manage_groups","manage_system","view_tabs","manage_tabs","view_widgets","manage_widgets","view_integrations","manage_integrations"]},"user":{"name":"User","permissions":["view_tabs","manage_tabs","view_widgets","manage_widgets"]}}'),
                ('appName', '"Framerr"'),
                ('appIcon', '""'),
                ('proxyAuth', '{"enabled":false,"headerName":"Remote-User","headerGroups":"Remote-Groups","autoCreateUsers":false,"defaultGroup":"user","trustedProxies":""}'),
                ('faviconSettings', '{"enabled":false,"htmlSnippet":""}');
        `);

        // TABLE 8: custom_icons (WITHOUT is_system column - added in migration 4)
        db.exec(`
            CREATE TABLE IF NOT EXISTS custom_icons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_by TEXT,
                uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_custom_icons_uploaded_by ON custom_icons(uploaded_by);
        `);

        // TRIGGERS for timestamp updates
        db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
            AFTER UPDATE ON user_preferences
            BEGIN
                UPDATE user_preferences SET updated_at = strftime('%s', 'now') WHERE user_id = NEW.user_id;
            END;
            
            CREATE TRIGGER IF NOT EXISTS update_integrations_timestamp 
            AFTER UPDATE ON integrations
            BEGIN
                UPDATE integrations SET updated_at = strftime('%s', 'now') WHERE service_name = NEW.service_name;
            END;
            
            CREATE TRIGGER IF NOT EXISTS update_system_config_timestamp 
            AFTER UPDATE ON system_config
            BEGIN
                UPDATE system_config SET updated_at = strftime('%s', 'now') WHERE key = NEW.key;
            END;
        `);

        logger.debug('[Migration 0001] Initial schema created (8 tables, 3 triggers)');
    },

    /**
     * Down migration - not supported for initial schema
     */
    down(db) {
        throw new Error('Cannot rollback initial schema - restore from backup instead');
    }
};
