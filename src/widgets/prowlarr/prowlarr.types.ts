/**
 * Prowlarr Widget Types
 *
 * Frontend mirrors of backend SSE/proxy shapes.
 */

export interface ProwlarrIndexerHealth {
    id: number;
    name: string;
    protocol: 'torrent' | 'usenet';
    privacy: 'public' | 'private' | 'semiPrivate';
    enabled: boolean;
    priority: number;
    status: 'healthy' | 'disabled' | 'failing';
    disabledTill: string | null;
    mostRecentFailure: string | null;
    failureMessage: string | null;
    cloudflareSuspected: boolean;
}

export interface ProwlarrHealthMessage {
    source: string;
    type: 'notice' | 'warning' | 'error';
    message: string;
    wikiUrl?: string;
}

export interface ProwlarrSummary {
    total: number;
    enabled: number;
    healthy: number;
    failing: number;
    disabled: number;
}

export interface ProwlarrApplication {
    id: number;
    name: string;
    syncLevel: string;
    implementation: string;
}

export interface ProwlarrHistoryEntry {
    id: number;
    date: string;
    eventType: string;
    /** Humanized event label for display */
    eventLabel: string;
    indexerId: number;
    indexerName: string;
    successful: boolean;
    /** Optional detail from history data (query, message, etc.) */
    detail?: string;
}

export interface ProwlarrHistoryResponse {
    page: number;
    pageSize: number;
    totalRecords: number;
    /** Raw Prowlarr records — mapped to ProwlarrHistoryEntry in the hook */
    records: Array<{
        id: number;
        date: string;
        eventType?: string;
        indexerId?: number;
        successful?: boolean;
        data?: Record<string, string>;
        sourceTitle?: string;
        indexer?: { name?: string };
    }>;
}

export interface ProwlarrIndexerStatsRow {
    indexerId: number;
    indexerName: string;
    numberOfQueries: number;
    numberOfGrabs: number;
    averageResponseTime: number;
}

export interface ProwlarrIndexerStatsResponse {
    indexers?: ProwlarrIndexerStatsRow[];
}

export interface ProwlarrActivityData {
    stats: {
        queries: number;
        grabs: number;
        avgResponseMs: number;
    } | null;
    history: ProwlarrHistoryEntry[];
    loading: boolean;
    error: string | null;
}

export interface ProwlarrWidgetData {
    indexers: ProwlarrIndexerHealth[];
    healthMessages: ProwlarrHealthMessage[];
    summary: ProwlarrSummary | null;
    applications: ProwlarrApplication[];
    loading: boolean;
    error: string | null;
    togglingIndexerId: number | null;
    testingIndexerId: number | null;
    testingAll: boolean;
    toggleIndexerEnabled: (indexerId: number, enabled: boolean) => Promise<void>;
    testIndexer: (indexerId: number) => Promise<void>;
    testAllIndexers: () => Promise<void>;
    fetchActivity: (page?: number, startDate?: string, endDate?: string) => Promise<ProwlarrActivityData>;
}
