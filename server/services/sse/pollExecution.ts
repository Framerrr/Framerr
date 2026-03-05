/**
 * Poll Execution
 * 
 * Functions for executing polls against integration plugins and service monitors.
 * Pure data fetching — no poller state mutation.
 * 
 * @module server/services/sse/pollExecution
 */

import { getPlugin } from '../../integrations/registry';
import { toPluginInstance } from '../../integrations/utils';
import * as integrationInstancesDb from '../../db/integrationInstances';
import type { TopicInfo } from './topicPolicy';

// ============================================================================
// POLL ROUTING
// ============================================================================

/**
 * Execute the actual poll for a topic.
 * Routes to appropriate handler based on topic type.
 */
export async function pollForTopic(
    topic: string,
    topicInfo: TopicInfo
): Promise<unknown> {
    const { type, instanceId, subtype } = topicInfo;

    // =================================================================
    // SPECIAL TOPICS (not plugin-based)
    // =================================================================

    // Service monitors - internal Framerr feature, reads from local DB
    if (type === 'monitor' || type === 'monitors') {
        return await pollMonitors(instanceId);
    }

    // =================================================================
    // PLUGIN-BASED TOPICS
    // =================================================================

    // Get plugin from registry
    const plugin = getPlugin(type);
    if (!plugin?.poller) {
        throw new Error(`No poller available for topic=${topic}`);
    }

    // Get instance
    const instance = instanceId
        ? integrationInstancesDb.getInstanceById(instanceId)
        : integrationInstancesDb.getFirstEnabledByType(type);

    if (!instance) {
        throw new Error(`No instance found for type=${type}`);
    }

    const pluginInstance = toPluginInstance(instance);

    // Handle subtype-specific polling (e.g., calendar)
    if (subtype && plugin.poller.subtypes?.[subtype]) {
        return await plugin.poller.subtypes[subtype].poll(pluginInstance, plugin.adapter);
    }

    // Default: use main poller
    return await plugin.poller.poll(pluginInstance, plugin.adapter);
}

// ============================================================================
// MONITOR POLLING
// ============================================================================

/**
 * Poll service monitors from local database.
 * Special handler for monitors:status and monitor:{id} topics.
 */
export async function pollMonitors(instanceId: string | null): Promise<unknown> {
    // Lazy import to avoid circular dependency
    const serviceMonitorsDb = require('../../db/serviceMonitors');

    if (!instanceId) {
        // monitors:status - get all monitors for all instances
        try {
            const all = await serviceMonitorsDb.getAllMonitors();
            return await formatMonitors(all, serviceMonitorsDb);
        } catch {
            return [];
        }
    }

    try {
        const monitors = await serviceMonitorsDb.getMonitorsByIntegrationInstance(instanceId);
        return await formatMonitors(monitors, serviceMonitorsDb);
    } catch {
        return [];
    }
}

/**
 * Format monitors with status data.
 */
export async function formatMonitors(monitors: unknown[], serviceMonitorsDb: unknown): Promise<unknown[]> {
    const db = serviceMonitorsDb as { getRecentChecks: (id: string, count: number) => Promise<{ status?: string; responseTimeMs?: number; checkedAt?: string }[]> };

    return Promise.all((monitors as { id: string; name: string; url: string; iconName?: string; iconId?: string; maintenance?: boolean; intervalSeconds?: number }[]).map(async (m) => {
        const recentChecks = await db.getRecentChecks(m.id, 1);
        const lastCheck = recentChecks[0];

        const rawStatus = lastCheck?.status || 'pending';
        const effectiveStatus = m.maintenance ? 'maintenance' : rawStatus;

        return {
            id: m.id,
            name: m.name,
            url: m.url,
            iconName: m.iconName || null,
            iconId: m.iconId || null,
            maintenance: m.maintenance,
            status: effectiveStatus,
            responseTimeMs: lastCheck?.responseTimeMs || null,
            lastCheck: lastCheck?.checkedAt || null,
            uptimePercent: null,
            intervalSeconds: m.intervalSeconds ?? 60
        };
    }));
}
