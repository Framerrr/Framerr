/**
 * Migration: Add service monitoring tables
 * Purpose: Infrastructure for First-Party and Uptime Kuma monitoring
 * Version: 10
 * 
 * Tables:
 * - service_monitors: Monitor definitions
 * - service_monitor_shares: Per-monitor sharing
 * - service_monitor_history: Check history
 * - service_monitor_aggregates: Hourly uptime rollups
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 10,
    name: 'add_service_monitors',
    up(db) {
        db.exec(`
            -- ============================================================================
            -- TABLE: service_monitors
            -- Monitor definitions (First-Party and Uptime Kuma linked)
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS service_monitors (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,                    -- User who created/imported the monitor
                name TEXT NOT NULL,                        -- Display name
                icon_id TEXT,                              -- Reference to custom_icons (IconPicker)
                type TEXT NOT NULL DEFAULT 'http',         -- 'http', 'tcp', 'ping'
                url TEXT,                                  -- Target URL (HTTP) or hostname (TCP/ping)
                port INTEGER,                              -- For TCP monitors
                interval_seconds INTEGER DEFAULT 60,       -- Check interval
                timeout_seconds INTEGER DEFAULT 10,        -- Timeout per check
                retries INTEGER DEFAULT 3,                 -- Retries before DOWN
                degraded_threshold_ms INTEGER DEFAULT 2000,-- Response time threshold for degraded
                expected_status_codes TEXT DEFAULT '["200-299"]', -- JSON array
                enabled INTEGER DEFAULT 1,                 -- Is monitor active
                maintenance INTEGER DEFAULT 0,             -- Maintenance mode (suppress alerts)
                uptime_kuma_id INTEGER,                    -- For UK-linked monitors (NULL = first-party)
                order_index INTEGER DEFAULT 0,             -- For drag-and-drop ordering
                notify_down INTEGER DEFAULT 1,             -- Notify on DOWN
                notify_up INTEGER DEFAULT 1,               -- Notify on recovery
                notify_degraded INTEGER DEFAULT 0,         -- Notify on degraded
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (icon_id) REFERENCES custom_icons(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_service_monitors_owner ON service_monitors(owner_id);
            CREATE INDEX IF NOT EXISTS idx_service_monitors_enabled ON service_monitors(enabled);
            CREATE INDEX IF NOT EXISTS idx_service_monitors_uk_id ON service_monitors(uptime_kuma_id);

            -- ============================================================================
            -- TABLE: service_monitor_shares
            -- Per-monitor sharing (subset of users with integration access)
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS service_monitor_shares (
                id TEXT PRIMARY KEY,
                monitor_id TEXT NOT NULL,
                user_id TEXT NOT NULL,                     -- User who can view this monitor
                notify INTEGER DEFAULT 0,                  -- Whether to send notifications to this user
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (monitor_id) REFERENCES service_monitors(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_monitor_shares_monitor ON service_monitor_shares(monitor_id);
            CREATE INDEX IF NOT EXISTS idx_monitor_shares_user ON service_monitor_shares(user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_shares_unique ON service_monitor_shares(monitor_id, user_id);

            -- ============================================================================
            -- TABLE: service_monitor_history
            -- Individual check results (pruned periodically)
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS service_monitor_history (
                id TEXT PRIMARY KEY,
                monitor_id TEXT NOT NULL,
                status TEXT NOT NULL,                      -- 'up', 'down', 'degraded'
                response_time_ms INTEGER,                  -- Response time in ms (NULL if timeout)
                status_code INTEGER,                       -- HTTP status code (NULL for TCP/ping)
                error_message TEXT,                        -- Error message if failed
                checked_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (monitor_id) REFERENCES service_monitors(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_monitor_history_monitor ON service_monitor_history(monitor_id);
            CREATE INDEX IF NOT EXISTS idx_monitor_history_checked ON service_monitor_history(checked_at);
            -- Composite index for recent checks query
            CREATE INDEX IF NOT EXISTS idx_monitor_history_recent ON service_monitor_history(monitor_id, checked_at DESC);

            -- ============================================================================
            -- TABLE: service_monitor_aggregates
            -- Hourly uptime rollups for tick-bar visualization
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS service_monitor_aggregates (
                id TEXT PRIMARY KEY,
                monitor_id TEXT NOT NULL,
                hour_start INTEGER NOT NULL,               -- Unix timestamp of hour start
                checks_total INTEGER DEFAULT 0,            -- Total checks in this hour
                checks_up INTEGER DEFAULT 0,               -- Checks with UP status
                checks_degraded INTEGER DEFAULT 0,         -- Checks with DEGRADED status
                checks_down INTEGER DEFAULT 0,             -- Checks with DOWN status
                avg_response_ms INTEGER,                   -- Average response time
                FOREIGN KEY (monitor_id) REFERENCES service_monitors(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_monitor_aggregates_monitor ON service_monitor_aggregates(monitor_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_aggregates_unique ON service_monitor_aggregates(monitor_id, hour_start);

            -- ============================================================================
            -- TRIGGER: Update service_monitors.updated_at on change
            -- ============================================================================
            CREATE TRIGGER IF NOT EXISTS update_service_monitors_timestamp 
            AFTER UPDATE ON service_monitors
            BEGIN
                UPDATE service_monitors SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
            END;
        `);

        logger.debug('[Migration 0010] Created service monitoring tables: service_monitors, service_monitor_shares, service_monitor_history, service_monitor_aggregates');
    }
};
