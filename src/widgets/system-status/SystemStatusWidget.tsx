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

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { isAdmin } from '../../utils/permissions';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import MetricGraphPopover from './popovers/MetricGraphPopover';
import { useMetricConfig, PackedMetric } from './hooks/useMetricConfig';
import { StatusData, SystemStatusWidgetProps } from './types';
import './styles.css';

// ============================================================================
// COLOR HELPERS
// ============================================================================

function getValueColor(value: number): string {
    if (value < 50) return 'var(--success)';
    if (value < 80) return 'var(--warning)';
    return 'var(--error)';
}

function formatValue(key: string, value: number | string, unit: string): string {
    if (key === 'uptime') return String(value);
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

    if (!metric.hasProgress) {
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
    value: number | string;
    visibleCount: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, value, visibleCount }) => {
    const numValue = Number(value || 0);
    const cardClasses = buildCardClasses(metric, visibleCount);

    return (
        <div className={cardClasses}>
            <div className="metric-card__inner">
                <div className="metric-card__header">
                    <span className="metric-card__label">
                        <metric.icon size={14} />
                        {metric.label}
                    </span>
                    <span className="metric-card__value">
                        {formatValue(metric.key, value, metric.unit)}
                    </span>
                </div>
                {metric.hasProgress && (
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
    uptime: '14d 6h'
};

const DEFAULT_DATA: StatusData = {
    cpu: 0,
    memory: 0,
    temperature: 0,
    uptime: '--'
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
        visibleRows,
        isInline,
        layout,
    } = useMetricConfig({
        widgetId: widget.id,
        config,
        widgetH,
        showHeader,
    });

    // Grid class based on layout mode
    const gridClassName = `system-status-grid${layout === 'stacked' ? ' system-status-grid--stacked' : ''}`;
    const widgetClassName = `system-status-widget${isInline ? ' system-status--inline' : ''}`;
    // Even row distribution via CSS grid
    const gridStyle = { gridTemplateRows: `repeat(${visibleRows}, 1fr)` };

    // ========================================================================
    // PREVIEW MODE — render mock data without hooks
    // ========================================================================
    if (previewMode) {
        return (
            <div className={widgetClassName}>
                <div className={gridClassName} style={gridStyle}>
                    {packedMetrics.map((metric) => (
                        <MetricCard
                            key={metric.key}
                            metric={metric}
                            value={PREVIEW_DATA[metric.key as keyof StatusData]}
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
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('system-status', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const isGlances = integrationId?.startsWith('glances-');
    const historyEnabled = !isGlances;

    const [statusState, setStatusState] = useState<{
        sourceId: string | null;
        data: StatusData;
    }>({ sourceId: null, data: DEFAULT_DATA });

    const integrationType = integrationId?.split('-')[0] || 'glances';
    const { loading, isConnected } = useIntegrationSSE<StatusData>({
        integrationType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (sseData) => {
            setStatusState({
                sourceId: integrationId || null,
                data: {
                    cpu: sseData.cpu || 0,
                    memory: sseData.memory || 0,
                    temperature: sseData.temperature || 0,
                    uptime: sseData.uptime || '--'
                }
            });
        },
    });

    const statusData = useMemo(() => {
        return statusState.sourceId === integrationId
            ? statusState.data
            : DEFAULT_DATA;
    }, [statusState, integrationId]);

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

    return (
        <div className={widgetClassName}>
            <div className={gridClassName} style={gridStyle}>
                {packedMetrics.map((metric) => {
                    const value = statusData[metric.key as keyof StatusData];
                    const numValue = Number(value || 0);

                    // Metrics with graph popover
                    if (metric.hasGraph) {
                        return (
                            <MetricGraphPopover
                                key={metric.key}
                                metric={metric.key as 'cpu' | 'memory' | 'temperature'}
                                value={numValue}
                                icon={metric.icon}
                                integrationId={integrationId}
                                historyEnabled={historyEnabled}
                                spanClass={`metric-card--span-${metric.effectiveSpan}`}
                            />
                        );
                    }

                    // Static metrics (no popover)
                    return (
                        <MetricCard
                            key={metric.key}
                            metric={metric}
                            value={value}
                            visibleCount={visibleCount}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default SystemStatusWidget;

