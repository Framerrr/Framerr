/**
 * Uptime Kuma Poller
 * 
 * Polls Uptime Kuma metrics endpoint for monitor status.
 * Like the Framerr monitor integration, this is used for service status widgets.
 * 
 * Uses same logic as server/routes/integrations/uptimekuma/proxy.ts
 * Includes status change detection for notifications (Phase 3).
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import { notificationBatcher } from '../../services/NotificationBatcher';
import { userWantsEvent } from '../../services/webhookUserResolver';
import * as integrationInstancesDb from '../../db/integrationInstances';
import logger from '../../utils/logger';
import { listUsers } from '../../db/users';

// ============================================================================
// UPTIME KUMA POLLER
// ============================================================================

/** Polling interval in milliseconds (10 seconds) */
export const intervalMs = 10000;

/**
 * Status cache for tracking UK monitor status changes.
 * Key: instanceId -> monitorId -> previous status
 * Used to detect changes and trigger notifications.
 */
const statusCache = new Map<string, Map<string, UptimeKumaMonitor['status']>>();

/** Monitor data shape for SSE - matches MonitorSSEData interface */
export interface UptimeKumaMonitor {
    id: string;
    name: string;
    url: string | null;
    iconName: string | null;
    iconId: string | null;
    maintenance: boolean;
    status: 'up' | 'down' | 'degraded' | 'pending' | 'maintenance';
    responseTimeMs: number | null;
    lastCheck: string | null;
    uptimePercent: number | null;
}

/**
 * Poll Uptime Kuma for monitor status.
 * Uses the /metrics endpoint with Basic auth (same as proxy route).
 */
export async function poll(instance: PluginInstance): Promise<UptimeKumaMonitor[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;
    const translatedUrl = translateHostUrl(url);

    try {
        // Use Basic auth: empty username, apiKey as password (same as proxy route)
        const authHeader = `Basic ${Buffer.from(':' + apiKey).toString('base64')}`;

        const response = await axios.get(`${translatedUrl}/metrics`, {
            headers: { 'Authorization': authHeader },
            httpsAgent,
            timeout: 10000
        });

        const metricsText = response.data as string;

        // Check if we got HTML (auth failed)
        if (metricsText.startsWith('<!DOCTYPE') || metricsText.startsWith('<html')) {
            return [];
        }

        // Parse Prometheus format - DEDUPLICATE BY NAME (same as proxy route)
        const monitorMap = new Map<string, { name: string; status: number }>();
        const latencyMap = new Map<string, number>();

        const lines = metricsText.split('\n');

        for (const line of lines) {
            if (line.startsWith('monitor_status{')) {
                const match = line.match(/monitor_status\{([^}]+)\}\s+(\d+)/);
                if (match) {
                    const labels = match[1];
                    const status = parseInt(match[2]);

                    // Skip pending (status 2) - same as proxy route
                    if (status === 2) continue;

                    const nameMatch = labels.match(/monitor_name="([^"]*)"/);
                    const name = nameMatch?.[1] || 'Unknown';

                    // Deduplicate by name - only keep first occurrence
                    if (!monitorMap.has(name)) {
                        monitorMap.set(name, { name, status });
                    }
                }
            }

            if (line.startsWith('monitor_response_time{')) {
                const match = line.match(/monitor_name="([^"]*)".*\}\s+(\d+)/);
                if (match) {
                    // Only set latency if we haven't seen this monitor yet
                    if (!latencyMap.has(match[1])) {
                        latencyMap.set(match[1], parseInt(match[2]));
                    }
                }
            }
        }

        // Convert to monitor array with SSE-compatible format
        const monitors: UptimeKumaMonitor[] = [];
        for (const [name, data] of monitorMap.entries()) {
            // Map UK status (0=down, 1=up, 3=maintenance) to our status
            let status: UptimeKumaMonitor['status'] = 'pending';
            if (data.status === 1) status = 'up';
            else if (data.status === 0) status = 'down';
            else if (data.status === 3) status = 'maintenance';

            monitors.push({
                id: name,
                name: data.name,
                url: null,
                iconName: null,
                iconId: null,
                maintenance: data.status === 3,
                status,
                responseTimeMs: latencyMap.get(name) ?? null,
                lastCheck: new Date().toISOString(),
                uptimePercent: null
            });
        }

        // Filter by selectedMonitorIds if configured
        // selectedMonitorIds is stored as JSON string of monitor names/IDs
        let filteredMonitors = monitors;
        const selectedMonitorIdsRaw = instance.config.selectedMonitorIds as string | undefined;
        if (selectedMonitorIdsRaw) {
            try {
                const selectedIds: string[] = JSON.parse(selectedMonitorIdsRaw);
                if (selectedIds.length > 0) {
                    // Filter to only include monitors whose id is in the selection
                    filteredMonitors = monitors.filter(m => selectedIds.includes(m.id));
                    logger.debug(`[UptimeKumaPoller] Filtered monitors: instance=${instance.id} total=${monitors.length} selected=${filteredMonitors.length}`);
                }
            } catch {
                // Invalid JSON, skip filtering
                logger.warn(`[UptimeKumaPoller] Invalid selectedMonitorIds JSON: instance=${instance.id}`);
            }
        }

        // Status change detection for notifications (use filtered list)
        await detectStatusChangesAndNotify(instance, filteredMonitors);

        return filteredMonitors;
    } catch {
        return [];
    }
}

/**
 * Detect status changes and trigger notifications.
 * Compares current monitor status against cached status and notifies on changes.
 */
async function detectStatusChangesAndNotify(
    instance: PluginInstance,
    monitors: UptimeKumaMonitor[]
): Promise<void> {
    const instanceId = instance.id;

    // Initialize cache for this instance if not exists
    if (!statusCache.has(instanceId)) {
        statusCache.set(instanceId, new Map());
    }
    const instanceCache = statusCache.get(instanceId)!;

    // Get webhookConfig from integration instance (per-instance config)
    const integrationInstance = integrationInstancesDb.getInstanceById(instanceId);
    const webhookConfig = integrationInstance?.config?.webhookConfig as { adminEvents?: string[]; userEvents?: string[] } | undefined;

    // Get instance display name for notification titles
    const instanceDisplayName = integrationInstance?.displayName || 'Uptime Kuma';

    for (const monitor of monitors) {
        const previousStatus = instanceCache.get(monitor.id);
        const currentStatus = monitor.status;

        // Skip if in maintenance or pending
        if (currentStatus === 'maintenance' || currentStatus === 'pending') {
            instanceCache.set(monitor.id, currentStatus);
            continue;
        }

        // Check for status change
        if (previousStatus && previousStatus !== currentStatus) {
            // Skip transitions from pending/maintenance
            if (previousStatus === 'pending' || previousStatus === 'maintenance') {
                instanceCache.set(monitor.id, currentStatus);
                continue;
            }

            // Determine event key
            let eventKey: string | null = null;
            if (currentStatus === 'down') {
                eventKey = 'serviceDown';
            } else if (currentStatus === 'up' && previousStatus === 'down') {
                eventKey = 'serviceUp';
            } else if (currentStatus === 'degraded') {
                eventKey = 'serviceDegraded';
            }

            if (eventKey && webhookConfig) {
                logger.info(`[UK] Status change detected: instance=${instanceDisplayName} monitor=${monitor.name} ${previousStatus}→${currentStatus}`);

                // Uptime Kuma is a system-level integration - notify all admin users
                const users = await listUsers();
                const admins = users.filter(u => u.group === 'admin' || u.isSetupAdmin);

                for (const admin of admins) {
                    const wantsEvent = await userWantsEvent(
                        admin.id,
                        'servicemonitoring',
                        eventKey,
                        true,
                        webhookConfig
                    );
                    if (wantsEvent) {
                        notificationBatcher.add(
                            admin.id,
                            instance.id,
                            currentStatus as 'up' | 'down' | 'degraded',
                            monitor.name,
                            null,
                            null,
                            instanceDisplayName
                        );
                    }
                }
            }
        }

        // Update cache
        instanceCache.set(monitor.id, currentStatus);
    }
}
