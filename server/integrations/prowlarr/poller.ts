import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// PROWLARR POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 15000;

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

export interface ProwlarrPollResult {
    indexers: ProwlarrIndexerHealth[];
    healthMessages: ProwlarrHealthMessage[];
    summary: {
        total: number;
        enabled: number;
        healthy: number;
        failing: number;
        disabled: number;
    };
}

export interface ProwlarrApplication {
    id: number;
    name: string;
    syncLevel: string;
    implementation: string;
}

// Raw API shapes (Prowlarr /api/v1/)
export interface RawIndexer {
    id: number;
    name: string;
    enable: boolean;
    protocol: string;
    privacy: string;
    priority: number;
}

export interface RawIndexerStatus {
    indexerId: number;
    disabledTill?: string | null;
    mostRecentFailure?: string | null;
    mostRecentFailureMessage?: string | null;
}

export interface RawHealthMessage {
    source: string;
    type: string;
    message: string;
    wikiUrl?: string;
}

const CF_KEYWORDS = ['cloudflare', 'flaresolverr'];

function messageMentionsCf(text: string | null | undefined): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return CF_KEYWORDS.some((kw) => lower.includes(kw));
}

function messageNamesIndexer(message: string, indexerName: string): boolean {
    return message.toLowerCase().includes(indexerName.toLowerCase());
}

function isCfSuspectedForIndexer(
    indexerName: string,
    failureMessage: string | null,
    healthMessages: ProwlarrHealthMessage[]
): boolean {
    if (failureMessage && messageMentionsCf(failureMessage) && messageNamesIndexer(failureMessage, indexerName)) {
        return true;
    }

    return healthMessages.some(
        (hm) => messageMentionsCf(hm.message) && messageNamesIndexer(hm.message, indexerName)
    );
}

function mapHealthMessages(raw: RawHealthMessage[]): ProwlarrHealthMessage[] {
    return raw.map((hm) => ({
        source: hm.source,
        type: (hm.type === 'warning' || hm.type === 'error' ? hm.type : 'notice') as ProwlarrHealthMessage['type'],
        message: hm.message,
        ...(hm.wikiUrl ? { wikiUrl: hm.wikiUrl } : {}),
    }));
}

function deriveIndexerStatus(
    enabled: boolean,
    statusEntry: RawIndexerStatus | undefined,
    now: Date
): 'healthy' | 'disabled' | 'failing' {
    if (!enabled) return 'disabled';
    if (!statusEntry) return 'healthy';

    const disabledTill = statusEntry.disabledTill;
    if (disabledTill && new Date(disabledTill) > now) {
        return 'failing';
    }

    return 'healthy';
}

/**
 * Pure join of indexer list + indexerstatus + health messages.
 * Exported for unit tests.
 */
export function joinIndexerHealth(
    indexers: RawIndexer[],
    statuses: RawIndexerStatus[],
    healthMessages: RawHealthMessage[]
): ProwlarrPollResult {
    const now = new Date();
    const statusMap = new Map<number, RawIndexerStatus>();
    for (const entry of statuses) {
        statusMap.set(entry.indexerId, entry);
    }

    const mappedHealthMessages = mapHealthMessages(healthMessages);

    const joinedIndexers: ProwlarrIndexerHealth[] = indexers.map((indexer) => {
        const statusEntry = statusMap.get(indexer.id);
        const enabled = indexer.enable;
        const status = deriveIndexerStatus(enabled, statusEntry, now);
        const failureMessage = statusEntry?.mostRecentFailureMessage ?? null;

        return {
            id: indexer.id,
            name: indexer.name,
            protocol: (indexer.protocol === 'usenet' ? 'usenet' : 'torrent') as ProwlarrIndexerHealth['protocol'],
            privacy: (['public', 'private', 'semiPrivate'].includes(indexer.privacy)
                ? indexer.privacy
                : 'public') as ProwlarrIndexerHealth['privacy'],
            enabled,
            priority: indexer.priority,
            status,
            disabledTill: statusEntry?.disabledTill ?? null,
            mostRecentFailure: statusEntry?.mostRecentFailure ?? null,
            failureMessage,
            cloudflareSuspected: isCfSuspectedForIndexer(indexer.name, failureMessage, mappedHealthMessages),
        };
    });

    const summary = {
        total: joinedIndexers.length,
        enabled: joinedIndexers.filter((i) => i.enabled).length,
        healthy: joinedIndexers.filter((i) => i.status === 'healthy').length,
        failing: joinedIndexers.filter((i) => i.status === 'failing').length,
        disabled: joinedIndexers.filter((i) => i.status === 'disabled').length,
    };

    return {
        indexers: joinedIndexers,
        healthMessages: mappedHealthMessages,
        summary,
    };
}

export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<ProwlarrPollResult> {
    const [indexersRes, statusRes, healthRes] = await Promise.all([
        adapter.get!(instance, '/api/v1/indexer', { timeout: 10000 }),
        adapter.get!(instance, '/api/v1/indexerstatus', { timeout: 10000 }),
        adapter.get!(instance, '/api/v1/health', { timeout: 10000 }),
    ]);

    const indexers = (Array.isArray(indexersRes.data) ? indexersRes.data : []) as RawIndexer[];
    const statuses = (Array.isArray(statusRes.data) ? statusRes.data : []) as RawIndexerStatus[];
    const healthMessages = (Array.isArray(healthRes.data) ? healthRes.data : []) as RawHealthMessage[];

    return joinIndexerHealth(indexers, statuses, healthMessages);
}

// ============================================================================
// APPLICATIONS SUBTYPE
// ============================================================================

export const appsIntervalMs = 60000;

export async function pollApplications(
    instance: PluginInstance,
    adapter: PluginAdapter
): Promise<ProwlarrApplication[]> {
    const response = await adapter.get!(instance, '/api/v1/applications', { timeout: 10000 });
    const apps = Array.isArray(response.data) ? response.data : [];

    return apps.map((app: Record<string, unknown>) => ({
        id: app.id as number,
        name: app.name as string,
        syncLevel: String(app.syncLevel ?? ''),
        implementation: String(app.implementation ?? ''),
    }));
}

export const subtypes = {
    apps: {
        intervalMs: appsIntervalMs,
        poll: pollApplications,
    },
};
