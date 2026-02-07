/**
 * Migration: Rename framerr-monitoring type to monitor
 * Purpose: Align database type with simplified type ID used in definitions/registry
 * Version: 24
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 24,
    name: 'rename_framerr_monitoring_to_monitor',
    up(db) {
        // Update integration instance types
        const updateIntegrations = db.prepare(`
            UPDATE integration_instances 
            SET type = 'monitor'
            WHERE type = 'framerr-monitoring'
        `).run();

        logger.debug('[Migration 0024] Renamed framerr-monitoring instances to monitor', { count: updateIntegrations.changes });

        // Update instance IDs to match new naming (framerr-monitoring-primary -> monitor-primary)
        const updateIds = db.prepare(`
            UPDATE integration_instances 
            SET id = REPLACE(id, 'framerr-monitoring-', 'monitor-')
            WHERE id LIKE 'framerr-monitoring-%'
        `).run();

        logger.debug('[Migration 0024] Renamed instance IDs', { count: updateIds.changes });

        // Update service_monitors to reference new instance ID
        const updateMonitors = db.prepare(`
            UPDATE service_monitors 
            SET integration_instance_id = REPLACE(integration_instance_id, 'framerr-monitoring-', 'monitor-')
            WHERE integration_instance_id LIKE 'framerr-monitoring-%'
        `).run();

        logger.debug('[Migration 0024] Updated service_monitors references', { count: updateMonitors.changes });

        logger.debug('[Migration 0024] Complete: Renamed framerr-monitoring to monitor');
    }
};
