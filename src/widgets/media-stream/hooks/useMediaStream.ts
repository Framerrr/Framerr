/**
 * useMediaStream Hook
 *
 * Manages media session data via SSE topic subscription.
 * Supports Plex, Jellyfin, and Emby through adapter pattern.
 *
 * Phase 4: Refactored from usePlexSessions to support multi-integration.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import { widgetFetch } from '../../../utils/widgetFetch';
import { useMediaServerMeta } from '../../../shared/hooks/useMediaServerMeta';
import logger from '../../../utils/logger';
import { getAdapter, type MediaSession, type IntegrationType } from '../adapters';

// ============================================================================
// TYPES
// ============================================================================

interface UseMediaStreamProps {
    integrationId: string | undefined;
    integrationType: IntegrationType;
    isIntegrationBound: boolean;
}

interface UseMediaStreamReturn {
    sessions: MediaSession[];
    loading: boolean;
    error: string | null;
    /** True during first 5 seconds of subscription - errors are suppressed during this time */
    isInitializing: boolean;
    machineId: string | null;
    /** Server web URL for Jellyfin/Emby deep links */
    serverUrl: string | null;
    lastUpdateTime: number;
    refreshSessions: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export const useMediaStream = ({
    integrationId,
    integrationType,
    isIntegrationBound,
}: UseMediaStreamProps): UseMediaStreamReturn => {
    const [sessions, setSessions] = useState<MediaSession[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const lastUpdateRef = useRef<number>(Date.now());
    const initTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Shared hook for machineId (Plex) and serverUrl (Jellyfin/Emby)
    const integrationIds = useMemo(
        () => (integrationId ? [integrationId] : []),
        [integrationId]
    );
    const { machineIds, serverUrls } = useMediaServerMeta(integrationIds, 'media-stream');
    const machineId = integrationId ? (machineIds[integrationId] ?? null) : null;
    const serverUrl = integrationId ? (serverUrls[integrationId] ?? null) : null;

    // Get the appropriate adapter for this integration type
    const adapter = getAdapter(integrationType);

    // Clear sessions and start grace period when integration changes
    // Grace period prevents false "failed to connect" errors during initial WS connection
    useEffect(() => {
        setSessions([]);
        setError(null);
        setIsInitializing(true);

        // Clear any existing timeout
        if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
        }

        // Grace period: 5 seconds before showing errors
        initTimeoutRef.current = setTimeout(() => {
            setIsInitializing(false);
        }, 5000);

        logger.debug('[MediaStream] Integration changed, clearing sessions and starting grace period', {
            integrationId,
            integrationType,
        });

        return () => {
            if (initTimeoutRef.current) {
                clearTimeout(initTimeoutRef.current);
            }
        };
    }, [integrationId, integrationType]);

    // Update lastUpdate time when sessions change from server
    useEffect(() => {
        lastUpdateRef.current = Date.now();
    }, [sessions]);

    // Use SSE hook for real-time session updates
    // Each integration type (plex, jellyfin, emby) has its own SSE topic format
    const { loading } = useIntegrationSSE<{ sessions?: unknown[]; items?: unknown[]; _meta?: unknown }>({
        integrationType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            // Extract raw sessions - handle both realtime (sessions) and poller (items) formats
            // Realtime managers return: { sessions: [...] }
            // Poller orchestrator wraps arrays as: { items: [...] }
            const rawSessions = data?.sessions || data?.items || [];

            // Validate session data format matches expected integration type
            // This prevents stale data from wrong integration during switching
            if (rawSessions.length > 0) {
                const sample = rawSessions[0] as Record<string, unknown>;

                // Plex sessions have sessionKey, Jellyfin/Emby have DeviceId
                const looksLikePlex = 'sessionKey' in sample;
                const looksLikeJellyfinEmby = 'DeviceId' in sample || 'Id' in sample;

                if (integrationType === 'plex' && !looksLikePlex) {
                    logger.debug('[MediaStream] Ignoring non-Plex data on Plex topic', {
                        integrationType,
                        sampleKeys: Object.keys(sample).slice(0, 5),
                    });
                    return; // Ignore mismatched data
                }
                if ((integrationType === 'jellyfin' || integrationType === 'emby') && !looksLikeJellyfinEmby) {
                    logger.debug('[MediaStream] Ignoring non-Jellyfin/Emby data', {
                        integrationType,
                        sampleKeys: Object.keys(sample).slice(0, 5),
                    });
                    return; // Ignore mismatched data
                }
            }

            // Normalize sessions using the adapter
            const normalizedSessions = rawSessions.map((raw) =>
                adapter.normalize(raw, integrationId || '')
            );
            setSessions(normalizedSessions);
            setError(null);

            // First successful data - end grace period immediately
            if (isInitializing) {
                setIsInitializing(false);
                if (initTimeoutRef.current) {
                    clearTimeout(initTimeoutRef.current);
                }
            }

            logger.debug('[MediaStream] Received SSE update', {
                sessionCount: normalizedSessions.length,
                integrationType,
                integrationId,
            });
        },
        onError: (err) => {
            // Only set error if grace period has expired
            // This prevents false errors during initial connection
            if (!isInitializing) {
                logger.error('[MediaStream] SSE error', { error: err, integrationType });
                setError('Failed to connect to real-time updates');
            } else {
                logger.debug('[MediaStream] SSE error during grace period (suppressed)', { error: err, integrationType });
            }
        },
    });

    // Refresh sessions manually (called after stopping a session)
    // Only Plex has a /proxy/sessions GET endpoint — Jellyfin/Emby updates arrive via SSE
    const refreshSessions = useCallback(async (): Promise<void> => {
        if (!integrationId) return;

        // Jellyfin/Emby don't have a sessions polling endpoint — SSE handles updates
        if (integrationType !== 'plex') return;

        try {
            const response = await widgetFetch(
                `/api/integrations/${integrationId}/proxy/sessions`,
                'media-stream'
            );
            if (response.ok) {
                const result = await response.json();
                // Normalize the raw sessions
                const rawSessions = result.sessions || result || [];
                const normalizedSessions = (Array.isArray(rawSessions) ? rawSessions : []).map(
                    (raw: unknown) => adapter.normalize(raw, integrationId)
                );
                setSessions(normalizedSessions);
            }
        } catch (err) {
            logger.error('[MediaStream] Error refreshing sessions', {
                error: (err as Error).message,
                integrationType,
            });
        }
    }, [integrationId, adapter, integrationType]);



    return {
        sessions,
        loading,
        error,
        isInitializing,
        machineId,
        serverUrl,
        lastUpdateTime: lastUpdateRef.current,
        refreshSessions,
    };
};

export default useMediaStream;
