/**
 * useProwlarrData - Data management hook for the Prowlarr widget
 *
 * Manages:
 * - SSE subscription for indexer health (object payload, not items)
 * - SSE subscription for applications strip (items wrapper)
 * - On-demand fetch for history + indexerstats
 * - Admin enable/disable with optimistic updates + toast feedback
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import api from '../../../api/client';
import { extractErrorMessage } from '../../../api';
import { useToasts } from '../../../context/notification';
import type {
    ProwlarrIndexerHealth,
    ProwlarrHealthMessage,
    ProwlarrSummary,
    ProwlarrApplication,
    ProwlarrWidgetData,
    ProwlarrHistoryResponse,
    ProwlarrHistoryEntry,
    ProwlarrIndexerStatsResponse,
    ProwlarrActivityData,
} from '../prowlarr.types';

const MIN_ACTION_DELAY = 2000;

function withMinDelay<T>(action: Promise<T>): Promise<T> {
    return Promise.all([action, new Promise((r) => setTimeout(r, MIN_ACTION_DELAY))]).then(([result]) => result);
}

/** Prowlarr history eventType → human label */
function formatEventLabel(eventType: string | undefined): string {
    switch ((eventType ?? '').toLowerCase()) {
        case 'indexerrss':
            return 'RSS sync';
        case 'indexerquery':
        case 'query':
            return 'Query';
        case 'grab':
        case 'releasegrabbed':
            return 'Grab';
        case 'indexerauth':
            return 'Auth';
        default:
            return eventType
                ? eventType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
                : 'Event';
    }
}

function pickHistoryDetail(data?: Record<string, string>): string | undefined {
    if (!data) return undefined;
    const keys = ['query', 'source', 'message', 'title', 'category', 'elapsedTime'];
    for (const key of keys) {
        const val = data[key];
        if (val && String(val).trim()) return String(val).trim();
    }
    return undefined;
}

interface UseProwlarrDataOpts {
    integrationId: string | undefined;
    enabled: boolean;
}

export function useProwlarrData({ integrationId, enabled }: UseProwlarrDataOpts): ProwlarrWidgetData {
    const [indexers, setIndexers] = useState<ProwlarrIndexerHealth[]>([]);
    const [healthMessages, setHealthMessages] = useState<ProwlarrHealthMessage[]>([]);
    const [summary, setSummary] = useState<ProwlarrSummary | null>(null);
    const [applications, setApplications] = useState<ProwlarrApplication[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [togglingIndexerId, setTogglingIndexerId] = useState<number | null>(null);
    const [testingIndexerId, setTestingIndexerId] = useState<number | null>(null);
    const [testingAll, setTestingAll] = useState(false);

    const toast = useToasts();
    const optimisticUntil = useRef(0);

    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setIndexers([]);
            setHealthMessages([]);
            setSummary(null);
            setApplications([]);
            setError(null);
            setTogglingIndexerId(null);
            setTestingIndexerId(null);
            setTestingAll(false);
        }
    }, [integrationId]);

    const { loading: mainLoading } = useIntegrationSSE<{
        indexers: ProwlarrIndexerHealth[];
        healthMessages: ProwlarrHealthMessage[];
        summary: ProwlarrSummary;
        _meta?: unknown;
    }>({
        integrationType: 'prowlarr',
        integrationId,
        enabled,
        onData: (data) => {
            if (Date.now() < optimisticUntil.current) return;

            setIndexers(Array.isArray(data?.indexers) ? data.indexers : []);
            setHealthMessages(Array.isArray(data?.healthMessages) ? data.healthMessages : []);
            setSummary(data?.summary ?? null);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load indexer health');
        },
    });

    useIntegrationSSE<{ items: ProwlarrApplication[]; _meta?: unknown }>({
        integrationType: 'prowlarr',
        subtype: 'apps',
        integrationId,
        enabled,
        onData: (data) => {
            const items = data?.items;
            setApplications(Array.isArray(items) ? items : []);
        },
        onError: () => {
            // Non-critical — applications strip just won't show
        },
    });

    const fetchActivity = useCallback(
        async (page = 1, startDate?: string, endDate?: string): Promise<ProwlarrActivityData> => {
            if (!integrationId) {
                return { stats: null, history: [], loading: false, error: 'No integration configured' };
            }

            try {
                const historyParams = new URLSearchParams({ page: String(page), pageSize: '25' });
                const statsParams = new URLSearchParams();
                if (startDate) statsParams.set('startDate', startDate);
                if (endDate) statsParams.set('endDate', endDate);

                const [historyData, statsData] = await Promise.all([
                    api.get<ProwlarrHistoryResponse>(
                        `/api/integrations/${integrationId}/proxy/history?${historyParams.toString()}`,
                        { headers: { 'X-Widget-Type': 'prowlarr' } }
                    ),
                    api.get<ProwlarrIndexerStatsResponse>(
                        `/api/integrations/${integrationId}/proxy/indexerstats?${statsParams.toString()}`,
                        { headers: { 'X-Widget-Type': 'prowlarr' } }
                    ),
                ]);

                const rows = statsData.indexers ?? [];
                const queries = rows.reduce((sum, r) => sum + (r.numberOfQueries ?? 0), 0);
                const grabs = rows.reduce((sum, r) => sum + (r.numberOfGrabs ?? 0), 0);
                const avgTimes = rows.map((r) => r.averageResponseTime ?? 0).filter((t) => t > 0);
                const avgResponseMs =
                    avgTimes.length > 0 ? Math.round(avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length) : 0;

                const indexerNameById = new Map(indexers.map((i) => [i.id, i.name]));

                const history: ProwlarrHistoryEntry[] = (historyData.records ?? []).map((raw) => {
                    const indexerId = raw.indexerId ?? 0;
                    const eventType = String(raw.eventType ?? '');
                    return {
                        id: raw.id,
                        date: raw.date,
                        eventType,
                        eventLabel: formatEventLabel(eventType),
                        indexerId,
                        indexerName:
                            raw.indexer?.name ||
                            indexerNameById.get(indexerId) ||
                            (indexerId ? `Indexer #${indexerId}` : 'Unknown indexer'),
                        successful: raw.successful !== false,
                        detail: pickHistoryDetail(raw.data) || raw.sourceTitle,
                    };
                });

                return {
                    stats: { queries, grabs, avgResponseMs },
                    history,
                    loading: false,
                    error: null,
                };
            } catch (err) {
                return {
                    stats: null,
                    history: [],
                    loading: false,
                    error: extractErrorMessage(err),
                };
            }
        },
        [integrationId, indexers]
    );

    const toggleIndexerEnabled = useCallback(
        async (indexerId: number, nextEnabled: boolean) => {
            if (!integrationId) return;

            const target = indexers.find((i) => i.id === indexerId);
            const indexerName = target?.name ?? `Indexer ${indexerId}`;

            setTogglingIndexerId(indexerId);
            optimisticUntil.current = Date.now() + MIN_ACTION_DELAY;

            const previousIndexers = indexers;
            setIndexers((prev) =>
                prev.map((idx) =>
                    idx.id === indexerId
                        ? {
                              ...idx,
                              enabled: nextEnabled,
                              status: nextEnabled ? 'healthy' : 'disabled',
                          }
                        : idx
                )
            );

            try {
                await withMinDelay(
                    api.post(`/api/integrations/${integrationId}/proxy/indexer/${indexerId}/enable`, {
                        enabled: nextEnabled,
                    })
                );

                toast.success(
                    nextEnabled ? 'Indexer Enabled' : 'Indexer Disabled',
                    `${indexerName} ${nextEnabled ? 'enabled' : 'disabled'}`
                );
            } catch (err) {
                setIndexers(previousIndexers);
                toast.error('Update Failed', extractErrorMessage(err));
            } finally {
                setTogglingIndexerId(null);
                optimisticUntil.current = 0;
            }
        },
        [integrationId, indexers, toast]
    );

    const testIndexer = useCallback(
        async (indexerId: number) => {
            if (!integrationId) return;

            const target = indexers.find((i) => i.id === indexerId);
            const indexerName = target?.name ?? `Indexer ${indexerId}`;

            setTestingIndexerId(indexerId);
            try {
                const result = await withMinDelay(
                    api.post<{ success: boolean; hasFailures?: boolean; message?: string | null }>(
                        `/api/integrations/${integrationId}/proxy/indexer/${indexerId}/test`
                    )
                );
                if (result.hasFailures) {
                    toast.error(indexerName, result.message?.trim() || 'Test failed');
                } else {
                    toast.success(indexerName, 'Test passed');
                }
            } catch (err) {
                toast.error('Test failed', extractErrorMessage(err));
            } finally {
                setTestingIndexerId(null);
            }
        },
        [integrationId, indexers, toast]
    );

    const testAllIndexers = useCallback(async () => {
        if (!integrationId) return;

        setTestingAll(true);
        try {
            const result = await withMinDelay(
                api.post<{ success: boolean; hasFailures?: boolean; message?: string | null }>(
                    `/api/integrations/${integrationId}/proxy/indexer/testall`
                )
            );
            if (result.hasFailures) {
                toast.error('Tests finished', result.message?.trim() || 'Some indexers failed');
            } else {
                toast.success('Tests finished', 'All indexers passed');
            }
        } catch (err) {
            toast.error('Test all failed', extractErrorMessage(err));
        } finally {
            setTestingAll(false);
        }
    }, [integrationId, toast]);

    return {
        indexers,
        healthMessages,
        summary,
        applications,
        loading: mainLoading,
        error,
        togglingIndexerId,
        testingIndexerId,
        testingAll,
        toggleIndexerEnabled,
        testIndexer,
        testAllIndexers,
        fetchActivity,
    };
}
