/**
 * NetworkMetricCard — inline sparkline card for Net ↑ / Net ↓
 *
 * Shows a mini Recharts area chart inside the metric card body.
 * Data buffer accumulates while the widget is mounted and resets on unmount.
 * Graph always fills full width, compressing data points as they accumulate.
 *
 * Hover behavior: when hovering the sparkline, the top-right value swaps
 * to the hovered data point's speed with a subtle border indicator.
 * When not hovering, it shows the live value.
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { PackedMetric } from '../hooks/useMetricConfig';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum data points to keep in the sparkline buffer */
const MAX_POINTS = 60;

/** Colors for upload vs download */
const NETWORK_COLORS: Record<string, string> = {
    networkUp: 'var(--info)',
    networkDown: 'var(--accent)',
};

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface NetworkMetricCardProps {
    metric: PackedMetric;
    value: number | null;
    visibleCount: number;
}

interface SparkPoint {
    idx: number;
    value: number;
}

/**
 * Invisible tooltip content — captures the hovered value via callback,
 * renders nothing visually. The hovered value is shown in the card header instead.
 *
 * On mobile, Recharts keeps the tooltip "active" at the last touch position
 * even after the finger lifts. We use `isTouchingRef` to gate the callback
 * so values only flow while the user is actively touching.
 */
const HoverCapture: React.FC<{
    active?: boolean;
    payload?: Array<{ value: number }>;
    onHover: (value: number | null) => void;
    isTouchingRef: React.RefObject<boolean | null>;
}> = ({ active, payload, onHover, isTouchingRef }) => {
    useEffect(() => {
        // If touch just ended, ignore Recharts' stale "active" state
        if (isTouchingRef.current === false) return;
        if (active && payload?.length) {
            onHover(payload[0].value);
        } else {
            onHover(null);
        }
    }, [active, payload, onHover, isTouchingRef]);
    return null;
};

const NetworkMetricCard: React.FC<NetworkMetricCardProps> = ({ metric, value, visibleCount }) => {
    // Buffer of recent values — resets when component mounts
    const bufferRef = useRef<SparkPoint[]>([]);
    const counterRef = useRef(0);
    const sparklineRef = useRef<HTMLDivElement>(null);
    const isTouchingRef = useRef<boolean | null>(null); // null = mouse mode, true = touching, false = just released
    const [chartData, setChartData] = useState<SparkPoint[]>([]);
    const [hoveredValue, setHoveredValue] = useState<number | null>(null);

    // Touch tracking: gate HoverCapture during touch interactions
    useEffect(() => {
        const el = sparklineRef.current;
        if (!el) return;
        const onTouchStart = () => { isTouchingRef.current = true; };
        const onTouchEnd = () => {
            isTouchingRef.current = false;
            setHoveredValue(null);
        };
        const onTouchMove = (e: TouchEvent) => {
            // Prevent page scrolling while scrubbing the sparkline
            if (isTouchingRef.current) {
                e.preventDefault();
            }
        };
        el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
        el.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
        el.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            el.removeEventListener('touchstart', onTouchStart, true);
            el.removeEventListener('touchend', onTouchEnd, true);
            el.removeEventListener('touchcancel', onTouchEnd, true);
            el.removeEventListener('touchmove', onTouchMove);
        };
    }, []);

    // Resolve CSS variable color to hex for Recharts gradient
    const resolvedColor = useMemo(() => {
        const style = getComputedStyle(document.body);
        if (metric.key === 'networkUp') {
            return style.getPropertyValue('--info').trim() || '#0ea5e9';
        }
        return style.getPropertyValue('--accent').trim() || '#3b82f6';
    }, [metric.key]);

    // Push new value into buffer on each update
    useEffect(() => {
        const numVal = Number(value || 0);
        const point: SparkPoint = { idx: counterRef.current++, value: numVal };
        bufferRef.current.push(point);

        // Trim to max points
        if (bufferRef.current.length > MAX_POINTS) {
            bufferRef.current = bufferRef.current.slice(-MAX_POINTS);
        }

        setChartData([...bufferRef.current]);
    }, [value]);

    // Display: show hovered value when hovering, otherwise live value
    const isHovering = hoveredValue !== null;
    const displayValue = formatSpeed(isHovering ? hoveredValue : Number(value || 0));
    const cssColor = NETWORK_COLORS[metric.key] || 'var(--accent)';

    // Card classes
    const cardClasses = [
        'metric-card',
        'metric-card--network',
        `metric-card--span-${metric.effectiveSpan}`,
    ].join(' ');

    // Value classes — add border indicator when showing historical data
    const valueClasses = [
        'metric-card__value',
        'metric-card__value--network',
        isHovering ? 'metric-card__value--hovered' : '',
    ].filter(Boolean).join(' ');

    // Unique gradient ID per metric key
    const gradientId = `sparkline-gradient-${metric.key}`;

    return (
        <div className={cardClasses}>
            <div className="metric-card__inner">
                <div className="metric-card__header">
                    <span className="metric-card__label">
                        {metric.label}
                    </span>
                    <span className={valueClasses} style={{ color: cssColor }}>
                        {displayValue}
                    </span>
                </div>
                <div
                    ref={sparklineRef}
                    className="metric-card__sparkline"
                    onMouseLeave={() => { isTouchingRef.current = null; setHoveredValue(null); }}
                >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={resolvedColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={resolvedColor} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                content={<HoverCapture onHover={setHoveredValue} isTouchingRef={isTouchingRef} />}
                                cursor={isHovering ? { stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '3 3' } : false}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={resolvedColor}
                                strokeWidth={1.5}
                                fill={`url(#${gradientId})`}
                                dot={false}
                                isAnimationActive={false}
                                activeDot={isHovering ? {
                                    r: 3,
                                    fill: resolvedColor,
                                    stroke: 'var(--bg-primary)',
                                    strokeWidth: 1.5,
                                } : false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default NetworkMetricCard;
