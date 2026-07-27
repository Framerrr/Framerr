/**
 * useDnsStatsData - SSE subscription and protection toggle for DNS Stats widget
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import api from '../../../api/client';
import { extractErrorMessage } from '../../../api';
import { useToasts } from '../../../context/notification';
import type { DnsStatsData, DnsStatsWidgetData } from '../api.types';

const MIN_ACTION_DELAY = 2000;

function withMinDelay<T>(action: Promise<T>): Promise<T> {
    return Promise.all([action, new Promise((r) => setTimeout(r, MIN_ACTION_DELAY))]).then(([result]) => result);
}

interface UseDnsStatsDataOpts {
    integrationType: string | undefined;
    integrationId: string | undefined;
    enabled: boolean;
}

export function useDnsStatsData({
    integrationType,
    integrationId,
    enabled,
}: UseDnsStatsDataOpts): DnsStatsWidgetData {
    const [data, setData] = useState<DnsStatsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [togglingProtection, setTogglingProtection] = useState(false);

    const toast = useToasts();
    const optimisticUntil = useRef(0);
    const pauseAnchorRef = useRef<{ base: number; receivedAt: number } | null>(null);
    const [displayedPauseRemaining, setDisplayedPauseRemaining] = useState<number | null>(null);

    const prevIntegrationRef = useRef(integrationId);
    useEffect(() => {
        if (prevIntegrationRef.current !== integrationId) {
            prevIntegrationRef.current = integrationId;
            setData(null);
            setError(null);
            setTogglingProtection(false);
        }
    }, [integrationId]);

    const { loading: isLoading } = useIntegrationSSE<DnsStatsData>({
        integrationType: integrationType ?? '',
        integrationId,
        enabled: enabled && !!integrationType,
        onData: (incoming) => {
            if (Date.now() < optimisticUntil.current) return;
            setData(incoming ?? null);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load DNS stats');
        },
    });

    useEffect(() => {
        const serverRemaining = data?.pauseRemaining ?? null;
        if (serverRemaining === null) {
            pauseAnchorRef.current = null;
            setDisplayedPauseRemaining(null);
            return;
        }
        pauseAnchorRef.current = { base: serverRemaining, receivedAt: Date.now() };
        setDisplayedPauseRemaining(serverRemaining);
    }, [data?.pauseRemaining]);

    useEffect(() => {
        if (pauseAnchorRef.current === null) return;
        const interval = setInterval(() => {
            const anchor = pauseAnchorRef.current;
            if (!anchor) return;
            const elapsed = Math.floor((Date.now() - anchor.receivedAt) / 1000);
            setDisplayedPauseRemaining(Math.max(0, anchor.base - elapsed));
        }, 1000);
        return () => clearInterval(interval);
    }, [data?.pauseRemaining]);

    const toggleProtection = useCallback(
        async (enabled: boolean, duration?: number) => {
            if (!integrationId) return;

            setTogglingProtection(true);
            optimisticUntil.current = Date.now() + MIN_ACTION_DELAY;

            const previousData = data;
            setData((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    protectionEnabled: enabled,
                    // Show pause countdown immediately; next poll corrects remaining seconds
                    pauseRemaining:
                        enabled === false && duration !== undefined && duration > 0
                            ? duration
                            : null,
                };
            });

            try {
                await withMinDelay(
                    api.post(`/api/integrations/${integrationId}/proxy/protection/toggle`, {
                        enabled,
                        ...(duration !== undefined ? { duration } : {}),
                    })
                );

                if (enabled === false && duration !== undefined) {
                    toast.success('Protection Paused', `Protection disabled for ${Math.round(duration / 60)} minutes`);
                } else if (enabled) {
                    toast.success('Protection Enabled', 'DNS filtering is active');
                } else {
                    toast.success('Protection Disabled', 'DNS filtering is off');
                }
            } catch (err) {
                setData(previousData);
                toast.error('Update Failed', extractErrorMessage(err));
            } finally {
                setTogglingProtection(false);
                optimisticUntil.current = 0;
            }
        },
        [integrationId, data, toast]
    );

    return {
        data: data ? { ...data, pauseRemaining: displayedPauseRemaining } : null,
        isLoading,
        error,
        toggleProtection,
        togglingProtection,
    };
}
