/**
 * Migration 0037: Add require_password_reset column
 *
 * Supports admin/CLI password reset flow that forces users
 * to change their password on next login.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 37,
    name: 'add_require_password_reset',

    up(db) {
        db.exec(`
            ALTER TABLE users ADD COLUMN require_password_reset INTEGER DEFAULT 0;
        `);

        logger.debug('[Migration 0037] Added require_password_reset column to users table');
    }
};
