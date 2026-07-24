import { PluginInstance, PluginAdapter } from '../types';
import { DnsStatsDto } from '../_shared/dns-stats.types';
import {
    mapAdGuardKeyedList,
    mapAdGuardSparkline,
    mapAdGuardTopBlocked,
    mapAdGuardUpstreams,
} from '../_shared/dns-stats.mappers';
import logger from '../../utils/logger';

export const intervalMs = 15000;

// Re-export for proxy routes that previously imported from this module
export { mapAdGuardTopBlocked } from '../_shared/dns-stats.mappers';

interface AdGuardStatus {
    protection_enabled?: boolean;
    protection_disabled_duration?: number;
}

interface AdGuardStats {
    num_dns_queries?: number;
    num_blocked_filtering?: number;
    avg_processing_time?: number;
    time_units?: string;
    dns_queries?: unknown;
    blocked_filtering?: unknown;
    top_blocked_domains?: unknown;
    top_queried_domains?: unknown;
    top_clients?: unknown;
    top_upstreams_responses?: unknown;
    top_upstreams_avg_time?: unknown;
}

interface AdGuardFilter {
    id?: number;
    enabled?: boolean;
    rules_count?: number;
}

interface AdGuardFilteringStatus {
    enabled?: boolean;
    filters?: AdGuardFilter[];
}

export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<DnsStatsDto> {
    const [statusRes, statsRes, filteringRes] = await Promise.all([
        adapter.get!(instance, '/control/status', { timeout: 10000 }),
        adapter.get!(instance, '/control/stats', { timeout: 10000 }),
        adapter.get!(instance, '/control/filtering/status', { timeout: 10000 }),
    ]);

    const status = (statusRes.data ?? {}) as AdGuardStatus;
    const stats = (statsRes.data ?? {}) as AdGuardStats;
    const filteringStatus = (filteringRes.data ?? {}) as AdGuardFilteringStatus;

    const queriesTotal = stats.num_dns_queries ?? 0;
    const queriesBlocked = stats.num_blocked_filtering ?? 0;
    const blockedPercent = queriesTotal > 0 ? (queriesBlocked / queriesTotal) * 100 : 0;

    const domainsOnList = (filteringStatus.filters ?? [])
        .filter((f) => f.enabled)
        .reduce((sum, f) => sum + (f.rules_count ?? 0), 0);

    let topBlockedDomains: Array<{ domain: string; count: number }> = [];
    let topQueriedDomains: Array<{ domain: string; count: number }> = [];
    let topClients: Array<{ name: string; count: number }> = [];
    let topUpstreams: Array<{ name: string; count: number; avgResponseMs: number | null }> = [];
    let sparkline: Array<{ timestamp: number; queries: number; blocked: number }> = [];

    try {
        topBlockedDomains = mapAdGuardTopBlocked(stats.top_blocked_domains);
    } catch (err) {
        logger.warn(
            `[AdGuardPoller] top_blocked_domains parse failed for ${instance.id}: ${(err as Error).message}`
        );
    }

    try {
        topQueriedDomains = mapAdGuardKeyedList(stats.top_queried_domains).map((e) => ({
            domain: e.name,
            count: e.count,
        }));
    } catch (err) {
        logger.warn(
            `[AdGuardPoller] top_queried_domains parse failed for ${instance.id}: ${(err as Error).message}`
        );
    }

    try {
        topClients = mapAdGuardKeyedList(stats.top_clients);
    } catch (err) {
        logger.warn(`[AdGuardPoller] top_clients parse failed for ${instance.id}: ${(err as Error).message}`);
    }

    try {
        topUpstreams = mapAdGuardUpstreams(stats.top_upstreams_responses, stats.top_upstreams_avg_time);
    } catch (err) {
        logger.warn(`[AdGuardPoller] upstreams parse failed for ${instance.id}: ${(err as Error).message}`);
    }

    try {
        sparkline = mapAdGuardSparkline(stats.dns_queries, stats.blocked_filtering, stats.time_units);
    } catch (err) {
        logger.warn(`[AdGuardPoller] sparkline parse failed for ${instance.id}: ${(err as Error).message}`);
    }

    // AdGuard returns protection_disabled_duration in milliseconds
    const pauseRemainingMs =
        typeof status.protection_disabled_duration === 'number' &&
        status.protection_disabled_duration > 0
            ? status.protection_disabled_duration
            : null;
    const pauseRemaining =
        pauseRemainingMs !== null ? Math.max(0, Math.round(pauseRemainingMs / 1000)) : null;

    // avg_processing_time is seconds (float); store as ms for the DTO
    const avgProcessingTimeMs =
        typeof stats.avg_processing_time === 'number' ? stats.avg_processing_time * 1000 : null;

    // AGH has no dedicated active-client counter. Use full top_clients length
    // (not the sliced list used for UI) as a period-scoped approximation.
    const activeClients =
        Array.isArray(stats.top_clients) && stats.top_clients.length > 0
            ? stats.top_clients.length
            : null;

    return {
        queriesTotal,
        queriesBlocked,
        blockedPercent,
        domainsOnList,
        protectionEnabled: status.protection_enabled ?? false,
        pauseRemaining,
        avgProcessingTimeMs,
        activeClients,
        topBlockedDomains,
        topQueriedDomains,
        topClients,
        topUpstreams,
        sparkline,
    };
}
