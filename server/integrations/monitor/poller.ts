/**
 * Monitor Poller
 * 
 * Polls monitor status from local database.
 * Unlike other integrations, monitors are Framerr's first-party feature
 * stored in the local database, not fetched from external APIs.
 */

import { PluginInstance } from '../types';
import * as serviceMonitorsDb from '../../db/serviceMonitors';

// ============================================================================
// MONITOR POLLER
// ============================================================================

/** Polling interval in milliseconds (10 seconds) */
export const intervalMs = 10000;

/** Monitor data shape for SSE */
export interface MonitorData {
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
    /** Monitor's configured check interval (for client-side timer calculation) */
    intervalSeconds: number;
}

/**
 * Poll monitors for this integration instance.
 * Reads from local database - no external API calls.
 */
export async function poll(instance: PluginInstance): Promise<MonitorData[]> {
    // The instance ID is the integration instance ID
    const instanceId = instance.id;

    try {
        const monitors = await serviceMonitorsDb.getMonitorsByIntegrationInstance(instanceId);
        const monitorsWithStatus = await Promise.all(monitors.map(async (m) => {
            const recentChecks = await serviceMonitorsDb.getRecentChecks(m.id, 1);
            const lastCheck = recentChecks[0];

            // Determine effective status (maintenance overrides actual status)
            const rawStatus = lastCheck?.status || 'pending';
            const effectiveStatus = m.maintenance ? 'maintenance' : rawStatus;

            return {
                id: m.id,
                name: m.name,
                url: m.url || null,
                iconName: m.iconName || null,
                iconId: m.iconId || null,
                maintenance: m.maintenance,
                status: effectiveStatus as MonitorData['status'],
                responseTimeMs: lastCheck?.responseTimeMs || null,
                lastCheck: lastCheck?.checkedAt || null,
                uptimePercent: null,
                intervalSeconds: m.intervalSeconds
            };
        }));

        return monitorsWithStatus;
    } catch {
        return [];
    }
}
