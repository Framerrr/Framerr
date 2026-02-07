/**
 * Migration: Add mobile layout fields to dashboard_templates
 * Purpose: Support independent mobile layouts in template builder
 * Version: 9
 * 
 * Adds mobile_layout_mode and mobile_widgets columns for template builder
 * mobile layout independence parity with Dashboard.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 9,
    name: 'add_template_mobile_layout',
    up(db) {
        // Check if columns already exist (idempotent migration)
        const tableInfo = db.prepare('PRAGMA table_info(dashboard_templates)').all();
        const hasMode = tableInfo.some(col => col.name === 'mobile_layout_mode');
        const hasWidgets = tableInfo.some(col => col.name === 'mobile_widgets');

        if (!hasMode) {
            db.exec(`
                ALTER TABLE dashboard_templates 
                ADD COLUMN mobile_layout_mode TEXT DEFAULT 'linked';
            `);
            logger.debug('[Migration 0009] Added mobile_layout_mode column');
        }

        if (!hasWidgets) {
            db.exec(`
                ALTER TABLE dashboard_templates 
                ADD COLUMN mobile_widgets TEXT DEFAULT NULL;
            `);
            logger.debug('[Migration 0009] Added mobile_widgets column');
        }

        if (hasMode && hasWidgets) {
            logger.debug('[Migration 0009] mobile_layout_mode and mobile_widgets columns already exist');
        }
    }
};
