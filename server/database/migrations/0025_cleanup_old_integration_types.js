/**
 * Migration: Cleanup old integration types
 * Purpose: Remove/migrate any remaining old-style integration types to new unified types
 * Version: 25
 * 
 * This migration cleans up:
 * - 'systemstatus' → delete (superseded by 'glances' or 'customsystemstatus')
 * - 'servicemonitoring' → delete (superseded by 'monitor')
 * - 'uptime-kuma' → rename to 'uptimekuma' (normalize type ID)
 * 
 * These old types may exist if integrations were created after migrations 23/24 ran
 * but before the frontend was updated to use new type IDs.
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 25,
    name: 'cleanup_old_integration_types',
    up(db) {
        // =========================================================================
        // Step 1: Remove legacy 'systemstatus' instances
        // (Users should recreate as 'glances' or 'customsystemstatus')
        // =========================================================================
        const deleteSystemstatus = db.prepare(`
            DELETE FROM integration_instances WHERE type = 'systemstatus'
        `).run();

        if (deleteSystemstatus.changes > 0) {
            logger.debug('[Migration 0025] Removed legacy systemstatus instances', { count: deleteSystemstatus.changes });
        }

        // =========================================================================
        // Step 2: Remove legacy 'servicemonitoring' instances
        // (Users should use 'monitor' type instead)
        // =========================================================================
        const deleteServicemonitoring = db.prepare(`
            DELETE FROM integration_instances WHERE type = 'servicemonitoring'
        `).run();

        if (deleteServicemonitoring.changes > 0) {
            logger.debug('[Migration 0025] Removed legacy servicemonitoring instances', { count: deleteServicemonitoring.changes });
        }

        // =========================================================================
        // Step 3: Normalize 'uptime-kuma' → 'uptimekuma' (consistent with definitions.ts)
        // =========================================================================
        // Update the type
        const updateType = db.prepare(`
            UPDATE integration_instances 
            SET type = 'uptimekuma'
            WHERE type = 'uptime-kuma'
        `).run();

        if (updateType.changes > 0) {
            logger.debug('[Migration 0025] Renamed uptime-kuma instances to uptimekuma', { count: updateType.changes });
        }

        // Update instance IDs to match (uptime-kuma-primary → uptimekuma-primary)
        const updateIds = db.prepare(`
            UPDATE integration_instances 
            SET id = REPLACE(id, 'uptime-kuma-', 'uptimekuma-')
            WHERE id LIKE 'uptime-kuma-%'
        `).run();

        if (updateIds.changes > 0) {
            logger.debug('[Migration 0025] Renamed instance IDs from uptime-kuma to uptimekuma', { count: updateIds.changes });
        }

        // =========================================================================
        // Step 4: Update any service_monitors that reference the old uptime-kuma ID
        // =========================================================================
        const updateMonitorRefs = db.prepare(`
            UPDATE service_monitors 
            SET integration_instance_id = REPLACE(integration_instance_id, 'uptime-kuma-', 'uptimekuma-')
            WHERE integration_instance_id LIKE 'uptime-kuma-%'
        `).run();

        if (updateMonitorRefs.changes > 0) {
            logger.debug('[Migration 0025] Updated service_monitors references', { count: updateMonitorRefs.changes });
        }

        logger.debug('[Migration 0025] Complete: Old integration types cleaned up');
    }
};
