/**
 * useFetchWithRetry - Reusable data fetching hook with automatic retry logic
 * 
 * Used by: PlexWidget, SonarrWidget, RadarrWidget, OverseerrWidget, QBittorrentWidget, SystemStatusWidget
 * 
 * Features:
 * - Configurable retry count and delay
 * - Optional polling interval
 * - Loading/error state management
 * - Manual refetch capability
 * 
 * @example
 * const { data, loading, error, refetch } = useFetchWithRetry<SessionData[]>({
 *     url: '/api/proxy/plex/sessions',
 *     enabled: isIntegrationEnabled,
 *     pollingInterval: 10000
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// SECTION: Types
// ============================================================================

export interface UseFetchWithRetryOptions<T> {
    /** API endpoint to fetch from */
    url: string;
    /** Widget type for X-Widget-Type header (required for proxy routes) */
    widgetType?: string;
    /** Whether fetching is enabled (default: true) */
    enabled?: boolean;
    /** Number of retries on failure (default: 3) */
    retries?: number;
    /** Delay between retries in ms (default: 1000) */
    retryDelay?: number;
    /** Optional polling interval in ms (no polling if undefined) */
    pollingInterval?: number;
    /** Optional transform function for the response data */
    transform?: (data: unknown) => T;
    /** Dependencies that trigger a refetch when changed */
    deps?: unknown[];
}

export interface UseFetchWithRetryResult<T> {
    /** The fetched data, or null if not yet loaded */
    data: T | null;
    /** True while initial fetch is in progress */
    loading: boolean;
    /** Error message if fetch failed after all retries */
    error: string | null;
    /** Manually trigger a refetch */
    refetch: () => Promise<void>;
}

// ============================================================================
// SECTION: Hook Implementation
// ============================================================================

export function useFetchWithRetry<T = unknown>(
    options: UseFetchWithRetryOptions<T>
): UseFetchWithRetryResult<T> {
    const {
        url,
        widgetType,
        enabled = true,
        retries = 3,
        retryDelay = 1000,
        pollingInterval,
        transform,
        deps = []
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Track if component is mounted to avoid state updates after unmount
    const mountedRef = useRef(true);

    // Memoize the fetch function
    const fetchWithRetry = useCallback(async (retriesLeft: number = retries): Promise<void> => {
        try {
            // Build headers - include X-Widget-Type if provided
            const headers: Record<string, string> = {};
            if (widgetType) {
                headers['X-Widget-Type'] = widgetType;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const transformedData = transform ? transform(result) : result as T;

            if (mountedRef.current) {
                setData(transformedData);
                setError(null);
                setLoading(false);
            }
        } catch (err) {
            if (retriesLeft > 0) {
                // Retry after delay
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return fetchWithRetry(retriesLeft - 1);
            }

            if (mountedRef.current) {
                setError((err as Error).message);
                setLoading(false);
            }
        }
    }, [url, widgetType, retries, retryDelay, transform]);

    // Public refetch function
    const refetch = useCallback(async (): Promise<void> => {
        setLoading(true);
        await fetchWithRetry();
    }, [fetchWithRetry]);

    // Main effect for initial fetch and polling
    useEffect(() => {
        mountedRef.current = true;

        if (!enabled) {
            setLoading(false);
            return;
        }

        // Initial fetch
        setLoading(true);
        fetchWithRetry();

        // Set up polling if interval specified
        let intervalId: ReturnType<typeof setInterval> | undefined;
        if (pollingInterval && pollingInterval > 0) {
            intervalId = setInterval(() => fetchWithRetry(), pollingInterval);
        }

        return () => {
            mountedRef.current = false;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, url, pollingInterval, ...deps]);

    return { data, loading, error, refetch };
}

export default useFetchWithRetry;
