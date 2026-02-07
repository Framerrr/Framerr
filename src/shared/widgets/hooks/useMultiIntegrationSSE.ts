/**
 * useMultiIntegrationSSE Hook
 * 
 * Reusable hook for subscribing to multiple integration instances via SSE.
 * Manages subscriptions internally via a Map to satisfy React hook rules
 * (fixed hook count per render).
 * 
 * Usage:
 * ```
 * const { loading, allData } = useMultiIntegrationSSE({
 *     integrationType: 'sonarr',
 *     subtype: 'calendar',
 *     integrationIds: ['sonarr-abc', 'sonarr-def'],
 *     onData: (instanceId, data) => handleData(instanceId, data),
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useRealtimeSSE from '../../../hooks/useRealtimeSSE';
import logger from '../../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UseMultiIntegrationSSEOptions<T> {
    /** Integration type (e.g., 'sonarr', 'radarr') */
    integrationType: string;
    /** Optional subtype for specialized data (e.g., 'calendar', 'queue') */
    subtype?: string;
    /** Array of instance IDs to subscribe to */
    integrationIds: string[];
    /** Callback when data is received for an instance */
    onData: (instanceId: string, data: T) => void;
    /** Optional callback when subscription errors */
    onError?: (instanceId: string, error: Error) => void;
    /** Whether to enable the subscriptions (default: true) */
    enabled?: boolean;
}

export interface UseMultiIntegrationSSEResult {
    /** True if any instance is still loading initial data */
    loading: boolean;
    /** Which instances are still loading */
    loadingInstances: string[];
    /** Which instances are connected and receiving data */
    connectedInstances: string[];
    /** Which instances have reported errors (service unavailable) */
    erroredInstances: string[];
    /** True if all bound instances are errored */
    allErrored: boolean;
    /** Whether SSE connection is established */
    isConnected: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useMultiIntegrationSSE<T>({
    integrationType,
    subtype,
    integrationIds,
    onData,
    onError,
    enabled = true,
}: UseMultiIntegrationSSEOptions<T>): UseMultiIntegrationSSEResult {
    const { subscribeToTopic, connectionId, isConnected } = useRealtimeSSE();

    // Track subscription state per instance
    const [loadingInstances, setLoadingInstances] = useState<string[]>([]);
    const [connectedInstances, setConnectedInstances] = useState<string[]>([]);
    const [erroredInstances, setErroredInstances] = useState<string[]>([]);

    // Store unsubscribe functions keyed by instanceId
    const unsubscribesRef = useRef<Map<string, () => void>>(new Map());

    // Keep callbacks in refs to prevent effect re-runs
    const onDataRef = useRef(onData);
    onDataRef.current = onData;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // CRITICAL: Stabilize integrationIds to prevent infinite loops
    // Arrays cause useEffect to re-run on every render since [] !== []
    const stableIdsKey = useMemo(() =>
        JSON.stringify([...integrationIds].sort()),
        [integrationIds]
    );

    // Build topic string for an instance
    const buildTopic = useCallback((instanceId: string) => {
        return subtype
            ? `${integrationType}:${subtype}:${instanceId}`
            : `${integrationType}:${instanceId}`;
    }, [integrationType, subtype]);

    useEffect(() => {
        // Parse the stable key back to array
        const currentIds: string[] = JSON.parse(stableIdsKey);

        // If disabled or no IDs, cleanup and exit
        if (!enabled || currentIds.length === 0) {
            setLoadingInstances([]);
            setConnectedInstances([]);
            setErroredInstances([]);
            // Cleanup existing subscriptions
            unsubscribesRef.current.forEach(unsub => unsub());
            unsubscribesRef.current.clear();
            return;
        }

        // If no connection yet, mark all as loading
        if (!connectionId) {
            setLoadingInstances(currentIds);
            setConnectedInstances([]);
            setErroredInstances([]);
            return;
        }

        // Diff current subscriptions vs desired
        const existingIds = new Set(unsubscribesRef.current.keys());
        const desiredIds = new Set(currentIds);

        // Unsubscribe from removed instances
        for (const instanceId of existingIds) {
            if (!desiredIds.has(instanceId)) {
                const unsub = unsubscribesRef.current.get(instanceId);
                if (unsub) {
                    logger.debug(`[useMultiIntegrationSSE] Unsubscribing from ${buildTopic(instanceId)}`);
                    unsub();
                    unsubscribesRef.current.delete(instanceId);
                }
            }
        }

        // Subscribe to new instances
        for (const instanceId of desiredIds) {
            if (!existingIds.has(instanceId)) {
                const topic = buildTopic(instanceId);
                logger.debug(`[useMultiIntegrationSSE] Subscribing to ${topic}`);

                // Mark as loading
                setLoadingInstances(prev =>
                    prev.includes(instanceId) ? prev : [...prev, instanceId]
                );

                // Subscribe
                subscribeToTopic(topic, (data) => {
                    // Detect backend error broadcast (service unavailable after repeated poll failures)
                    if (data && typeof data === 'object' && '_error' in data && (data as { _error?: boolean })._error === true) {
                        const errorMessage = (data as { _message?: string })._message || 'Service unavailable';
                        logger.debug(`[useMultiIntegrationSSE] Backend error for ${instanceId}: ${errorMessage}`);
                        setLoadingInstances(prev => prev.filter(id => id !== instanceId));
                        setErroredInstances(prev =>
                            prev.includes(instanceId) ? prev : [...prev, instanceId]
                        );
                        // Remove from connected if previously connected
                        setConnectedInstances(prev => prev.filter(id => id !== instanceId));
                        onErrorRef.current?.(instanceId, new Error(errorMessage));
                        return;
                    }

                    // Mark as connected, remove from loading and errored
                    setLoadingInstances(prev => prev.filter(id => id !== instanceId));
                    setErroredInstances(prev => prev.filter(id => id !== instanceId));
                    setConnectedInstances(prev =>
                        prev.includes(instanceId) ? prev : [...prev, instanceId]
                    );
                    onDataRef.current(instanceId, data as T);
                }).then(unsub => {
                    unsubscribesRef.current.set(instanceId, unsub);
                }).catch(err => {
                    logger.error(`[useMultiIntegrationSSE] Subscription failed for ${topic}:`, { error: err });
                    setLoadingInstances(prev => prev.filter(id => id !== instanceId));
                    onErrorRef.current?.(instanceId, err as Error);
                });
            }
        }

        // Update state for removed instances
        setConnectedInstances(prev => prev.filter(id => desiredIds.has(id)));
        setLoadingInstances(prev => prev.filter(id => desiredIds.has(id)));
        setErroredInstances(prev => prev.filter(id => desiredIds.has(id)));

        // Cleanup on unmount
        return () => {
            unsubscribesRef.current.forEach((unsub, instanceId) => {
                logger.debug(`[useMultiIntegrationSSE] Cleanup: unsubscribing from ${buildTopic(instanceId)}`);
                unsub();
            });
            unsubscribesRef.current.clear();
        };
    }, [enabled, connectionId, stableIdsKey, buildTopic, subscribeToTopic]);

    // Parse stable key for return value calculation
    const currentIdsForReturn: string[] = useMemo(() =>
        JSON.parse(stableIdsKey),
        [stableIdsKey]
    );

    // Compute allErrored: all bound instances have reported errors
    const allErrored = currentIdsForReturn.length > 0 &&
        erroredInstances.length === currentIdsForReturn.length;

    return {
        loading: loadingInstances.length > 0 || (currentIdsForReturn.length > 0 && connectedInstances.length === 0 && erroredInstances.length === 0),
        loadingInstances,
        connectedInstances,
        erroredInstances,
        allErrored,
        isConnected,
    };
}

export default useMultiIntegrationSSE;

