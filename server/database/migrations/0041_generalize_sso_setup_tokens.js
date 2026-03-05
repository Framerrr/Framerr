/**
 * Migration 0041: Generalize SSO setup tokens
 *
 * Renames plex_setup_tokens → sso_setup_tokens and generalizes columns
 * to support any SSO provider (Plex, OIDC, etc.)
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 41,
    name: 'generalize_sso_setup_tokens',

    up(db) {
        // Rename table
        db.exec(`ALTER TABLE plex_setup_tokens RENAME TO sso_setup_tokens;`);

        // Add provider column (default 'plex' for existing rows)
        db.exec(`ALTER TABLE sso_setup_tokens ADD COLUMN provider TEXT NOT NULL DEFAULT 'plex';`);

        // Rename plex-specific columns to generic names
        db.exec(`ALTER TABLE sso_setup_tokens RENAME COLUMN plex_id TO external_id;`);
        db.exec(`ALTER TABLE sso_setup_tokens RENAME COLUMN plex_username TO external_username;`);
        db.exec(`ALTER TABLE sso_setup_tokens RENAME COLUMN plex_email TO external_email;`);
        db.exec(`ALTER TABLE sso_setup_tokens RENAME COLUMN plex_thumb TO external_avatar;`);

        logger.debug('[Migration 0041] Generalized plex_setup_tokens → sso_setup_tokens');
    }
};
