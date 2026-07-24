import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklinePoint {
    timestamp: number;
    queries: number;
    blocked: number;
}

interface SparklineProps {
    points: SparklinePoint[];
}

/** Approximate tooltip box — used for edge clamping before paint */
const TOOLTIP_WIDTH = 148;
const TOOLTIP_HEIGHT = 72;
const TOOLTIP_PAD = 6;
/** Lift fully above the plot so the cursor/line stay visible */
const TOOLTIP_ABOVE_GAP = 8;

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatCount(value: number): string {
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat(undefined, {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);
    }
    return value.toLocaleString();
}

function clampTooltipPosition(cursorX: number, chartW: number): { x: number; y: number } {
    // Sit above the plot (negative y); only clamp horizontally to the chart width
    let x = cursorX - TOOLTIP_WIDTH / 2;
    x = Math.max(TOOLTIP_PAD, Math.min(x, chartW - TOOLTIP_WIDTH - TOOLTIP_PAD));
    const y = -(TOOLTIP_HEIGHT + TOOLTIP_ABOVE_GAP);
    return { x, y };
}

const SparklineTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{
        dataKey?: string | number;
        value?: number;
        payload?: SparklinePoint;
    }>;
}> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const point = payload[0]?.payload;
    if (!point) return null;

    const queries = payload.find((p) => p.dataKey === 'queries')?.value ?? point.queries;
    const blocked = payload.find((p) => p.dataKey === 'blocked')?.value ?? point.blocked;

    return (
        <div className="dns-stats-sparkline-tooltip border-theme rounded-lg px-3 py-2 shadow-lg">
            <p className="text-xs text-theme-secondary mb-1">{formatTime(point.timestamp)}</p>
            <p className="text-sm font-medium text-theme-primary">
                Queries:{' '}
                <span style={{ color: 'var(--accent)' }}>{formatCount(queries)}</span>
            </p>
            <p className="text-sm font-medium text-theme-primary">
                Blocked:{' '}
                <span style={{ color: 'var(--error)' }}>{formatCount(blocked)}</span>
            </p>
        </div>
    );
};

const Sparkline: React.FC<SparklineProps> = ({ points }) => {
    const gradientId = useId().replace(/:/g, '');
    const chartRef = useRef<HTMLDivElement>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | undefined>();

    const chartData = useMemo(
        () =>
            points
                .filter((p) => Number.isFinite(p.timestamp))
                .map((p) => ({
                    timestamp: p.timestamp,
                    queries: p.queries,
                    blocked: p.blocked,
                })),
        [points]
    );

    const colors = useMemo(() => {
        const style = getComputedStyle(document.body);
        return {
            queries: style.getPropertyValue('--accent').trim() || '#3b82f6',
            blocked: style.getPropertyValue('--error').trim() || '#ef4444',
        };
    }, []);

    const handleMouseMove = useCallback((state: unknown) => {
        const s = state as {
            isTooltipActive?: boolean;
            activeCoordinate?: { x?: number; y?: number };
        } | null;

        if (!s?.isTooltipActive || !s.activeCoordinate || !chartRef.current) {
            setTooltipPos(undefined);
            return;
        }

        const chartW = chartRef.current.clientWidth;
        const cursorX = Number(s.activeCoordinate.x ?? 0);
        setTooltipPos(clampTooltipPosition(cursorX, chartW));
    }, []);

    const handleMouseLeave = useCallback(() => {
        setTooltipPos(undefined);
    }, []);

    if (chartData.length < 2) return null;

    return (
        <div className="dns-stats-sparkline">
            <div className="dns-stats-sparkline-header">
                <h4 className="dns-stats-ranked-title text-theme-secondary">Activity</h4>
                <div className="dns-stats-sparkline-legend text-theme-secondary">
                    <span className="dns-stats-sparkline-swatch dns-stats-sparkline-swatch-queries" />
                    Queries
                    <span className="dns-stats-sparkline-swatch dns-stats-sparkline-swatch-blocked" />
                    Blocked
                </div>
            </div>
            <div
                ref={chartRef}
                className="dns-stats-sparkline-chart"
                role="img"
                aria-label="DNS queries and blocked activity over time"
            >
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart
                        data={chartData}
                        margin={{ top: 4, right: 2, left: 2, bottom: 0 }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <defs>
                            <linearGradient id={`queries-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors.queries} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={colors.queries} stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id={`blocked-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors.blocked} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={colors.blocked} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            content={<SparklineTooltip />}
                            cursor={{
                                stroke: 'var(--text-tertiary)',
                                strokeWidth: 1,
                                strokeDasharray: '3 3',
                            }}
                            position={tooltipPos}
                            allowEscapeViewBox={{ x: true, y: true }}
                            wrapperStyle={{ zIndex: 30, outline: 'none', pointerEvents: 'none' }}
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="queries"
                            stroke={colors.queries}
                            strokeWidth={1.5}
                            fill={`url(#queries-${gradientId})`}
                            dot={false}
                            isAnimationActive={false}
                            activeDot={{
                                r: 3,
                                fill: colors.queries,
                                stroke: 'var(--bg-primary)',
                                strokeWidth: 1.5,
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="blocked"
                            stroke={colors.blocked}
                            strokeWidth={1.25}
                            fill={`url(#blocked-${gradientId})`}
                            dot={false}
                            isAnimationActive={false}
                            activeDot={{
                                r: 3,
                                fill: colors.blocked,
                                stroke: 'var(--bg-primary)',
                                strokeWidth: 1.5,
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Sparkline;
