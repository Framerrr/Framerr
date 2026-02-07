/**
 * Migration: Add linked_accounts table
 * Purpose: Store user's linked external accounts (Plex, Overseerr, etc.)
 * Version: 2
 */
module.exports = {
    version: 2,
    name: 'add_linked_accounts',
    up(db) {
        db.exec(`
            -- ============================================================================
            -- TABLE: linked_accounts
            -- Stores user's linked external service accounts
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS linked_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                service TEXT NOT NULL,
                external_id TEXT NOT NULL,
                external_username TEXT,
                external_email TEXT,
                metadata TEXT DEFAULT '{}',
                linked_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON linked_accounts(user_id);
            CREATE INDEX IF NOT EXISTS idx_linked_accounts_service ON linked_accounts(service);
            CREATE INDEX IF NOT EXISTS idx_linked_accounts_external_id ON linked_accounts(external_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_accounts_user_service ON linked_accounts(user_id, service);
        `);
    }
};
