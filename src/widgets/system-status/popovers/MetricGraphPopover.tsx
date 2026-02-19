/**
 * MetricGraphPopover Component
 * 
 * Displays a clickable metric bar that opens a popover with historical graph data.
 * Used by SystemStatusWidget to show CPU, Memory, and Temperature metrics.
 * 
 * Data source: GET /api/metric-history/:integrationId?metric=X&range=Y
 * Returns { data: [{ t, v?, avg?, min?, max? }], availableRange, resolution }
 * 
 * Rendering modes:
 * - Line mode: Simple avg line (when data has only 'v' — raw 15s points)
 * - Band mode: Shaded min/max area with avg line overlay (aggregated data)
 * 
 * PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';
import { Popover } from '../../../shared/ui';
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

/** Time range options for the graph */
type TimeRange = '1h' | '6h' | '1d' | '3d' | '7d' | '30d';

/** Metric display configuration */
interface MetricConfig {
    label: string;
    color: string;
    unit: string;
}

/** Data point from the internal history API */
interface HistoryDataPoint {
    t: number; // timestamp (epoch ms)
    v?: number; // single value (raw 15s points)
    avg?: number; // aggregated average
    min?: number; // aggregated min
    max?: number; // aggregated max
}

/** Transformed data point for Recharts */
interface ChartDataPoint {
    timestamp: number;
    value: number;
    min?: number;
    max?: number;
    formattedTime: string;
}

/** API response shape */
interface HistoryResponse {
    success: boolean;
    data: HistoryDataPoint[];
    availableRange: string;
    resolution: string;
    source: string;
}

interface MetricGraphPopoverProps {
    metric: string;
    value: number;
    icon: LucideIcon;
    integrationId?: string;
    /** Set to false to disable the graph popover (e.g., for non-recordable metrics) */
    historyEnabled?: boolean;
    /** CSS class for grid column span (e.g., 'metric-card--span-2') */
    spanClass?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default metric display configs — keyed by metric key */
const METRIC_CONFIGS: Record<string, MetricConfig> = {
    cpu: { label: 'CPU', color: 'var(--accent)', unit: '%' },
    memory: { label: 'Memory', color: 'var(--info)', unit: '%' },
    temperature: { label: 'Temp', color: 'var(--warning)', unit: '°C' },
};

/** Default config for unknown metrics */
const DEFAULT_METRIC_CONFIG: MetricConfig = {
    label: 'Metric',
    color: 'var(--accent)',
    unit: '%',
};

/** All possible time ranges in order */
const ALL_RANGES: TimeRange[] = ['1h', '6h', '1d', '3d', '7d', '30d'];

/** Duration in ms for each range */
const RANGE_DURATION: Record<TimeRange, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

/** Parse a range string like '3d', '1h' into ms */
function parseRangeToMs(range: string): number {
    const match = range.match(/^(\d+)([hdm])$/);
    if (!match) return RANGE_DURATION['3d']; // fallback
    const num = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') return num * 60 * 60 * 1000;
    if (unit === 'd') return num * 24 * 60 * 60 * 1000;
    if (unit === 'm') return num * 60 * 1000;
    return RANGE_DURATION['3d'];
}

// ============================================================================
// Component
// ============================================================================

const MetricGraphPopover: React.FC<MetricGraphPopoverProps> = ({ metric, value, icon: Icon, integrationId, historyEnabled = true, spanClass = '' }) => {
    const { isOpen, onOpenChange } = usePopoverState();
    const [currentRange, setCurrentRange] = useState<TimeRange>('1h');
    const [apiData, setApiData] = useState<HistoryDataPoint[]>([]);
    const [availableRange, setAvailableRange] = useState<string>('3d');
    const [loading, setLoading] = useState<boolean>(false);
    const [dataSource, setDataSource] = useState<string>('');

    // Metric display configuration
    const config: MetricConfig = useMemo(
        () => METRIC_CONFIGS[metric] || { ...DEFAULT_METRIC_CONFIG, label: metric },
        [metric]
    );

    // Get computed color for chart (CSS variables resolved)
    const chartColor = useMemo(() => {
        const style = getComputedStyle(document.body);
        const varName = METRIC_CONFIGS[metric]?.color;
        if (varName) {
            // Extract CSS variable name from var(--name)
            const match = varName.match(/var\((.+)\)/);
            if (match) {
                const resolved = style.getPropertyValue(match[1]).trim();
                if (resolved) return resolved;
            }
        }
        return style.getPropertyValue('--accent').trim() || '#3b82f6';
    }, [metric, isOpen]); // Re-compute when popover opens (theme may have changed)

    // Compute available time range buttons based on availableRange
    const availableRanges = useMemo((): TimeRange[] => {
        const maxMs = parseRangeToMs(availableRange);
        return ALL_RANGES.filter(r => RANGE_DURATION[r] <= maxMs);
    }, [availableRange]);

    // Fetch data from internal history API when popover opens or range changes
    const fetchData = useCallback(async () => {
        if (!integrationId || !historyEnabled) return;
        setLoading(true);
        try {
            const endpoint = `/api/metric-history/${integrationId}?metric=${metric}&range=${currentRange}`;
            const res = await widgetFetch(endpoint, 'metric-history');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json: HistoryResponse = await res.json();
            setApiData(json.data || []);
            if (json.availableRange) {
                setAvailableRange(json.availableRange);
            }
            if (json.source) {
                setDataSource(json.source);
            }
        } catch (err) {
            logger.error('Metric history fetch error:', err);
            setApiData([]);
        } finally {
            setLoading(false);
        }
    }, [integrationId, metric, currentRange, historyEnabled]);

    useEffect(() => {
        if (!isOpen) return;
        fetchData();
    }, [isOpen, fetchData]);

    // Transform API data for Recharts
    const chartData: ChartDataPoint[] = useMemo(() => {
        const timeFormats: Record<TimeRange, string> = {
            '1h': 'h:mm a',
            '6h': 'h a',
            '1d': 'ha',
            '3d': 'MMM d',
            '7d': 'MMM d',
            '30d': 'MMM d',
        };

        return apiData
            .map(d => ({
                timestamp: d.t,
                value: d.avg ?? d.v ?? 0,
                min: d.min,
                max: d.max,
                formattedTime: format(new Date(d.t), timeFormats[currentRange] || 'MMM d'),
            }))
            .filter(p => Number.isFinite(p.value))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [apiData, currentRange]);

    // Check if we have band data (min/max from aggregation)
    const hasBandData = useMemo(
        () => chartData.some(d => d.min !== undefined && d.max !== undefined),
        [chartData]
    );

    // Generate nice rounded tick values for X-axis
    const { niceTicks, formatTick } = useMemo(() => {
        const tickIntervals: Record<TimeRange, number> = {
            '1h': 15 * 60 * 1000,         // 15 minutes
            '6h': 60 * 60 * 1000,         // 1 hour
            '1d': 4 * 60 * 60 * 1000,     // 4 hours
            '3d': 12 * 60 * 60 * 1000,    // 12 hours
            '7d': 24 * 60 * 60 * 1000,    // 1 day
            '30d': 5 * 24 * 60 * 60 * 1000, // 5 days
        };

        const tickFormats: Record<TimeRange, string> = {
            '1h': 'h:mm a',
            '6h': 'h a',
            '1d': 'ha',
            '3d': 'MMM d ha',
            '7d': 'MMM d',
            '30d': 'MMM d',
        };

        const now = Date.now();
        const cutoff = now - RANGE_DURATION[currentRange];
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

    const fillPct = metric === 'temperature' ? Math.min(value, 100) : value;
    const fillStyle = {
        width: `${fillPct}%`,
        backgroundColor: getColor(value),
        transition: 'width 0.4s ease, background-color 0.4s ease',
    };

    // Custom tooltip component for Recharts
    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: ChartDataPoint }> }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            // Show exact time from timestamp, not the rounded axis format
            const exactTime = format(new Date(data.payload.timestamp), 'MMM d, h:mm:ss a');
            const point = data.payload;

            return (
                <div className="glass-card border-theme rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-theme-secondary mb-1">{exactTime}</p>
                    <p className="text-sm font-medium text-theme-primary">
                        {config.label}: <span style={{ color: chartColor }}>{data.value.toFixed(1)}{config.unit}</span>
                    </p>
                    {point.min !== undefined && point.max !== undefined && (
                        <p className="text-xs text-theme-tertiary mt-0.5">
                            Range: {point.min.toFixed(1)} – {point.max.toFixed(1)}{config.unit}
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    // Static metric card (no popover) - used when history is disabled
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
                        style={fillStyle}
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
                <button
                    type="button"
                    className={`metric-card metric-card--clickable${isOpen ? ' metric-card--active' : ''} ${spanClass}`}
                >
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
                                style={fillStyle}
                            />
                        </div>
                    </div>
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[550px] max-w-[90vw]"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-theme-primary">
                            {config.label} History
                        </h3>
                        {dataSource && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary text-theme-tertiary">
                                {dataSource === 'external' ? 'External' : 'Local'}
                            </span>
                        )}
                    </div>
                    {/* Range selector - dynamic based on available data */}
                    <div className="flex gap-1">
                        {availableRanges.map((range) => (
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
                                    {hasBandData && (
                                        <linearGradient id={`band-gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.12} />
                                            <stop offset="95%" stopColor={chartColor} stopOpacity={0.03} />
                                        </linearGradient>
                                    )}
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
                                {/* Min/Max band when aggregated data is available */}
                                {hasBandData && (
                                    <>
                                        <Area
                                            type="linear"
                                            dataKey="max"
                                            stroke="none"
                                            fill={`url(#band-gradient-${metric})`}
                                            dot={false}
                                            isAnimationActive={false}
                                            activeDot={false}
                                        />
                                        <Area
                                            type="linear"
                                            dataKey="min"
                                            stroke="none"
                                            fill="var(--bg-primary)"
                                            dot={false}
                                            isAnimationActive={false}
                                            activeDot={false}
                                        />
                                    </>
                                )}
                                {/* Main value line + gradient fill */}
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
