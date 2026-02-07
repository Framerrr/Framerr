/**
 * Migration: Add template tables
 * Purpose: Dashboard template system - templates, categories, shares, backups
 * Version: 7
 */
module.exports = {
    version: 7,
    name: 'add_templates',
    up(db) {
        db.exec(`
            -- ============================================================================
            -- TABLE: template_categories
            -- Admin-managed categories for organizing templates
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS template_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_by TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_template_categories_name ON template_categories(name);

            -- ============================================================================
            -- TABLE: dashboard_templates
            -- Stores dashboard templates with widget layouts
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS dashboard_templates (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                category_id TEXT,
                widgets TEXT NOT NULL DEFAULT '[]',
                thumbnail TEXT,
                is_draft INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                shared_from_id TEXT,
                user_modified INTEGER DEFAULT 0,
                version INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE SET NULL,
                FOREIGN KEY (shared_from_id) REFERENCES dashboard_templates(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_templates_owner ON dashboard_templates(owner_id);
            CREATE INDEX IF NOT EXISTS idx_templates_category ON dashboard_templates(category_id);
            CREATE INDEX IF NOT EXISTS idx_templates_shared_from ON dashboard_templates(shared_from_id);
            CREATE INDEX IF NOT EXISTS idx_templates_is_draft ON dashboard_templates(is_draft);
            CREATE INDEX IF NOT EXISTS idx_templates_is_default ON dashboard_templates(is_default);

            -- ============================================================================
            -- TABLE: template_shares
            -- Many-to-many relationship for template sharing
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS template_shares (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                shared_with TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (template_id) REFERENCES dashboard_templates(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_template_shares_template ON template_shares(template_id);
            CREATE INDEX IF NOT EXISTS idx_template_shares_user ON template_shares(shared_with);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_template_shares_unique ON template_shares(template_id, shared_with);

            -- ============================================================================
            -- TABLE: dashboard_backups
            -- Single backup per user for revert functionality
            -- ============================================================================
            CREATE TABLE IF NOT EXISTS dashboard_backups (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                widgets TEXT NOT NULL,
                mobile_layout_mode TEXT DEFAULT 'linked',
                mobile_widgets TEXT,
                backed_up_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_backups_user ON dashboard_backups(user_id);

            -- ============================================================================
            -- TRIGGER: Update template timestamps
            -- ============================================================================
            CREATE TRIGGER IF NOT EXISTS update_dashboard_templates_timestamp 
            AFTER UPDATE ON dashboard_templates
            BEGIN
                UPDATE dashboard_templates SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
            END;
        `);
    }
};
