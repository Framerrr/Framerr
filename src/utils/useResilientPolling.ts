import { useState, useEffect, useRef, useCallback } from 'react';
import logger from './logger';

interface UseResilientPollingOptions<T> {
    /** Function that fetches the data */
    fetchFn: () => Promise<T>;
    /** Polling interval in milliseconds (default: 10000) */
    interval?: number;
    /** Number of immediate retries on failure (default: 3) */
    retries?: number;
    /** Delay between retries in milliseconds (default: 1000) */
    retryDelay?: number;
    /** Whether polling should be enabled (default: true) */
    enabled?: boolean;
    /** Name for logging purposes */
    name?: string;
}

interface UseResilientPollingResult<T> {
    /** The fetched data */
    data: T | null;
    /** Loading state (only true on initial load) */
    loading: boolean;
    /** Error message if all retries failed */
    error: string | null;
    /** Manually trigger a refresh */
    refresh: () => Promise<void>;
}

/**
 * Hook for resilient polling with automatic retry on failure.
 * - On failure: retries 3 times with 1s delay
 * - If all retries fail: shows error but continues polling
 * - On success: auto-clears any previous error
 * - On visibility change: triggers immediate fetch if there was an error
 */
export function useResilientPolling<T>({
    fetchFn,
    interval = 10000,
    retries = 3,
    retryDelay = 1000,
    enabled = true,
    name = 'Widget'
}: UseResilientPollingOptions<T>): UseResilientPollingResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef<boolean>(true);
    const errorRef = useRef<string | null>(null);

    // Keep errorRef in sync with error state
    useEffect(() => {
        errorRef.current = error;
    }, [error]);

    const fetchWithRetry = useCallback(async (retriesLeft: number = retries): Promise<void> => {
        try {
            const result = await fetchFn();
            if (mountedRef.current) {
                setData(result);
                setError(null);
                setLoading(false);
            }
        } catch (err) {
            if (!mountedRef.current) return;

            if (retriesLeft > 0) {
                logger.debug(`[${name}] Fetch failed, retrying in ${retryDelay}ms (${retriesLeft} retries left)`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return fetchWithRetry(retriesLeft - 1);
            }

            const errorMessage = (err as Error).message || 'Failed to fetch';
            logger.error(`[${name}] All retries failed`, { error: errorMessage });
            setError(errorMessage);
            setLoading(false);
        }
    }, [fetchFn, retries, retryDelay, name]);

    // Initial fetch and polling
    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        mountedRef.current = true;
        fetchWithRetry();

        const intervalId = setInterval(() => {
            fetchWithRetry();
        }, interval);

        return () => {
            mountedRef.current = false;
            clearInterval(intervalId);
        };
    }, [enabled, interval, fetchWithRetry]);

    // Refresh on visibility change if there was an error
    useEffect(() => {
        const handleVisibilityChange = (): void => {
            if (!document.hidden && errorRef.current && enabled) {
                logger.info(`[${name}] Tab visible with error, refreshing`);
                fetchWithRetry();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, fetchWithRetry, name]);

    const refresh = useCallback(async (): Promise<void> => {
        await fetchWithRetry();
    }, [fetchWithRetry]);

    return { data, loading, error, refresh };
}

export default useResilientPolling;
