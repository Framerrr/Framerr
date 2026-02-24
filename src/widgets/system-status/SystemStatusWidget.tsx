/**
 * System Status Widget
 *
 * Displays CPU, Memory, Temperature, and Uptime metrics as card tiles
 * in a responsive 4-column priority grid.
 *
 * Layout modes:
 * - grid: Smart 4-column grid with span-based row packing (default)
 * - stacked: Forced single column, all metrics full-width
 *
 * Layout editing (resize, reorder, visibility) is handled in the
 * config modal via MetricLayoutEditor.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { isAdmin } from '../../utils/permissions';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useIntegrationSSE } from '../../shared/widgets/hooks/useIntegrationSSE';
import { useIntegrationSchemas } from '../../api/hooks';
import { useMetricHistoryStatus, useMetricHistoryConfig } from '../../api/hooks/useMetricHistoryConfig';
import { queryKeys } from '../../api/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import useRealtimeSSE from '../../hooks/useRealtimeSSE';
import MetricGraphPopover from './popovers/MetricGraphPopover';
import NetworkMetricCard from './components/NetworkMetricCard';
import DiskMetricCard from './components/DiskMetricCard';
import { useMetricConfig, PackedMetric } from './hooks/useMetricConfig';
import { StatusData, SystemStatusWidgetProps } from './types';
import './styles.css';

/** Keys of StatusData that hold scalar metric values (excludes disks array) */
type StatusScalarKey = Exclude<keyof StatusData, 'disks'>;

// ============================================================================
// COLOR HELPERS
// ============================================================================

function getValueColor(value: number): string {
    if (value < 50) return 'var(--success)';
    if (value < 80) return 'var(--warning)';
    return 'var(--error)';
}

/**
 * Format a network speed value (bytes/sec) to a human-readable string.
 */
function formatNetworkSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function formatValue(key: string, value: number | string | null, unit: string): string {
    if (key === 'uptime') return String(value ?? '--');
    if (key === 'networkUp' || key === 'networkDown') {
        return formatNetworkSpeed(Number(value || 0));
    }
    const num = Number(value || 0);
    const decimals = key === 'temperature' ? 0 : 1;
    return `${num.toFixed(decimals)}${unit}`;
}

function getProgressWidth(key: string, value: number): number {
    if (key === 'temperature') return Math.min(value, 100);
    return value;
}

// ============================================================================
// METRIC CARD CLASSES BUILDER
// ============================================================================

function buildCardClasses(metric: PackedMetric, visibleCount: number): string {
    const classes = [
        'metric-card',
        `metric-card--span-${metric.effectiveSpan}`,
    ];

    if (metric.vizType === 'text') {
        classes.push('metric-card--vertical');
        if (visibleCount > 2) {
            classes.push('metric-card--borderless');
        }
    }

    return classes.filter(Boolean).join(' ');
}

// ============================================================================
// STATIC METRIC CARD (no popover)
// ============================================================================

interface MetricCardProps {
    metric: PackedMetric;
    value: number | string | null;
    visibleCount: number;
    /** Array status string for disk card badge (Unraid only) */
    arrayStatus?: string | null;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, value, visibleCount, arrayStatus }) => {
    const numValue = Number(value || 0);
    const cardClasses = buildCardClasses(metric, visibleCount);

    return (
        <div className={cardClasses}>
            <div className="metric-card__inner">
                <div className="metric-card__header">
                    <span className="metric-card__label">
                        <metric.icon size={14} />
                        {metric.label}
                        {/* Array status badge on disk card */}
                        {metric.key === 'diskUsage' && arrayStatus && (
                            <span className={`metric-card__badge metric-card__badge--${arrayStatus === 'healthy' ? 'success' : 'warning'}`}>
                                {arrayStatus}
                            </span>
                        )}
                    </span>
                    <span className="metric-card__value">
                        {formatValue(metric.key, value, metric.unit)}
                    </span>
                </div>
                {metric.vizType === 'progress' && (
                    <div className="metric-card__progress">
                        <div
                            className="metric-card__progress-fill"
                            style={{
                                width: `${getProgressWidth(metric.key, numValue)}%`,
                                backgroundColor: getValueColor(numValue),
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// PREVIEW / DEFAULT DATA
// ============================================================================

const PREVIEW_DATA: StatusData = {
    cpu: 45,
    memory: 68,
    temperature: 52,
    uptime: '14d 6h',
    diskUsage: null,
    arrayStatus: null,
    networkUp: null,
    networkDown: null,
    disks: [],
};

const DEFAULT_DATA: StatusData = {
    cpu: 0,
    memory: 0,
    temperature: 0,
    uptime: '--',
    diskUsage: null,
    arrayStatus: null,
    networkUp: null,
    networkDown: null,
    disks: [],
};

// ============================================================================
// MAIN WIDGET
// ============================================================================

const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({
    widget,
    previewMode = false,
}) => {
    const config = widget.config as Record<string, unknown> | undefined;

    // Get widget dimensions and header config for row arithmetic
    // At runtime, widget may be FramerrWidget (layout.h / mobileLayout.h) or WidgetData (h directly)
    const { isMobile } = useLayout();
    const fw = widget as unknown as { layout?: { h?: number }; mobileLayout?: { h?: number } };
    const widgetH = (isMobile ? fw.mobileLayout?.h : null) ?? fw.layout?.h ?? widget.h ?? 2;
    const showHeader = config?.showHeader !== false;

    const {
        packedMetrics,
        visibleCount,
        isInline,
        layout,
    } = useMetricConfig({
        widgetId: widget.id,
        config,
        widgetH,
        showHeader,
        // integrationType and statusData are provided in live mode below
    });

    // Grid class based on layout mode
    const gridClassName = `system-status-grid${layout === 'stacked' ? ' system-status-grid--stacked' : ''}`;
    const widgetClassName = `system-status-widget${isInline ? ' system-status--inline' : ''}`;

    // ========================================================================
    // PREVIEW MODE — render mock data without hooks
    // ========================================================================
    if (previewMode) {
        return (
            <div className={widgetClassName}>
                <div className={gridClassName}>
                    {packedMetrics.map((metric) => (
                        <MetricCard
                            key={metric.key}
                            metric={metric}
                            value={PREVIEW_DATA[metric.key as StatusScalarKey]}
                            visibleCount={visibleCount}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ========================================================================
    // LIVE MODE — hooks and data fetching
    // ========================================================================

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const configuredIntegrationId = config?.integrationId as string | undefined;

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('system-status', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    const [statusState, setStatusState] = useState<{
        sourceId: string | null;
        data: StatusData;
    }>({ sourceId: null, data: DEFAULT_DATA });


    const integrationType = integrationId?.split('-')[0] || 'glances';

    // Schema-driven metric discovery: which metrics does this integration type support?
    const { data: schemas } = useIntegrationSchemas();
    const { data: metricHistoryStatus } = useMetricHistoryStatus();
    const { data: integrationHistoryConfig } = useMetricHistoryConfig(integrationId);
    const globalHistoryEnabled = metricHistoryStatus?.enabled ?? false;
    const integrationHistoryMode = integrationHistoryConfig?.config?.mode ?? 'auto';
    const historyEnabled = globalHistoryEnabled && integrationHistoryMode !== 'off';
    const queryClient = useQueryClient();
    const { onSettingsInvalidate } = useRealtimeSSE();

    // SSE: Listen for metric-history toggle changes (broadcast by admin)
    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'metric-history') {
                queryClient.invalidateQueries({ queryKey: queryKeys.metricHistory.status() });
                if (integrationId) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.metricHistory.integration(integrationId) });
                }
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate, queryClient, integrationId]);
    const schemaInfo = schemas?.[integrationType];
    const schemaMetricKeys = useMemo(
        () => schemaInfo?.metrics?.map(m => m.key),
        [schemaInfo]
    );
    const recordableKeys = useMemo(
        () => new Set(schemaInfo?.metrics?.filter(m => m.recordable).map(m => m.key) ?? []),
        [schemaInfo]
    );
    const { loading, isConnected, isUnavailable, isAuthError } = useIntegrationSSE<StatusData>({
        integrationType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (sseData) => {
            setStatusState(prev => ({
                sourceId: integrationId || null,
                data: {
                    cpu: sseData.cpu ?? prev.data.cpu,
                    memory: sseData.memory ?? prev.data.memory,
                    temperature: sseData.temperature ?? prev.data.temperature,
                    uptime: sseData.uptime ?? prev.data.uptime,
                    diskUsage: sseData.diskUsage ?? null,
                    arrayStatus: sseData.arrayStatus ?? null,
                    networkUp: sseData.networkUp ?? null,
                    networkDown: sseData.networkDown ?? null,
                    disks: Array.isArray(sseData.disks) ? sseData.disks : [],
                }
            }));
        },
    });

    const statusData = useMemo(() => {
        return statusState.sourceId === integrationId
            ? statusState.data
            : DEFAULT_DATA;
    }, [statusState, integrationId]);

    // Re-compute metrics with integration type and live data for availability filtering
    // Only pass statusData for null-filtering AFTER we've received real SSE data
    // (otherwise DEFAULT_DATA's nulls hide metrics before they have a chance to appear)
    const hasReceivedData = statusState.sourceId === integrationId;
    const {
        packedMetrics: livePackedMetrics,
        visibleCount: liveVisibleCount,
        isInline: liveIsInline,
        layout: liveLayout,
    } = useMetricConfig({
        widgetId: widget.id,
        config,
        widgetH,
        showHeader,
        integrationType,
        statusData: hasReceivedData ? statusData : undefined,
        schemaMetricKeys,
    });

    // Early returns after hooks

    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="System Health" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="System Health" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="System Health" isAdmin={userIsAdmin} />;
    }

    if (loading || !isConnected) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (isUnavailable) {
        // Auth errors: admin sees specific message, users see generic unavailable
        if (isAuthError && userIsAdmin) {
            return <WidgetStateMessage variant="authError" serviceName="System Health" instanceName={effectiveDisplayName} isAdmin={userIsAdmin} />;
        }
        return <WidgetStateMessage variant="unavailable" serviceName="System Health" instanceName={effectiveDisplayName} />;
    }

    const liveGridClassName = `system-status-grid${liveLayout === 'stacked' ? ' system-status-grid--stacked' : ''}`;
    const liveWidgetClassName = `system-status-widget${liveIsInline ? ' system-status--inline' : ''}`;

    return (
        <div className={liveWidgetClassName}>
            <div className={liveGridClassName}>
                {livePackedMetrics.map((metric) => {
                    const value = statusData[metric.key as StatusScalarKey];
                    const numValue = Number(value || 0);

                    // Disk metrics — individual or collapsed card
                    if (metric.key === 'diskUsage' || metric.key.startsWith('disk-')) {
                        const diskCollapsed = config?.diskCollapsed !== 'individual'; // default collapsed
                        const diskSelection = config?.diskSelection as string[] | undefined;

                        // Filter disks by selection (empty/undefined = all)
                        const selectedDisks = statusData.disks.filter((d) =>
                            !diskSelection || diskSelection.length === 0 || diskSelection.includes(d.id)
                        );

                        if (metric.key === 'diskUsage') {
                            if (diskCollapsed || integrationType !== 'unraid') {
                                // Collapsed aggregate card (or non-unraid fallback)
                                if (integrationType === 'unraid' && selectedDisks.length > 0) {
                                    return (
                                        <DiskMetricCard
                                            key="disk-aggregate"
                                            disks={selectedDisks}
                                            isAggregate={true}
                                            isInline={liveIsInline}
                                            spanClass={`metric-card--span-${metric.effectiveSpan}`}
                                        />
                                    );
                                }
                                // Non-unraid or no disks: fall through to standard MetricCard
                            } else {
                                // Individual mode: skip the diskUsage metric slot,
                                // individual disk-{id} metrics handle rendering
                                return null;
                            }
                        }

                        // Individual disk card (key = "disk-{id}")
                        if (metric.key.startsWith('disk-')) {
                            const diskId = metric.key.slice(5); // strip "disk-" prefix
                            const disk = selectedDisks.find((d) => d.id === diskId);
                            if (disk) {
                                return (
                                    <DiskMetricCard
                                        key={disk.id}
                                        disk={disk}
                                        isAggregate={false}
                                        isInline={liveIsInline}
                                        spanClass={`metric-card--span-${metric.effectiveSpan}`}
                                    />
                                );
                            }
                            return null;
                        }
                    }

                    // Metrics with graph popover
                    if (metric.hasGraph) {
                        return (
                            <MetricGraphPopover
                                key={metric.key}
                                metric={metric.key}
                                value={numValue}
                                icon={metric.icon}
                                integrationId={integrationId}
                                historyEnabled={historyEnabled && recordableKeys.has(metric.key)}
                                spanClass={`metric-card--span-${metric.effectiveSpan}`}
                            />
                        );
                    }

                    // Network metrics — inline sparkline card
                    if (metric.key === 'networkUp' || metric.key === 'networkDown') {
                        return (
                            <NetworkMetricCard
                                key={metric.key}
                                metric={metric}
                                value={typeof value === 'number' ? value : null}
                                visibleCount={liveVisibleCount}
                            />
                        );
                    }

                    // Static metrics (no popover)
                    return (
                        <MetricCard
                            key={metric.key}
                            metric={metric}
                            value={value}
                            visibleCount={liveVisibleCount}
                            arrayStatus={metric.key === 'diskUsage' ? statusData.arrayStatus : undefined}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default SystemStatusWidget;

