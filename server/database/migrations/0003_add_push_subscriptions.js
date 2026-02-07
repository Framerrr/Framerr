/**
 * Migration: Add push_subscriptions table
 * Version: 3
 * 
 * Stores Web Push notification subscriptions for each user.
 * One user can have multiple subscriptions (multiple devices/browsers).
 */

module.exports = {
    version: 3,
    name: 'add_push_subscriptions',
    up(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                device_name TEXT,
                last_used INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
        `);
    }
};
