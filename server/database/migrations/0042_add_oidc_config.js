/**
 * Migration 0042: Add OIDC configuration table
 *
 * Creates singleton oidc_config table for OpenID Connect SSO settings.
 * Client secret is stored encrypted via the encryption utility.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 42,
    name: 'add_oidc_config',

    up(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS oidc_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER NOT NULL DEFAULT 0,
                issuer_url TEXT NOT NULL DEFAULT '',
                client_id TEXT NOT NULL DEFAULT '',
                client_secret TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL DEFAULT 'SSO',
                scopes TEXT NOT NULL DEFAULT 'openid email profile',
                auto_create_users INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        // Insert default disabled row
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
            INSERT OR IGNORE INTO oidc_config (id, enabled, created_at, updated_at)
            VALUES (1, 0, ?, ?)
        `).run(now, now);

        logger.debug('[Migration 0042] Created oidc_config table');
    }
};
