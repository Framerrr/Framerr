/**
 * CircularGauge — SVG ring visualization for a 0-100 percentage value.
 * Presentational only: color and labels are resolved by the caller
 * (reuses each caller's existing color-threshold helper — no new
 * color logic is introduced here).
 *
 * Arc math uses pathLength=100 so dash percentages map 1:1 to the
 * value (avoids circumference / non-scaling-stroke dash skew). SVG is
 * rotated -90deg so the fill starts at 12 o'clock and grows clockwise.
 *
 * Stroke thickness tracks shared --ss-bar-h in pixels: measured ring
 * size converts bar px → viewBox user units so the arc matches bar
 * height without CSS cq calc (which can explode into a solid blob).
 */
import React, { useLayoutEffect, useRef, useState } from 'react';

export interface CircularGaugeProps {
    /** 0-100. Caller is responsible for any pre-clamping (e.g. temperature). */
    value: number;
    /** Resolved arc color — a CSS color or var() token string. */
    color: string;
    /** Center value, e.g. "72%" or "45°C". */
    label: React.ReactNode;
    /** Optional metric name/icon stack under the value (inside the ring). */
    caption?: React.ReactNode;
    /** Accessible label, e.g. "CPU usage 72%". */
    ariaLabel: string;
    className?: string;
}

const VIEWBOX = 100;
/** Leave a clear hole for value + caption (inner radius ≥ this in user units). */
const MIN_INNER_R = 10;
const DEFAULT_STROKE = 6;
const DEFAULT_R = 44;

function geometryForSize(sizePx: number, barHPx: number): { stroke: number; r: number } {
    if (sizePx <= 0) return { stroke: DEFAULT_STROKE, r: DEFAULT_R };

    // viewBox stroke so rendered thickness === bar height
    let stroke = (barHPx / sizePx) * VIEWBOX;
    // Keep a ring, not a disc: inner radius = r - stroke/2 > MIN_INNER_R
    // with r = VIEWBOX/2 - stroke/2 - margin → stroke < VIEWBOX/2 - MIN_INNER_R
    const maxStroke = VIEWBOX / 2 - MIN_INNER_R; // 40
    stroke = Math.min(Math.max(stroke, 3), maxStroke);
    const r = Math.max(MIN_INNER_R + stroke / 2, VIEWBOX / 2 - stroke / 2 - 0.5);
    return { stroke, r };
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
    value,
    color,
    label,
    caption,
    ariaLabel,
    className,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [{ stroke, r }, setGeometry] = useState({ stroke: DEFAULT_STROKE, r: DEFAULT_R });

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        const update = () => {
            const size = Math.min(el.clientWidth, el.clientHeight);
            const raw = getComputedStyle(el).getPropertyValue('--ss-bar-h').trim();
            const barH = Number.parseFloat(raw);
            setGeometry(geometryForSize(size, Number.isFinite(barH) && barH > 0 ? barH : 16));
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const clamped = Math.max(0, Math.min(100, value));
    // pathLength=100 → dasharray "N 100" paints exactly N% of the ring
    const dashArray = `${clamped} 100`;

    return (
        <div
            ref={rootRef}
            className={`metric-gauge ${className || ''}`}
            role="img"
            aria-label={ariaLabel}
        >
            <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="metric-gauge__svg" aria-hidden="true">
                <circle
                    cx={50}
                    cy={50}
                    r={r}
                    pathLength={100}
                    className="metric-gauge__track"
                    strokeWidth={stroke}
                />
                <circle
                    cx={50}
                    cy={50}
                    r={r}
                    pathLength={100}
                    className="metric-gauge__fill"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={dashArray}
                />
            </svg>
            <div className="metric-gauge__center">
                <span className="metric-gauge__value">{label}</span>
                {caption != null && (
                    <span className="metric-gauge__caption">{caption}</span>
                )}
            </div>
        </div>
    );
};

export default CircularGauge;
