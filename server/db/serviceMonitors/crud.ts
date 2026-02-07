/**
 * Service Monitor CRUD Operations
 * 
 * Core create, read, update, delete operations for service monitors.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToMonitor } from './helpers';
import { getMonitorDefaults } from '../systemConfig';
import type { MonitorRow, ServiceMonitor, CreateMonitorData } from './types';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new service monitor.
 * Uses global monitor defaults from system config for any unspecified values.
 */
export async function createMonitor(ownerId: string, data: CreateMonitorData): Promise<ServiceMonitor> {
    const id = uuidv4();
    const defaults = await getMonitorDefaults();

    // Normalize expectedStatusCodes to always be an array
    let normalizedCodes: string[] = defaults.expectedStatusCodes;
    if (data.expectedStatusCodes) {
        if (Array.isArray(data.expectedStatusCodes)) {
            normalizedCodes = data.expectedStatusCodes;
        } else if (typeof data.expectedStatusCodes === 'string') {
            // Frontend may send comma-separated string like "200-299,301"
            normalizedCodes = data.expectedStatusCodes.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    const expectedStatusCodes = JSON.stringify(normalizedCodes);

    getDb().prepare(`
        INSERT INTO service_monitors (
            id, owner_id, name, icon_id, icon_name, type, url, port,
            interval_seconds, timeout_seconds, retries, degraded_threshold_ms,
            expected_status_codes, enabled, uptime_kuma_id, uptime_kuma_url, is_readonly, order_index,
            notify_down, notify_up, notify_degraded, maintenance_schedule, integration_instance_id, source_integration_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        ownerId,
        data.name,
        data.iconId ?? null,
        data.iconName ?? null,
        data.type || 'http',
        data.url ?? null,
        data.port ?? null,
        data.intervalSeconds ?? defaults.intervalSeconds,
        data.timeoutSeconds ?? defaults.timeoutSeconds,
        data.retries ?? defaults.retriesBeforeDown,
        data.degradedThresholdMs ?? defaults.degradedThresholdMs,
        expectedStatusCodes,
        data.enabled !== false ? 1 : 0,
        data.uptimeKumaId ?? null,
        data.uptimeKumaUrl ?? null,
        data.isReadonly ? 1 : 0,
        data.orderIndex ?? 0,
        data.notifyDown !== false ? 1 : 0,
        data.notifyUp !== false ? 1 : 0,
        data.notifyDegraded === true ? 1 : 0,
        data.maintenanceSchedule ? JSON.stringify(data.maintenanceSchedule) : null,
        data.integrationInstanceId ?? null,
        data.sourceIntegrationId ?? null
    );

    logger.info(`[ServiceMonitors] Created: id=${id} name="${data.name}" owner=${ownerId}`);
    return (await getMonitorById(id))!;
}

/**
 * Update an existing service monitor.
 */
export async function updateMonitor(id: string, data: Partial<CreateMonitorData>): Promise<ServiceMonitor | null> {
    const existing = await getMonitorById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.iconId !== undefined) {
        updates.push('icon_id = ?');
        params.push(data.iconId);
    }
    if (data.iconName !== undefined) {
        updates.push('icon_name = ?');
        params.push(data.iconName);
    }
    if (data.type !== undefined) {
        updates.push('type = ?');
        params.push(data.type);
    }
    if (data.url !== undefined) {
        updates.push('url = ?');
        params.push(data.url);
    }
    if (data.port !== undefined) {
        updates.push('port = ?');
        params.push(data.port);
    }
    if (data.intervalSeconds !== undefined) {
        updates.push('interval_seconds = ?');
        params.push(data.intervalSeconds);
    }
    if (data.timeoutSeconds !== undefined) {
        updates.push('timeout_seconds = ?');
        params.push(data.timeoutSeconds);
    }
    if (data.retries !== undefined) {
        updates.push('retries = ?');
        params.push(data.retries);
    }
    if (data.degradedThresholdMs !== undefined) {
        updates.push('degraded_threshold_ms = ?');
        params.push(data.degradedThresholdMs);
    }
    if (data.expectedStatusCodes !== undefined) {
        // Normalize expectedStatusCodes to always be an array
        let normalizedCodes: string[];
        if (Array.isArray(data.expectedStatusCodes)) {
            normalizedCodes = data.expectedStatusCodes;
        } else {
            // Frontend may send comma-separated string like "200-299,301"
            normalizedCodes = data.expectedStatusCodes.split(',').map(s => s.trim()).filter(Boolean);
        }
        updates.push('expected_status_codes = ?');
        params.push(JSON.stringify(normalizedCodes));
    }
    if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled ? 1 : 0);
    }
    if (data.orderIndex !== undefined) {
        updates.push('order_index = ?');
        params.push(data.orderIndex);
    }
    if (data.notifyDown !== undefined) {
        updates.push('notify_down = ?');
        params.push(data.notifyDown ? 1 : 0);
    }
    if (data.notifyUp !== undefined) {
        updates.push('notify_up = ?');
        params.push(data.notifyUp ? 1 : 0);
    }
    if (data.notifyDegraded !== undefined) {
        updates.push('notify_degraded = ?');
        params.push(data.notifyDegraded ? 1 : 0);
    }
    if (data.maintenanceSchedule !== undefined) {
        updates.push('maintenance_schedule = ?');
        params.push(data.maintenanceSchedule ? JSON.stringify(data.maintenanceSchedule) : null);
    }

    if (updates.length === 0) return existing;

    params.push(id);
    getDb().prepare(`UPDATE service_monitors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logger.info(`[ServiceMonitors] Updated: id=${id} fields=[${Object.keys(data).join(',')}]`);
    return getMonitorById(id);
}

/**
 * Delete a service monitor and all related data.
 */
export async function deleteMonitor(id: string): Promise<boolean> {
    const result = getDb().prepare('DELETE FROM service_monitors WHERE id = ?').run(id);
    if (result.changes > 0) {
        logger.info(`[ServiceMonitors] Deleted: id=${id}`);
        return true;
    }
    return false;
}

/**
 * Get a monitor by ID.
 */
export async function getMonitorById(id: string): Promise<ServiceMonitor | null> {
    const row = getDb().prepare('SELECT * FROM service_monitors WHERE id = ?').get(id) as MonitorRow | undefined;
    return row ? rowToMonitor(row) : null;
}

/**
 * Get all monitors owned by a user.
 */
export async function getMonitorsByOwner(ownerId: string): Promise<ServiceMonitor[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitors 
        WHERE owner_id = ? 
        ORDER BY order_index ASC, created_at ASC
    `).all(ownerId) as MonitorRow[];
    return rows.map(rowToMonitor);
}

/**
 * Get all enabled monitors (for polling).
 */
export async function getEnabledMonitors(): Promise<ServiceMonitor[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitors 
        WHERE enabled = 1 
        ORDER BY created_at ASC
    `).all() as MonitorRow[];
    return rows.map(rowToMonitor);
}

/**
 * Get all monitors (admin view).
 */
export async function getAllMonitors(): Promise<ServiceMonitor[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitors 
        ORDER BY order_index ASC, created_at ASC
    `).all() as MonitorRow[];
    return rows.map(rowToMonitor);
}

/**
 * Get all monitors for a specific integration instance.
 * Used by framerr-monitoring widgets to fetch monitors for their bound instance.
 */
export async function getMonitorsByIntegrationInstance(integrationInstanceId: string): Promise<ServiceMonitor[]> {
    const rows = getDb().prepare(`
        SELECT * FROM service_monitors 
        WHERE integration_instance_id = ? AND enabled = 1
        ORDER BY order_index ASC, created_at ASC
    `).all(integrationInstanceId) as MonitorRow[];
    return rows.map(rowToMonitor);
}

/**
 * Get a monitor by its Uptime Kuma ID (for checking if already imported).
 */
export async function getMonitorByUptimeKumaId(uptimeKumaId: number): Promise<ServiceMonitor | null> {
    const row = getDb().prepare('SELECT * FROM service_monitors WHERE uptime_kuma_id = ?').get(uptimeKumaId) as MonitorRow | undefined;
    return row ? rowToMonitor(row) : null;
}

/**
 * Get total count of monitors (for integration status check).
 * Used by isConfigured() in serviceMonitors route to determine if Service Monitoring is set up.
 */
export function getMonitorCount(): number {
    const result = getDb().prepare('SELECT COUNT(*) as count FROM service_monitors').get() as { count: number };
    return result.count;
}

/**
 * Reorder monitors by updating orderIndex based on array position.
 * @param orderedIds Array of monitor IDs in desired order
 */
export function reorderMonitors(orderedIds: string[]): void {
    const update = getDb().prepare('UPDATE service_monitors SET order_index = ? WHERE id = ?');
    const transaction = getDb().transaction(() => {
        orderedIds.forEach((id, index) => {
            update.run(index, id);
        });
    });
    transaction();
    logger.info(`[ServiceMonitors] Reordered: count=${orderedIds.length}`);
}

// ============================================================================
// Maintenance Mode
// ============================================================================

/**
 * Toggle maintenance mode for a monitor.
 */
export async function setMonitorMaintenance(id: string, enabled: boolean): Promise<boolean> {
    const result = getDb().prepare('UPDATE service_monitors SET maintenance = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    if (result.changes > 0) {
        logger.info(`[ServiceMonitors] Maintenance toggled: id=${id} enabled=${enabled}`);
        return true;
    }
    return false;
}
