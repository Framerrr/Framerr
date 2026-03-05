/**
 * Migration 0044: Enforce external identity uniqueness
 *
 * Adds UNIQUE INDEX on linked_accounts(service, external_id) to prevent
 * the same IdP identity from being linked to multiple Framerr users.
 *
 * Previously only (user_id, service) was unique — meaning one user can have
 * one link per service, but the same external_id could appear on multiple users
 * in a race condition. This migration closes that gap.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 44,
    name: 'enforce_external_id_uniqueness',

    up(db) {
        // First, check for any existing duplicates (shouldn't exist, but safety first)
        const duplicates = db.prepare(`
            SELECT service, external_id, COUNT(*) as cnt
            FROM linked_accounts
            GROUP BY service, external_id
            HAVING cnt > 1
        `).all();

        if (duplicates.length > 0) {
            logger.warn(`[Migration 0044] Found ${duplicates.length} duplicate external_id(s), cleaning up (keeping newest)`);

            for (const dup of duplicates) {
                // Keep the newest link (highest linked_at), remove older ones
                db.prepare(`
                    DELETE FROM linked_accounts
                    WHERE service = ? AND external_id = ?
                    AND rowid NOT IN (
                        SELECT rowid FROM linked_accounts
                        WHERE service = ? AND external_id = ?
                        ORDER BY linked_at DESC
                        LIMIT 1
                    )
                `).run(dup.service, dup.external_id, dup.service, dup.external_id);
            }
        }

        // Now safe to add the unique index
        db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_accounts_service_external_id
            ON linked_accounts(service, external_id);
        `);

        logger.debug('[Migration 0044] Added unique index on linked_accounts(service, external_id)');
    }
};
