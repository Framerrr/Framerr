/**
 * Shared DNS Stats DTO
 * Used by both AdGuard and Pi-hole pollers.
 *
 * Nullability notes:
 * - pauseRemaining: AdGuard status returns ms (poller converts to seconds); Pi-hole v6 exposes timer via /api/dns/blocking; Pi-hole v5 typically null
 * - avgProcessingTimeMs: AdGuard provides avg_processing_time; Pi-hole uses weighted upstream response ms when available
 * - activeClients: Pi-hole summary provides; AdGuard approximates from top_clients length
 * - sparkline: populated from AGH stats arrays / Pi-hole history when available
 */
export interface DnsStatsDto {
    // Tier A
    queriesTotal: number;
    queriesBlocked: number;
    blockedPercent: number;
    domainsOnList: number;
    protectionEnabled: boolean;
    pauseRemaining: number | null; // seconds, null if not paused or not exposed by API

    // Tier B
    avgProcessingTimeMs: number | null;
    activeClients: number | null;
    topBlockedDomains: Array<{ domain: string; count: number }>; // bounded to 10
    topQueriedDomains: Array<{ domain: string; count: number }>; // bounded to 10
    topClients: Array<{ name: string; count: number }>; // bounded to 10
    topUpstreams: Array<{ name: string; count: number; avgResponseMs: number | null }>; // bounded to 10
    sparkline: Array<{ timestamp: number; queries: number; blocked: number }>; // last 24h, sampled
}
