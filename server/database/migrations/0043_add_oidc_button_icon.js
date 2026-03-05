/**
 * Migration 0043: Add button_icon to OIDC config
 *
 * Allows admins to choose a custom icon for the OIDC login button.
 * Uses the same icon identifiers as the IconPicker (e.g., "Shield", "system:authentik", "custom:abc123").
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 43,
    name: 'add_oidc_button_icon',

    up(db) {
        db.exec(`
            ALTER TABLE oidc_config ADD COLUMN button_icon TEXT NOT NULL DEFAULT 'KeyRound';
        `);
        logger.debug('[Migration 0043] Added button_icon column to oidc_config');
    }
};
