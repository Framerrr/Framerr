/**
 * MetricGraphPopover Component
 * 
 * Displays a clickable metric bar that opens a popover with historical graph data.
 * Used by SystemStatusWidget to show CPU, Memory, and Temperature metrics.
 * 
 * PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Popover } from '@/shared/ui';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import logger from '../../../utils/logger';
import { widgetFetch } from '../../../utils/widgetFetch';
import { usePopoverState } from '../../../hooks/usePopoverState';
import '../styles.css';

// ============================================================================
// Types
// ============================================================================

export type MetricType = 'cpu' | 'memory' | 'temperature';
export type TimeRange = '1h' | '6h' | '1d' | '3d';

export interface MetricConfig {
    label: string;
    color: string;
    unit: string;
}

export interface GraphDataPoint {
    time: string;
    cpu?: number;
    memory?: number;
    temp?: number;
    [key: string]: unknown;
}

export interface RechartsDataPoint {
    timestamp: number;
    value: number;
    formattedTime: string;
}

export interface SystemStatusIntegration {
    enabled?: boolean;
    backend?: 'glances' | 'custom';
    url?: string;
    token?: string;
    glances?: {
        url?: string;
        password?: string;
    };
    custom?: {
        url?: string;
        token?: string;
    };
}

export interface MetricGraphPopoverProps {
    metric: MetricType;
    value: number;
    icon: LucideIcon;
    integrationId?: string;
    /** Set to false to disable the graph popover (e.g., for Glances which has no /history endpoint) */
    historyEnabled?: boolean;
    /** CSS class for grid column span (e.g., 'metric-card--span-2') */
    spanClass?: string;
}

// ============================================================================
// Component
// ============================================================================

const MetricGraphPopover: React.FC<MetricGraphPopoverProps> = ({ metric, value, icon: Icon, integrationId, historyEnabled = true, spanClass = '' }) => {
    const { isOpen, onOpenChange } = usePopoverState();
    const [currentRange, setCurrentRange] = useState<TimeRange>('1h');
    const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
    const [loading, setLoading] = useState<boolean>(false);


    // Metric display configuration - memoized to prevent re-creation on every render
    const config: MetricConfig = useMemo(() => {
        const configs: Record<MetricType, MetricConfig> = {
            cpu: { label: 'CPU', color: 'var(--accent)', unit: '%' },
            memory: { label: 'Memory', color: 'var(--info)', unit: '%' },
            temperature: { label: 'Temperature', color: 'var(--warning)', unit: '°C' }
        };
        return configs[metric];
    }, [metric]);

    // Get computed color for chart (CSS variables resolved)
    const chartColor = useMemo(() => {
        const style = getComputedStyle(document.body);
        const colorMap: Record<MetricType, string> = {
            cpu: style.getPropertyValue('--accent').trim() || '#3b82f6',
            memory: style.getPropertyValue('--info').trim() || '#0ea5e9',
            temperature: style.getPropertyValue('--warning').trim() || '#f59e0b'
        };
        return colorMap[metric];
    }, [metric, isOpen]); // Re-compute when popover opens (theme may have changed)

    // Fetch graph data when popover opens
    useEffect(() => {
        if (!isOpen || !integrationId || !historyEnabled) return;

        const fetchGraphData = async (): Promise<void> => {
            setLoading(true);
            try {
                // Use ID-based proxy route
                const endpoint = `/api/integrations/${integrationId}/proxy/history`;

                const res = await widgetFetch(endpoint, 'system-status-history');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setGraphData(Array.isArray(data) ? data : []);
            } catch (err) {
                logger.error('Graph data fetch error:', err);
                setGraphData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchGraphData();
    }, [isOpen, integrationId, metric, historyEnabled]);

    // Transform data for Recharts
    const chartData: RechartsDataPoint[] = useMemo(() => {
        const ranges: Record<TimeRange, number> = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000
        };

        const timeFormats: Record<TimeRange, string> = {
            '1h': 'h:mm a',
            '6h': 'h a',
            '1d': 'ha',
            '3d': 'MMM d'
        };

        const now = Date.now();
        const cutoff = now - ranges[currentRange];
        const fieldName = metric === 'temperature' ? 'temp' : metric;

        return graphData
            .map(d => ({
                timestamp: new Date(d.time).getTime(),
                value: Number(d[fieldName]),
                formattedTime: format(new Date(d.time), timeFormats[currentRange])
            }))
            .filter(p => p.timestamp >= cutoff && Number.isFinite(p.value))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [graphData, currentRange, metric]);

    // Generate nice rounded tick values for X-axis
    const { niceTicks, formatTick } = useMemo(() => {
        const ranges: Record<TimeRange, number> = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000
        };

        // Tick intervals: 1h=15min, 6h=1hour, 1d=4hours, 3d=12hours
        const tickIntervals: Record<TimeRange, number> = {
            '1h': 15 * 60 * 1000,         // 15 minutes
            '6h': 60 * 60 * 1000,         // 1 hour
            '1d': 4 * 60 * 60 * 1000,     // 4 hours
            '3d': 12 * 60 * 60 * 1000     // 12 hours
        };

        const tickFormats: Record<TimeRange, string> = {
            '1h': 'h:mm a',
            '6h': 'h a',
            '1d': 'ha',
            '3d': 'MMM d ha'
        };

        const now = Date.now();
        const cutoff = now - ranges[currentRange];
        const interval = tickIntervals[currentRange];
        const tickFormat = tickFormats[currentRange];

        // Round cutoff UP to next interval
        const firstTick = Math.ceil(cutoff / interval) * interval;

        const ticks: number[] = [];
        for (let t = firstTick; t <= now; t += interval) {
            ticks.push(t);
        }

        return {
            niceTicks: ticks,
            formatTick: (ts: number) => format(new Date(ts), tickFormat)
        };
    }, [currentRange]);

    const getColor = (val: number): string => {
        if (val < 50) return 'var(--success)';
        if (val < 80) return 'var(--warning)';
        return 'var(--error)';
    };

    // Custom tooltip component for Recharts
    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: RechartsDataPoint }> }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            // Show exact time from timestamp, not the rounded axis format
            const exactTime = format(new Date(data.payload.timestamp), 'MMM d, h:mm:ss a');
            return (
                <div className="glass-card border-theme rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-theme-secondary mb-1">{exactTime}</p>
                    <p className="text-sm font-medium text-theme-primary">
                        {config.label}: <span style={{ color: chartColor }}>{data.value.toFixed(1)}{config.unit}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    // Static metric card (no popover) - used when history is disabled (e.g., Glances)
    const StaticMetricBar = (
        <div className={`metric-card ${spanClass}`}>
            <div className="metric-card__inner">
                <div className="metric-card__header">
                    <span className="metric-card__label">
                        <Icon size={14} />
                        {config.label}
                    </span>
                    <span className="metric-card__value">
                        {Number(value || 0).toFixed(metric === 'temperature' ? 0 : 1)}{config.unit}
                    </span>
                </div>
                <div className="metric-card__progress">
                    <div
                        className="metric-card__progress-fill"
                        style={{
                            width: `${metric === 'temperature' ? Math.min(value, 100) : value}%`,
                            backgroundColor: getColor(value)
                        }}
                    />
                </div>
            </div>
        </div>
    );

    // If history is disabled, render static bar without popover
    if (!historyEnabled) {
        return StaticMetricBar;
    }

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                <div className={`metric-card metric-card--clickable${isOpen ? ' metric-card--active' : ''} ${spanClass}`}>
                    <div className="metric-card__inner">
                        <div className="metric-card__header">
                            <span className="metric-card__label">
                                <Icon size={14} />
                                {config.label}
                            </span>
                            <span className="metric-card__value">
                                {Number(value || 0).toFixed(metric === 'temperature' ? 0 : 1)}{config.unit}
                            </span>
                        </div>
                        <div className="metric-card__progress">
                            <div
                                className="metric-card__progress-fill"
                                style={{
                                    width: `${metric === 'temperature' ? Math.min(value, 100) : value}%`,
                                    backgroundColor: getColor(value)
                                }}
                            />
                        </div>
                    </div>
                </div>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[550px] max-w-[90vw]"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-theme-primary">
                        {config.label} History
                    </h3>
                    {/* Range selector */}
                    <div className="flex gap-1">
                        {(['1h', '6h', '1d', '3d'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setCurrentRange(range)}
                                className={`text-xs px-2 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${currentRange === range
                                    ? 'bg-accent text-white'
                                    : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart */}
                <div style={{
                    height: '250px',
                    position: 'relative',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'none' // Prevent page scroll when swiping through chart
                }}>
                    {/* Show "no data" message only after loading completes with empty result */}
                    {!loading && chartData.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-theme-secondary text-sm">
                            No historical data available
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="timestamp"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    ticks={niceTicks}
                                    tickFormatter={formatTick}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    tickFormatter={(val) => `${val}${config.unit}`}
                                    width={50}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1 }}
                                />
                                <Area
                                    type="linear"
                                    dataKey="value"
                                    stroke={chartColor}
                                    strokeWidth={2}
                                    fill={`url(#gradient-${metric})`}
                                    dot={false}
                                    isAnimationActive={true}
                                    animationDuration={600}
                                    animationEasing="ease-out"
                                    activeDot={{
                                        r: 5,
                                        fill: chartColor,
                                        stroke: 'var(--bg-primary)',
                                        strokeWidth: 2
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Popover.Content>
        </Popover>
    );
};

export default MetricGraphPopover;
