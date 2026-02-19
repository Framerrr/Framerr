/**
 * Migration: Drop old integration_name-based unique constraint
 * Purpose: Fix bug where INSERT OR REPLACE deletes shares for same integration TYPE
 * Version: 29
 * 
 * ROOT CAUSE: Migration 0008 created a unique constraint on (integration_name, share_type, share_target).
 * Migration 0026 added a new constraint on (integration_instance_id, share_type, share_target) but did NOT
 * drop the old one. When sharing two instances of the same type with the same user:
 *   - First: INSERT (uptimekuma, uptimekuma-123, user, userA) → OK
 *   - Second: INSERT (uptimekuma, uptimekuma-456, user, userA) → REPLACES first due to old constraint!
 * 
 * FIX: Drop the old idx_integration_shares_unique constraint.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 29,
    name: 'drop_old_integration_shares_unique',
    up(db) {
        logger.debug('[Migration 0029] Dropping old integration_name-based unique constraint...');

        // SQLite doesn't support DROP INDEX IF EXISTS directly in some versions,
        // so we'll try-catch it
        try {
            db.exec(`DROP INDEX idx_integration_shares_unique;`);
            logger.debug('[Migration 0029] Dropped idx_integration_shares_unique');
        } catch (error) {
            // Index might not exist (already dropped or never applied)
            logger.debug(`[Migration 0029] Index may not exist: ${error.message}`);
        }

        logger.debug('[Migration 0029] Complete: Old constraint removed, instance-based sharing now works correctly');
    }
};
