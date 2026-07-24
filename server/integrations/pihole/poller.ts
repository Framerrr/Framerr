import { PluginInstance, PluginAdapter } from '../types';
import { DnsStatsDto } from '../_shared/dns-stats.types';
import logger from '../../utils/logger';

export const intervalMs = 15000;

interface PiHoleSummaryV5 {
    dns_queries_today?: number;
    ads_blocked_today?: number;
    ads_percentage_today?: number;
    domains_being_blocked?: number;
    status?: string;
    unique_clients?: number;
}

interface PiHoleSummaryV6 {
    queries?: {
        total?: number;
        blocked?: number;
        percent_blocked?: number;
    };
    clients?: {
        active?: number;
        total?: number;
    };
    gravity?: {
        domains_being_blocked?: number;
    };
}

interface NamedCount {
    domain?: string;
    name?: string;
    ip?: string;
    count?: number;
}

function mapSummary(raw: unknown): {
    queriesTotal: number;
    queriesBlocked: number;
    blockedPercent: number;
    domainsOnList: number;
    protectionEnabled: boolean | null;
    activeClients: number | null;
} {
    const data = (raw ?? {}) as PiHoleSummaryV5 & PiHoleSummaryV6;

    if (data.queries && typeof data.queries === 'object') {
        const queriesTotal = Number(data.queries.total ?? 0);
        const queriesBlocked = Number(data.queries.blocked ?? 0);
        return {
            queriesTotal,
            queriesBlocked,
            blockedPercent: Number(
                data.queries.percent_blocked ??
                    (queriesTotal > 0 ? (queriesBlocked / queriesTotal) * 100 : 0)
            ),
            domainsOnList: Number(data.gravity?.domains_being_blocked ?? 0),
            protectionEnabled: null,
            activeClients: typeof data.clients?.active === 'number' ? data.clients.active : null,
        };
    }

    const queriesTotal = Number(data.dns_queries_today ?? 0);
    const queriesBlocked = Number(data.ads_blocked_today ?? 0);
    return {
        queriesTotal,
        queriesBlocked,
        blockedPercent: Number(
            data.ads_percentage_today ??
                (queriesTotal > 0 ? (queriesBlocked / queriesTotal) * 100 : 0)
        ),
        domainsOnList: Number(data.domains_being_blocked ?? 0),
        protectionEnabled: typeof data.status === 'string' ? data.status === 'enabled' : null,
        activeClients: typeof data.unique_clients === 'number' ? data.unique_clients : null,
    };
}

function mapDomainList(topData: unknown, prefer: 'blocked' | 'queried'): Array<{ domain: string; count: number }> {
    if (!topData || typeof topData !== 'object') return [];
    const data = topData as Record<string, unknown>;

    if (Array.isArray(data.domains)) {
        return (data.domains as NamedCount[])
            .slice(0, 10)
            .map((entry) => ({
                domain: String(entry.domain ?? ''),
                count: Number(entry.count ?? 0),
            }))
            .filter((entry) => entry.domain);
    }

    if (prefer === 'blocked') {
        if (Array.isArray(data.top_blocked)) {
            return (data.top_blocked as NamedCount[])
                .slice(0, 10)
                .map((entry) => ({
                    domain: String(entry.domain ?? ''),
                    count: Number(entry.count ?? 0),
                }))
                .filter((entry) => entry.domain);
        }
        const topAds = data.top_ads;
        if (topAds && typeof topAds === 'object') {
            return Object.entries(topAds as Record<string, number>)
                .slice(0, 10)
                .map(([domain, count]) => ({ domain, count: Number(count) }));
        }
    } else {
        const topQueries = data.top_queries;
        if (topQueries && typeof topQueries === 'object') {
            return Object.entries(topQueries as Record<string, number>)
                .slice(0, 10)
                .map(([domain, count]) => ({ domain, count: Number(count) }));
        }
    }

    return [];
}

function mapClients(raw: unknown): Array<{ name: string; count: number }> {
    if (!raw || typeof raw !== 'object') return [];
    const data = raw as Record<string, unknown>;

    if (Array.isArray(data.clients)) {
        return (data.clients as NamedCount[])
            .slice(0, 10)
            .map((entry) => {
                const name = String(entry.name || entry.ip || entry.domain || '');
                return { name, count: Number(entry.count ?? 0) };
            })
            .filter((entry) => entry.name);
    }

    // v5 getQuerySources / topClients: { top_sources: { "ip|name": count } } or similar
    const topSources = data.top_sources ?? data.top_clients;
    if (topSources && typeof topSources === 'object' && !Array.isArray(topSources)) {
        return Object.entries(topSources as Record<string, number>)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count: Number(count) }));
    }

    return [];
}

function mapUpstreams(raw: unknown): Array<{ name: string; count: number; avgResponseMs: number | null }> {
    if (!raw || typeof raw !== 'object') return [];
    const data = raw as Record<string, unknown>;

    if (Array.isArray(data.upstreams)) {
        return (data.upstreams as Array<Record<string, unknown>>)
            .slice(0, 10)
            .map((entry) => {
                const name = String(entry.name || entry.ip || '');
                const port = entry.port != null ? `:${entry.port}` : '';
                const label = name.includes(':') ? name : `${name}${port}`;
                const stats = entry.statistics as { response?: number } | undefined;
                const avgResponseMs =
                    typeof stats?.response === 'number'
                        ? stats.response * 1000
                        : typeof entry.avgResponseMs === 'number'
                          ? Number(entry.avgResponseMs)
                          : null;
                return {
                    name: label || 'unknown',
                    count: Number(entry.count ?? 0),
                    avgResponseMs,
                };
            })
            .filter((entry) => entry.name !== 'unknown' || entry.count > 0);
    }

    // v5 forward destinations: { "8.8.8.8#53|google": count } percentages sometimes
    const forwardDestinations = data.forward_destinations ?? data.top_forward_destinations;
    if (forwardDestinations && typeof forwardDestinations === 'object') {
        return Object.entries(forwardDestinations as Record<string, number>)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count: Number(count), avgResponseMs: null }));
    }

    return [];
}

function mapHistory(raw: unknown): Array<{ timestamp: number; queries: number; blocked: number }> {
    if (!raw || typeof raw !== 'object') return [];
    const data = raw as Record<string, unknown>;

    if (Array.isArray(data.history)) {
        const points = (data.history as Array<Record<string, unknown>>)
            .map((entry) => {
                const ts = Number(entry.timestamp ?? 0);
                // FTL timestamps are often unix seconds
                const timestamp = ts > 1e12 ? ts : ts * 1000;
                const queries = Number(entry.total ?? entry.queries ?? 0);
                const blocked = Number(entry.blocked ?? 0);
                return { timestamp, queries, blocked };
            })
            .filter((p) => p.timestamp > 0);

        if (points.length <= 24) return points;
        // Sample evenly to ~24 points
        const step = Math.ceil(points.length / 24);
        return points.filter((_, i) => i % step === 0).slice(-24);
    }

    // v5 overTimeData10mins: { domains_over_time: { ts: count }, ads_over_time: { ts: count } }
    const domainsOverTime = data.domains_over_time;
    const adsOverTime = data.ads_over_time;
    if (domainsOverTime && typeof domainsOverTime === 'object') {
        const ads = (adsOverTime && typeof adsOverTime === 'object'
            ? adsOverTime
            : {}) as Record<string, number>;
        const keys = Object.keys(domainsOverTime as Record<string, number>).sort();
        const sampled = keys.length > 24 ? keys.slice(-24) : keys;
        return sampled.map((key) => {
            const ts = Number(key);
            return {
                timestamp: ts > 1e12 ? ts : ts * 1000,
                queries: Number((domainsOverTime as Record<string, number>)[key] ?? 0),
                blocked: Number(ads[key] ?? 0),
            };
        });
    }

    return [];
}

function weightedUpstreamLatencyMs(
    upstreams: Array<{ count: number; avgResponseMs: number | null }>
): number | null {
    const usable = upstreams.filter(
        (u) => typeof u.avgResponseMs === 'number' && Number.isFinite(u.avgResponseMs) && u.count > 0
    );
    if (usable.length === 0) return null;
    const totalCount = usable.reduce((sum, u) => sum + u.count, 0);
    if (totalCount <= 0) return null;
    const weighted = usable.reduce((sum, u) => sum + u.avgResponseMs! * u.count, 0);
    return weighted / totalCount;
}

function mapBlockingStatus(raw: unknown): { enabled: boolean | null; timerSeconds: number | null } {
    if (!raw || typeof raw !== 'object') return { enabled: null, timerSeconds: null };
    const record = raw as { blocking?: unknown; timer?: unknown };
    let enabled: boolean | null = null;
    if (typeof record.blocking === 'boolean') enabled = record.blocking;
    else if (typeof record.blocking === 'string') {
        enabled = record.blocking === 'enabled' || record.blocking === 'true';
    }

    const timerSeconds =
        typeof record.timer === 'number' && record.timer > 0 ? Math.round(record.timer) : null;

    return { enabled, timerSeconds };
}

async function safeGet(
    adapter: PluginAdapter,
    instance: PluginInstance,
    path: string,
    opts?: { timeout?: number; params?: Record<string, unknown> }
): Promise<unknown | null> {
    try {
        const res = await adapter.get!(instance, path, { timeout: opts?.timeout ?? 10000, params: opts?.params });
        return res.data;
    } catch (err) {
        logger.warn(`[PiHolePoller] ${path} unavailable for ${instance.id}: ${(err as Error).message}`);
        return null;
    }
}

export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<DnsStatsDto> {
    const summaryRes = await adapter.get!(instance, '/api/stats/summary', { timeout: 10000 });
    const mapped = mapSummary(summaryRes.data);

    const [topBlockedRaw, topQueriedRaw, clientsRaw, upstreamsRaw, historyRaw] = await Promise.all([
        safeGet(adapter, instance, '/api/stats/top_domains', {
            params: { blocked: true, count: 10 },
        }),
        safeGet(adapter, instance, '/api/stats/top_domains', {
            params: { blocked: false, count: 10 },
        }),
        safeGet(adapter, instance, '/api/stats/top_clients', { params: { count: 10 } }),
        safeGet(adapter, instance, '/api/stats/upstreams'),
        safeGet(adapter, instance, '/api/history'),
    ]);

    const topBlockedDomains = topBlockedRaw ? mapDomainList(topBlockedRaw, 'blocked') : [];
    // When both blocked/queried share v5 topItems response, queried map uses top_queries
    const topQueriedDomains = topQueriedRaw
        ? mapDomainList(topQueriedRaw, 'queried')
        : topBlockedRaw
          ? mapDomainList(topBlockedRaw, 'queried')
          : [];
    const topClients = clientsRaw ? mapClients(clientsRaw) : [];
    const topUpstreams = upstreamsRaw ? mapUpstreams(upstreamsRaw) : [];
    const sparkline = historyRaw ? mapHistory(historyRaw) : [];

    let protectionEnabled = mapped.protectionEnabled;
    let pauseRemaining: number | null = null;
    if (protectionEnabled === null) {
        try {
            const blockingRes = await adapter.get!(instance, '/api/dns/blocking', {
                timeout: 10000,
            });
            const blocking = mapBlockingStatus(blockingRes.data);
            protectionEnabled = blocking.enabled ?? true;
            pauseRemaining = !protectionEnabled ? blocking.timerSeconds : null;
        } catch {
            protectionEnabled = true;
        }
    }

    return {
        queriesTotal: mapped.queriesTotal,
        queriesBlocked: mapped.queriesBlocked,
        blockedPercent: mapped.blockedPercent,
        domainsOnList: mapped.domainsOnList,
        protectionEnabled,
        pauseRemaining,
        // Pi-hole has no AGH-style avg_processing_time; use weighted upstream
        // response time from /api/stats/upstreams when available (v6).
        avgProcessingTimeMs: weightedUpstreamLatencyMs(topUpstreams),
        activeClients: mapped.activeClients,
        topBlockedDomains,
        topQueriedDomains,
        topClients,
        topUpstreams,
        sparkline,
    };
}
