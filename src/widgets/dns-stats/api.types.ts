/**
 * DNS Stats API Types
 * Frontend types for DNS Stats widget data.
 *
 * These mirror the backend DnsStatsDto but are defined separately
 * to isolate frontend from backend implementation details.
 */

export interface DnsStatsData {
    // Tier A
    queriesTotal: number;
    queriesBlocked: number;
    blockedPercent: number;
    domainsOnList: number;
    protectionEnabled: boolean;
    pauseRemaining: number | null;

    // Tier B
    avgProcessingTimeMs: number | null;
    activeClients: number | null;
    topBlockedDomains: Array<{ domain: string; count: number }>;
    topQueriedDomains: Array<{ domain: string; count: number }>;
    topClients: Array<{ name: string; count: number }>;
    topUpstreams: Array<{ name: string; count: number; avgResponseMs: number | null }>;
    sparkline: Array<{ timestamp: number; queries: number; blocked: number }>;
}

export interface DnsStatsWidgetData {
    data: DnsStatsData | null;
    isLoading: boolean;
    error: string | null;
    toggleProtection: (enabled: boolean, duration?: number) => Promise<void>;
    togglingProtection: boolean;
}
