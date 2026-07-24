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
import api from '../../../api/client';
import { usePopoverState } from '@/shared/hooks/usePopoverState';
import CircularGauge from '../components/CircularGauge';
import '../styles.css';

// ============================================================================
// Types
// ============================================================================

/** Template-literal type covering any valid range string (e.g. '1h', '6h', '14d', '21d'). */
type TimeRange = `${number}h` | `${number}d` | `${number}m`;

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
    viz?: 'bar' | 'gauge';
}

function renderVizBody(
    viz: 'bar' | 'gauge',
    fillPct: number,
    fillStyle: React.CSSProperties,
    color: string,
    config: MetricConfig,
    value: number,
    metric: string,
    caption?: React.ReactNode
) {
    if (viz === 'gauge') {
        const label = `${Number(value || 0).toFixed(metric === 'temperature' ? 0 : 1)}${config.unit}`;
        return (
            <div className="metric-card__gauge-wrap">
                <CircularGauge
                    value={fillPct}
                    color={color}
                    label={label}
                    caption={caption}
                    ariaLabel={`${config.label} ${label}`}
                />
            </div>
        );
    }
    return (
        <div className="metric-card__progress">
            <div className="metric-card__progress-fill" style={fillStyle} />
        </div>
    );
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

/** Parse a range string like '3d', '1h' into ms */
function parseRangeToMs(range: string): number {
    const match = range.match(/^(\d+)([hdm])$/);
    if (!match) return 3 * 24 * 60 * 60 * 1000; // fallback: 3d
    const num = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') return num * 60 * 60 * 1000;
    if (unit === 'd') return num * 24 * 60 * 60 * 1000;
    if (unit === 'm') return num * 60 * 1000;
    return 3 * 24 * 60 * 60 * 1000;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixed base buttons — always shown when data supports their duration. */
const BASE_RANGES: TimeRange[] = ['1h', '6h', '1d', '3d'];

/**
 * Candidate milestones for snapping the maximum day button to a clean value.
 * All day buttons produced by generateRanges come from this set.
 */
const SNAP_MILESTONES = [5, 7, 10, 14, 21, 30];

/**
 * Intermediate milestones always included as buttons when the snapped max exceeds them.
 * 5 and 10 are excluded because they appear only AS the snapped max, never as intermediates.
 */
const WEEK_MILESTONES = [7, 14, 21];

/**
 * Snap maxDays UP to the nearest SNAP_MILESTONE within `threshold` days above.
 * If none close enough, returns the largest milestone at or below maxDays.
 * All returned values come from the curated milestone list — never raw/rounded.
 */
function snapUpToMilestone(maxDays: number, milestones: number[], threshold: number): number {
    for (const m of milestones) {
        if (m >= maxDays && m - maxDays <= threshold) return m;
    }
    for (let i = milestones.length - 1; i >= 0; i--) {
        if (milestones[i] <= maxDays) return milestones[i];
    }
    return 0;
}

/**
 * Generate the ordered list of time range buttons for a given available range.
 *
 * 1. Include base ranges (1h, 6h, 1d, 3d) whose duration fits within availableRange.
 * 2. If data span > 3 days: snap maxDays to nearest curated milestone (within 2 days up,
 *    or largest milestone below as fallback). Add WEEK_MILESTONES < snapMax, then snapMax.
 *
 * Examples:
 *   '5d'  → ['1h','6h','1d','3d','5d']
 *   '14d' → ['1h','6h','1d','3d','7d','14d']
 *   '30d' → ['1h','6h','1d','3d','7d','14d','21d','30d']
 *   '2d'  → ['1h','6h','1d']
 *   '0d'  → []
 */
function generateRanges(availableRange: string): TimeRange[] {
    const maxMs = parseRangeToMs(availableRange);
    if (maxMs <= 0) return [];

    const maxDays = maxMs / DAY_MS;
    const base = BASE_RANGES.filter(r => parseRangeToMs(r) <= maxMs);

    if (maxDays <= 3) return base;

    const snapMax = snapUpToMilestone(maxDays, SNAP_MILESTONES, 2);
    if (snapMax === 0) return base;

    const dayButtons: TimeRange[] = [];
    for (const m of WEEK_MILESTONES) {
        if (m < snapMax) dayButtons.push(`${m}d` as TimeRange);
    }
    dayButtons.push(`${snapMax}d` as TimeRange);

    return [...base, ...dayButtons];
}

/** Get the date-fns format string for chart data point labels for a given range. */
function getTimeFormat(range: string): string {
    if (range === '1h') return 'h:mm a';
    if (range === '6h') return 'h a';
    if (range === '1d') return 'ha';
    return 'MMM d';
}

/** Get the X-axis tick interval in ms for a given range. */
function getTickInterval(range: string): number {
    if (range === '1h') return 15 * 60 * 1000;
    if (range === '6h') return 60 * 60 * 1000;
    if (range === '1d') return 4 * 60 * 60 * 1000;
    if (range === '3d') return 12 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
}

/** Get the date-fns format string for X-axis ticks for a given range. */
function getTickFormat(range: string): string {
    if (range === '1h') return 'h:mm a';
    if (range === '6h') return 'h a';
    if (range === '1d') return 'ha';
    if (range === '3d') return 'MMM d ha';
    return 'MMM d';
}

// ============================================================================
// Component
// ============================================================================

const MetricGraphPopover: React.FC<MetricGraphPopoverProps> = ({ metric, value, icon: Icon, integrationId, historyEnabled = true, spanClass = '', viz = 'bar' }) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOpen is intentional recompute trigger for theme refresh
    }, [metric, isOpen]); // Re-compute when popover opens (theme may have changed)

    // Compute available time range buttons based on availableRange
    const availableRanges = useMemo((): TimeRange[] => {
        return generateRanges(availableRange);
    }, [availableRange]);

    // Clamp currentRange when availableRange shrinks and the selection is no longer available.
    // Resets to the largest available range to maximize data visibility.
    useEffect(() => {
        if (availableRanges.length > 0 && !availableRanges.includes(currentRange)) {
            setCurrentRange(availableRanges[availableRanges.length - 1]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableRanges]);

    // Fetch data from internal history API when popover opens or range changes
    const fetchData = useCallback(async () => {
        if (!integrationId || !historyEnabled) return;
        setLoading(true);
        try {
            const endpoint = `/api/metric-history/${integrationId}?metric=${metric}&range=${currentRange}`;
            const json = await api.get<HistoryResponse>(endpoint, {
                headers: { 'X-Widget-Type': 'metric-history' }
            });
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
        return apiData
            .map(d => ({
                timestamp: d.t,
                value: d.avg ?? d.v ?? 0,
                min: d.min,
                max: d.max,
                formattedTime: format(new Date(d.t), getTimeFormat(currentRange)),
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
        const now = Date.now();
        const cutoff = now - parseRangeToMs(currentRange);
        const interval = getTickInterval(currentRange);
        const tickFormat = getTickFormat(currentRange);

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
        <div className={`metric-card ${spanClass}${viz === 'gauge' ? ' metric-card--gauge' : ''}`}>
            <div className="metric-card__inner">
                <div className="metric-card__header">
                    <span className="metric-card__label">
                        <Icon size={14} />
                        {config.label}
                    </span>
                    {viz !== 'gauge' && (
                        <span className="metric-card__value">
                            {Number(value || 0).toFixed(metric === 'temperature' ? 0 : 1)}{config.unit}
                        </span>
                    )}
                </div>
                {renderVizBody(viz, fillPct, fillStyle, getColor(value), config, value, metric, (
                    <>
                        <Icon size={14} />
                        {config.label}
                    </>
                ))}
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
                    className={`metric-card metric-card--clickable${isOpen ? ' metric-card--active' : ''}${viz === 'gauge' ? ' metric-card--gauge' : ''} ${spanClass}`}
                >
                    <div className="metric-card__inner">
                        <div className="metric-card__header">
                            <span className="metric-card__label">
                                <Icon size={14} />
                                {config.label}
                            </span>
                            {viz !== 'gauge' && (
                                <span className="metric-card__value">
                                    {Number(value || 0).toFixed(metric === 'temperature' ? 0 : 1)}{config.unit}
                                </span>
                            )}
                        </div>
                        {renderVizBody(viz, fillPct, fillStyle, getColor(value), config, value, metric, (
                            <>
                                <Icon size={14} />
                                {config.label}
                            </>
                        ))}
                    </div>
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={2}
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
                                    : 'bg-theme-secondary text-theme-secondary hover:text-theme-primary'
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
