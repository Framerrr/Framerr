/**
 * Migration 0045: Add backup_encryption table
 *
 * Creates a singleton table for storing the Master Backup Key (MBK)
 * wrapped two ways: by password-derived KEK and by server key.
 * 
 * The MBK enables envelope encryption:
 *   Password → KEK → wraps MBK → MBK wraps per-backup DEK → DEK encrypts payload
 *
 * Single-row design (id = 1 CHECK constraint) matches oidc_config pattern.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 45,
    name: 'backup_encryption',

    up(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS backup_encryption (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                enabled         INTEGER DEFAULT 0,
                mbk_password    TEXT NOT NULL,
                mbk_server      TEXT NOT NULL,
                kek_salt        TEXT NOT NULL,
                kdf_iterations  INTEGER DEFAULT 600000,
                created_at      TEXT DEFAULT (datetime('now')),
                updated_at      TEXT DEFAULT (datetime('now'))
            );
        `);

        logger.debug('[Migration 0045] Created backup_encryption table');
    }
};
