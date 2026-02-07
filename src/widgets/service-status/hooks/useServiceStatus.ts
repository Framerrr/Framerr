/**
 * useServiceStatus Hook
 * 
 * Handles data fetching via SSE for service monitors.
 * Main monitor data comes via SSE (like Plex sessions).
 * Popover historical data uses HTTP on-demand.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import logger from '../../../utils/logger';
import { ServiceMonitor, MonitorStatusData, LayoutResult } from '../types';
import { calculateOptimalLayout } from '../utils/layoutUtils';
import { MonitorStatus } from '../../../components/common/StatusDot';

interface UseServiceStatusProps {
    integrationId?: string;
    isIntegrationBound: boolean;
}

interface UseServiceStatusReturn {
    monitors: ServiceMonitor[];
    statuses: Record<string, MonitorStatusData>;
    /** Timestamp when SSE data was received (for client-side timer calculation) */
    sseReceivedAt: number;
    loading: boolean;
    error: string | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    layout: LayoutResult;
    fetchData: () => Promise<void>;
    handleMaintenanceToggle: (monitorId: string, enabled: boolean) => Promise<void>;
}

// SSE data shape from server
interface MonitorSSEData {
    id: string;
    name: string;
    url: string | null;
    iconName: string | null;
    iconId: string | null;
    maintenance: boolean;
    status: 'up' | 'down' | 'degraded' | 'pending' | 'maintenance';
    responseTimeMs: number | null;
    lastCheck: string | null;
    uptimePercent: number | null;
    /** Monitor's configured check interval (for client-side timer calculation) */
    intervalSeconds: number;
}

export function useServiceStatus({
    integrationId,
    isIntegrationBound
}: UseServiceStatusProps): UseServiceStatusReturn {
    const [monitors, setMonitors] = useState<ServiceMonitor[]>([]);
    const [statuses, setStatuses] = useState<Record<string, MonitorStatusData>>({});
    const [sseReceivedAt, setSseReceivedAt] = useState<number>(Date.now());
    const [error, setError] = useState<string | null>(null);

    // Container measurement for adaptive layout
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Extract integration type from ID (e.g., 'monitor-abc123' -> 'monitor', 'uptimekuma-xyz' -> 'uptimekuma')
    const integrationType = integrationId?.split('-')[0] || 'monitor';

    // Use SSE for real-time monitor updates (same pattern as system-status)
    const { loading } = useIntegrationSSE<{ items: MonitorSSEData[]; _meta?: unknown }>({
        integrationType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            // SSE data is wrapped as {items: [...], _meta: {...}} to survive delta patching
            const items = data?.items;
            const monitorsArray = Array.isArray(items) ? items : [];

            // Convert SSE data to ServiceMonitor format
            const fetchedMonitors: ServiceMonitor[] = monitorsArray.map(m => ({
                id: m.id,
                name: m.name,
                url: m.url || '',
                iconName: m.iconName,
                iconId: m.iconId,
                maintenance: m.maintenance,
            } as ServiceMonitor));

            setMonitors(fetchedMonitors);

            // Build status map from monitors data
            const statusMap: Record<string, MonitorStatusData> = {};
            for (const m of monitorsArray) {
                statusMap[m.id] = {
                    monitorId: m.id,
                    status: m.status as MonitorStatus,
                    responseTimeMs: m.responseTimeMs,
                    lastCheck: m.lastCheck,
                    uptimePercent: m.uptimePercent,
                    maintenance: m.maintenance,
                    intervalSeconds: m.intervalSeconds ?? 60
                };
            }
            setStatuses(statusMap);
            setSseReceivedAt(Date.now()); // Track when SSE data was received
            setError(null);

            logger.debug('[ServiceStatus] Received SSE update', {
                monitorCount: monitorsArray.length,
                integrationId
            });
        },
        onError: (err) => {
            logger.error('[ServiceStatus] SSE error', { error: err });
            setError('Failed to connect to real-time updates');
        },
    });

    // Measure container size with ResizeObserver
    // Using resilient pattern: track observed element and re-run when containerRef becomes available
    const observedElementRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;

        // Skip if loading (container not rendered yet)
        if (loading) return;

        // Skip if no container or already observing this element
        if (!container || observedElementRef.current === container) return;

        // Track that we're now observing this element
        observedElementRef.current = container;

        const measureContainer = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };

        // Use requestAnimationFrame for initial measurement to ensure DOM has finished layout
        let rafId: number;
        let retryTimeoutId: ReturnType<typeof setTimeout>;

        rafId = requestAnimationFrame(() => {
            measureContainer();

            // If still 0, retry after a short delay (grid might still be calculating)
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    retryTimeoutId = setTimeout(measureContainer, 50);
                }
            }
        });

        const resizeObserver = new ResizeObserver(() => {
            measureContainer();
        });

        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(retryTimeoutId);
            resizeObserver.disconnect();
            observedElementRef.current = null;
        };
    }, [loading, containerRef.current]); // Re-run when loading changes OR containerRef.current becomes available

    // Calculate layout based on container size and monitor count
    const layout = useMemo(() => {
        if (containerSize.width === 0 || containerSize.height === 0) {
            return {
                cardSize: 64,
                cardsPerRow: 4,
                rowCount: 1,
                visibleCount: monitors.length,
                variant: 'expanded' as const
            };
        }

        // Use compact layout for short widgets (h=1 or h=2 with header)
        // Threshold 64px: h=2 without header measures ~65px, should be expanded
        const useCompact = containerSize.height < 64;

        // Determine padding before calculating layout
        const padding = useCompact ? 2 : 8;
        const availableWidth = containerSize.width - (padding * 2);
        const availableHeight = containerSize.height - (padding * 2);

        return calculateOptimalLayout(
            availableWidth,
            availableHeight,
            monitors.length,
            useCompact
        );
    }, [containerSize.width, containerSize.height, monitors.length]);

    // Provide a manual refresh (for after maintenance toggle, etc.)
    const fetchData = useCallback(async () => {
        // SSE handles updates automatically, but we can trigger integrationsUpdated event
        window.dispatchEvent(new CustomEvent('integrationsUpdated'));
    }, []);

    // Handle maintenance toggle with optimistic UI update
    const handleMaintenanceToggle = async (monitorId: string, enabled: boolean) => {
        // Store previous status for rollback
        const previousStatus = statuses[monitorId]?.status;

        // Optimistic update - change UI immediately
        // Update both maintenance boolean AND status field so StatusDot updates
        setStatuses(prev => {
            const current = prev[monitorId];
            if (!current) return prev;
            return {
                ...prev,
                [monitorId]: {
                    ...current,
                    maintenance: enabled,
                    // When entering maintenance, show 'maintenance' status
                    // When exiting, DON'T change status - SSE will update it on next poll
                    // (avoids showing 'pending' for 30-60s until poller runs)
                    ...(enabled ? { status: 'maintenance' as const } : {})
                }
            };
        });

        try {
            const res = await fetch(`/api/service-monitors/${monitorId}/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Framerr-Client': '1'
                },
                body: JSON.stringify({ enabled })
            });
            if (!res.ok) {
                // Rollback on failure - restore both maintenance and status
                setStatuses(prev => {
                    const current = prev[monitorId];
                    if (!current) return prev;
                    return {
                        ...prev,
                        [monitorId]: {
                            ...current,
                            maintenance: !enabled,
                            status: previousStatus || current.status
                        }
                    };
                });
                logger.error('Failed to toggle maintenance - rolled back');
            }
            // On success, SSE will confirm the change
        } catch (err) {
            // Rollback on error - restore both maintenance and status
            setStatuses(prev => {
                const current = prev[monitorId];
                if (!current) return prev;
                return {
                    ...prev,
                    [monitorId]: {
                        ...current,
                        maintenance: !enabled,
                        status: previousStatus || current.status
                    }
                };
            });
            logger.error('Failed to toggle maintenance', { error: err });
        }
    };

    return {
        monitors,
        statuses,
        sseReceivedAt,
        loading,
        error,
        containerRef,
        layout,
        fetchData,
        handleMaintenanceToggle
    };
}
