/**
 * Integration Cleanup
 * 
 * Persistence cleanup for deleted integrations.
 * Scrubs deleted integration IDs from all stored widget configs
 * (user dashboards and templates).
 * 
 * Extracted from IntegrationManager to separate persistence cleanup
 * from service lifecycle and CRUD reaction concerns.
 */

import logger from '../utils/logger';
import { getDb } from '../database/db';

/**
 * Scrub a deleted integration ID from all stored widget configs.
 * 
 * Handles both:
 * - Single-integration widgets: config.integrationId (string)
 * - Multi-integration widgets: config.*IntegrationIds (string[])
 * 
 * Updates:
 * - user_preferences.dashboard_config (user dashboards)
 * - dashboard_templates.widgets + mobile_widgets (templates)
 */
export function scrubIntegrationFromConfigs(deletedId: string): void {
    const db = getDb();

    // Helper: scrub a single widget's config, returning true if modified
    function scrubWidgetConfig(widget: Record<string, unknown>): boolean {
        const config = widget.config as Record<string, unknown> | undefined;
        if (!config) return false;

        let modified = false;

        // Single-integration: config.integrationId
        if (config.integrationId === deletedId) {
            delete config.integrationId;
            modified = true;
        }

        // Multi-integration: config.*IntegrationIds (arrays)
        for (const key of Object.keys(config)) {
            if (key.endsWith('IntegrationIds') && Array.isArray(config[key])) {
                const arr = config[key] as string[];
                const filtered = arr.filter(id => id !== deletedId);
                if (filtered.length !== arr.length) {
                    if (filtered.length > 0) {
                        config[key] = filtered;
                    } else {
                        delete config[key];
                    }
                    modified = true;
                }
            }

            // Legacy singular: config.*IntegrationId (string, not "IntegrationIds")
            if (key.endsWith('IntegrationId') && !key.endsWith('IntegrationIds') && config[key] === deletedId) {
                delete config[key];
                modified = true;
            }
        }

        return modified;
    }

    // Helper: scrub a widgets array, returning true if any widget was modified
    function scrubWidgetsArray(widgets: Record<string, unknown>[]): boolean {
        let anyModified = false;
        for (const widget of widgets) {
            if (scrubWidgetConfig(widget)) {
                anyModified = true;
            }
        }
        return anyModified;
    }

    // 1. Scrub user dashboard configs
    interface DashboardRow { user_id: string; dashboard_config: string | null }
    const dashboardRows = db.prepare(
        'SELECT user_id, dashboard_config FROM user_preferences WHERE dashboard_config IS NOT NULL'
    ).all() as DashboardRow[];

    let dashboardCount = 0;
    for (const row of dashboardRows) {
        if (!row.dashboard_config) continue;
        try {
            const dashboard = JSON.parse(row.dashboard_config);
            let modified = false;

            // Scrub desktop widgets
            if (Array.isArray(dashboard.widgets)) {
                if (scrubWidgetsArray(dashboard.widgets)) modified = true;
            }
            // Scrub mobile widgets
            if (Array.isArray(dashboard.mobileWidgets)) {
                if (scrubWidgetsArray(dashboard.mobileWidgets)) modified = true;
            }

            if (modified) {
                db.prepare('UPDATE user_preferences SET dashboard_config = ? WHERE user_id = ?')
                    .run(JSON.stringify(dashboard), row.user_id);
                dashboardCount++;
            }
        } catch {
            // Skip malformed JSON
        }
    }

    // 2. Scrub template widgets
    interface TemplateRow { id: string; widgets: string | null; mobile_widgets: string | null }
    const templateRows = db.prepare(
        'SELECT id, widgets, mobile_widgets FROM dashboard_templates'
    ).all() as TemplateRow[];

    let templateCount = 0;
    for (const row of templateRows) {
        let modified = false;
        let widgets: Record<string, unknown>[] | null = null;
        let mobileWidgets: Record<string, unknown>[] | null = null;

        // Parse and scrub desktop widgets
        if (row.widgets) {
            try {
                widgets = JSON.parse(row.widgets);
                if (Array.isArray(widgets) && scrubWidgetsArray(widgets)) {
                    modified = true;
                }
            } catch { /* skip */ }
        }

        // Parse and scrub mobile widgets
        if (row.mobile_widgets) {
            try {
                mobileWidgets = JSON.parse(row.mobile_widgets);
                if (Array.isArray(mobileWidgets) && scrubWidgetsArray(mobileWidgets)) {
                    modified = true;
                }
            } catch { /* skip */ }
        }

        if (modified) {
            const updates: string[] = [];
            const params: (string | null)[] = [];

            if (widgets) {
                updates.push('widgets = ?');
                params.push(JSON.stringify(widgets));
            }
            if (mobileWidgets) {
                updates.push('mobile_widgets = ?');
                params.push(JSON.stringify(mobileWidgets));
            }

            if (updates.length > 0) {
                params.push(row.id);
                db.prepare(`UPDATE dashboard_templates SET ${updates.join(', ')} WHERE id = ?`)
                    .run(...params);
                templateCount++;
            }
        }
    }

    if (dashboardCount > 0 || templateCount > 0) {
        logger.info(`[IntegrationManager] Scrubbed integration ${deletedId}: dashboards=${dashboardCount} templates=${templateCount}`);
    }
}
