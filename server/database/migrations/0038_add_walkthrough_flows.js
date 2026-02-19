/**
 * Migration 0038: Add walkthrough_flows column
 *
 * Stores per-flow completion status as JSON.
 * Example: '{"onboarding": true, "whats-new-v2": true}'
 * Supports multiple walkthrough flows without additional migrations.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 38,
    name: 'add_walkthrough_flows',

    up(db) {
        db.exec(`
            ALTER TABLE users ADD COLUMN walkthrough_flows TEXT DEFAULT '{}';
        `);

        logger.debug('[Migration 0038] Added walkthrough_flows column to users table');
    }
};
