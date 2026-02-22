/**
 * useIntegrationSSE Hook
 * 
 * Reusable hook for subscribing to real-time integration data via SSE.
 * Handles proper async cleanup to prevent subscription leaks when
 * integrationId changes (e.g., during fallback).
 * 
 * Usage:
 * ```
 * // Basic topic (qbittorrent:instanceId)
 * const { loading } = useIntegrationSSE({
 *   integrationType: 'qbittorrent',
 *   integrationId,
 *   onData: (data) => setTorrents(data.torrents),
 * });
 * 
 * // With subtype (sonarr:queue:instanceId)
 * const { loading } = useIntegrationSSE({
 *   integrationType: 'sonarr',
 *   subtype: 'queue',
 *   integrationId: sonarrInstanceId,
 *   onData: (data) => setQueueData(data),
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import useRealtimeSSE from '../../../hooks/useRealtimeSSE';
import logger from '../../../utils/logger';

export interface UseIntegrationSSEOptions<T> {
    /** Integration type (e.g., 'qbittorrent', 'glances', 'sonarr') */
    integrationType: string;
    /** Optional subtype for specialized data (e.g., 'queue' for sonarr:queue:id) */
    subtype?: string;
    /** Instance ID to subscribe to (e.g., 'qbittorrent-abc123') */
    integrationId: string | undefined;
    /** Callback when data is received */
    onData: (data: T) => void;
    /** Optional callback when subscription errors */
    onError?: (error: Error) => void;
    /** Whether to enable the subscription (default: true) */
    enabled?: boolean;
}

export interface UseIntegrationSSEResult {
    /** Whether we're waiting for initial data */
    loading: boolean;
    /** Current SSE connection ID */
    connectionId: string | null;
    /** Whether actively subscribed to a topic */
    isSubscribed: boolean;
    /** P9: Whether SSE is connected (for widget loading state coordination) */
    isConnected: boolean;
    /** Whether the service is unavailable (backend error broadcast received) */
    isUnavailable: boolean;
    /** Whether the error is a config issue (missing URL/API key) vs service outage */
    isConfigError: boolean;
    /** Whether the error is an auth issue (401/403, bad credentials) */
    isAuthError: boolean;
}

export function useIntegrationSSE<T>({
    integrationType,
    subtype,
    integrationId,
    onData,
    onError,
    enabled = true,
}: UseIntegrationSSEOptions<T>): UseIntegrationSSEResult {
    const { subscribeToTopic, connectionId, isConnected } = useRealtimeSSE();

    // Use ref for unsubscribe to fix async cleanup race condition
    // The ref persists across renders, so cleanup can access it even when
    // the promise resolves after the cleanup function runs
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const [loading, setLoading] = useState(true);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isUnavailable, setIsUnavailable] = useState(false);
    const [isConfigError, setIsConfigError] = useState(false);
    const [isAuthError, setIsAuthError] = useState(false);

    // Memoize the onData callback to prevent effect re-runs
    const onDataRef = useRef(onData);
    onDataRef.current = onData;

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    useEffect(() => {
        // If explicitly disabled, set loading false and exit
        if (!enabled) {
            setLoading(false);
            setIsSubscribed(false);
            return;
        }

        // If dependencies not ready (integrationId or connectionId), keep loading=true and wait
        if (!integrationId || !connectionId) {
            // Don't set loading=false! We're waiting for dependencies
            setIsSubscribed(false);
            return;
        }

        // Guard flag to prevent stale callbacks from firing after cleanup
        // This is critical when integrationId changes - old subscription may still
        // receive data during the async transition, and we must ignore it
        let isActive = true;

        // Build topic: type:instanceId or type:subtype:instanceId
        const topic = subtype
            ? `${integrationType}:${subtype}:${integrationId}`
            : `${integrationType}:${integrationId}`;

        logger.debug(`[useIntegrationSSE] Subscribing to ${topic}`);

        subscribeToTopic(topic, (data) => {
            // Ignore data if this effect has been cleaned up
            // This prevents stale data from old subscriptions during integration switch
            if (!isActive) {
                logger.debug(`[useIntegrationSSE] Ignoring stale data for ${topic}`);
                return;
            }

            // Detect backend error broadcast (service unavailable after repeated poll failures)
            if (data && typeof data === 'object' && '_error' in data && (data as { _error?: boolean })._error === true) {
                const errorMessage = (data as { _message?: string })._message || 'Service unavailable';
                const configError = (data as { _configError?: boolean })._configError === true;
                const authError = (data as { _authError?: boolean })._authError === true;
                logger.debug(`[useIntegrationSSE] Backend error for ${topic}: ${errorMessage}`);
                setIsUnavailable(true);
                setIsConfigError(configError);
                setIsAuthError(authError);
                onErrorRef.current?.(new Error(errorMessage));
                setLoading(false);
                return;
            }

            // Success - clear unavailable state and process data
            setIsUnavailable(false);
            setIsConfigError(false);
            setIsAuthError(false);
            onDataRef.current(data as T);
            setLoading(false);
        }).then(unsub => {
            // Only store unsubscribe if effect is still active
            if (isActive) {
                unsubscribeRef.current = unsub;
                setIsSubscribed(true);
            } else {
                // Effect was cleaned up before subscription completed - unsubscribe immediately
                unsub();
            }
        }).catch(err => {
            if (!isActive) return; // Ignore errors after cleanup
            logger.error(`[useIntegrationSSE] Subscription failed for ${topic}:`, { error: err });
            onErrorRef.current?.(err as Error);
            setLoading(false);
        });

        return () => {
            // Mark as inactive FIRST - this ensures any in-flight callbacks are ignored
            isActive = false;

            // Cleanup: unsubscribe if we have a function
            if (unsubscribeRef.current) {
                logger.debug(`[useIntegrationSSE] Unsubscribing from ${topic}`);
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            setIsSubscribed(false);
        };
    }, [enabled, integrationType, subtype, integrationId, connectionId, subscribeToTopic]);

    return {
        loading,
        connectionId,
        isSubscribed,
        isConnected,
        isUnavailable,
        isConfigError,
        isAuthError,
    };
}

export default useIntegrationSSE;

