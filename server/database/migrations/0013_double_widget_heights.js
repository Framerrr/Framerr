/**
 * Migration: Double widget heights for finer-grained grid sizing
 * Purpose: ROW_HEIGHT changed from 100px to 50px, so all h values must double
 * Version: 13
 * 
 * Affected tables:
 * - user_preferences.dashboard_config (widgets array)
 * - dashboard_templates.widgets
 * - dashboard_templates.mobile_widgets
 * - dashboard_backups.widgets
 * - dashboard_backups.mobile_widgets
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 13,
    name: 'double_widget_heights',

    up(db) {
        logger.debug('[Migration 0013] Doubling widget heights for new row height...');

        /**
         * Helper: Double h values in a widget's layouts
         */
        function doubleWidgetHeights(widget) {
            if (!widget) return widget;

            // Double top-level h if present
            if (typeof widget.h === 'number') {
                widget.h = widget.h * 2;
            }

            // Double layouts.lg.h
            if (widget.layouts?.lg?.h && typeof widget.layouts.lg.h === 'number') {
                widget.layouts.lg.h = widget.layouts.lg.h * 2;
            }

            // Double layouts.sm.h
            if (widget.layouts?.sm?.h && typeof widget.layouts.sm.h === 'number') {
                widget.layouts.sm.h = widget.layouts.sm.h * 2;
            }

            // Double layout.h (for templates that use flat layout)
            if (widget.layout?.h && typeof widget.layout.h === 'number') {
                widget.layout.h = widget.layout.h * 2;
            }

            return widget;
        }

        /**
         * Helper: Process a JSON column containing widgets array
         */
        function processWidgetsColumn(jsonStr) {
            if (!jsonStr) return null;

            try {
                const widgets = JSON.parse(jsonStr);
                if (!Array.isArray(widgets)) return jsonStr;

                const updated = widgets.map(doubleWidgetHeights);
                return JSON.stringify(updated);
            } catch (e) {
                logger.debug('[Migration 0013] Failed to parse widgets JSON:', { error: e.message });
                return jsonStr;
            }
        }

        /**
         * Helper: Process dashboard_config which has { widgets: [...] } structure
         */
        function processDashboardConfig(jsonStr) {
            if (!jsonStr) return null;

            try {
                const config = JSON.parse(jsonStr);
                if (!config.widgets || !Array.isArray(config.widgets)) return jsonStr;

                config.widgets = config.widgets.map(doubleWidgetHeights);
                return JSON.stringify(config);
            } catch (e) {
                logger.debug('[Migration 0013] Failed to parse dashboard_config JSON:', { error: e.message });
                return jsonStr;
            }
        }

        // 1. Migrate user_preferences.dashboard_config
        logger.debug('[Migration 0013] Migrating user_preferences...');
        const userPrefs = db.prepare('SELECT user_id, dashboard_config FROM user_preferences').all();
        const updateUserPref = db.prepare('UPDATE user_preferences SET dashboard_config = ? WHERE user_id = ?');

        let userPrefCount = 0;
        for (const row of userPrefs) {
            const updated = processDashboardConfig(row.dashboard_config);
            if (updated && updated !== row.dashboard_config) {
                updateUserPref.run(updated, row.user_id);
                userPrefCount++;
            }
        }
        logger.debug('[Migration 0013] Updated user preferences', { count: userPrefCount });

        // 2. Migrate dashboard_templates.widgets and dashboard_templates.mobile_widgets
        logger.debug('[Migration 0013] Migrating dashboard_templates...');
        const templates = db.prepare('SELECT id, widgets, mobile_widgets FROM dashboard_templates').all();
        const updateTemplate = db.prepare('UPDATE dashboard_templates SET widgets = ?, mobile_widgets = ? WHERE id = ?');

        let templateCount = 0;
        for (const row of templates) {
            const updatedWidgets = processWidgetsColumn(row.widgets);
            const updatedMobileWidgets = processWidgetsColumn(row.mobile_widgets);

            if ((updatedWidgets && updatedWidgets !== row.widgets) ||
                (updatedMobileWidgets && updatedMobileWidgets !== row.mobile_widgets)) {
                updateTemplate.run(
                    updatedWidgets || row.widgets,
                    updatedMobileWidgets || row.mobile_widgets,
                    row.id
                );
                templateCount++;
            }
        }
        logger.debug('[Migration 0013] Updated templates', { count: templateCount });

        // 3. Migrate dashboard_backups.widgets and dashboard_backups.mobile_widgets
        logger.debug('[Migration 0013] Migrating dashboard_backups...');
        const backups = db.prepare('SELECT id, widgets, mobile_widgets FROM dashboard_backups').all();
        const updateBackup = db.prepare('UPDATE dashboard_backups SET widgets = ?, mobile_widgets = ? WHERE id = ?');

        let backupCount = 0;
        for (const row of backups) {
            const updatedWidgets = processWidgetsColumn(row.widgets);
            const updatedMobileWidgets = processWidgetsColumn(row.mobile_widgets);

            if ((updatedWidgets && updatedWidgets !== row.widgets) ||
                (updatedMobileWidgets && updatedMobileWidgets !== row.mobile_widgets)) {
                updateBackup.run(
                    updatedWidgets || row.widgets,
                    updatedMobileWidgets || row.mobile_widgets,
                    row.id
                );
                backupCount++;
            }
        }
        logger.debug('[Migration 0013] Updated backups', { count: backupCount });

        logger.debug('[Migration 0013] Widget height migration complete!');
    },

    down(db) {
        // Halve the values to revert (not recommended, could lose precision)
        logger.debug('[Migration 0013] Down migration not implemented - restore from backup if needed');
    }
};
