/**
 * useTautulliStats - On-demand Top Movies/TV/Users fetch
 *
 * Replaces the old SSE `stats` subscription. Tautulli's get_home_stats
 * aggregates server-side by time_range, so a per-widget-configurable window
 * can't be served by a shared SSE broadcast (one poll → every subscriber) —
 * it needs its own request per widget instance, same pattern as Radarr's
 * on-demand /proxy/missing and /proxy/cutoff fetches (useRadarrData.ts).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../../../api/client';
import type { TautulliStatCategory } from '../tautulli.types';

const REFRESH_INTERVAL_MS = 300_000; // 5 minutes — matches the old SSE cadence

interface UseTautulliStatsOptions {
    integrationId: string | undefined;
    timeRange: number;
    /** How many list rows the widget may show (heroes need a few extra) */
    listItemCount: number;
    enabled: boolean;
}

interface UseTautulliStatsResult {
    stats: TautulliStatCategory[];
    statsLoading: boolean;
    statsError: string | null;
}

export function useTautulliStats({
    integrationId,
    timeRange,
    listItemCount,
    enabled,
}: UseTautulliStatsOptions): UseTautulliStatsResult {
    const [stats, setStats] = useState<TautulliStatCategory[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);
    const loadingRef = useRef(false);

    // Featured band ≤3 + list rows; clamp to proxy max of 55
    const fetchCount = Math.min(55, Math.max(5, listItemCount) + 3);

    const fetchStats = useCallback(async () => {
        if (!integrationId) return;
        if (loadingRef.current) return;
        loadingRef.current = true;
        setStatsLoading(true);

        try {
            const data = await api.get<TautulliStatCategory[]>(
                `/api/integrations/${integrationId}/proxy/stats?timeRange=${timeRange}&count=${fetchCount}`,
                { headers: { 'X-Widget-Type': 'tautulli' } }
            );
            setStats(Array.isArray(data) ? data : []);
            setStatsError(null);
        } catch (err) {
            setStatsError((err as Error).message || 'Failed to load stats');
        } finally {
            loadingRef.current = false;
            setStatsLoading(false);
        }
    }, [integrationId, timeRange, fetchCount]);

    useEffect(() => {
        setStats([]);
        setStatsError(null);
        if (!enabled || !integrationId) return;
        fetchStats();
    }, [integrationId, timeRange, fetchCount, enabled, fetchStats]);

    useEffect(() => {
        if (!enabled || !integrationId) return;
        const interval = setInterval(fetchStats, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [enabled, integrationId, fetchStats]);

    return { stats, statsLoading, statsError };
}
