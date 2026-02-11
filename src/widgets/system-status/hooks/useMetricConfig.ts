/**
 * useMetricConfig — manages metric order, sizes, and visibility
 * 
 * Handles:
 * - Per-metric span sizes (1, 2, 3, 4 out of 4 columns)
 * - Metric ordering
 * - Metric visibility
 * - Row packing with auto-stretch
 * - Config sync from external updates (e.g., config modal)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { Activity, Disc, Thermometer, Clock } from 'lucide-react';

// ============================================================================
// METRIC REGISTRY — single source of truth for all metric definitions
// ============================================================================

export interface MetricDef {
    key: string;
    label: string;
    icon: LucideIcon;
    unit: string;
    /** Default column span in the 4-column grid */
    defaultSpan: number;
    /** Whether this metric has a progress bar */
    hasProgress: boolean;
    /** Whether this metric opens a graph popover */
    hasGraph: boolean;
    /** Config key for visibility toggle */
    configKey: string;
}

export const METRIC_REGISTRY: MetricDef[] = [
    { key: 'cpu', label: 'CPU', icon: Activity, unit: '%', defaultSpan: 2, hasProgress: true, hasGraph: true, configKey: 'showCpu' },
    { key: 'memory', label: 'Memory', icon: Disc, unit: '%', defaultSpan: 2, hasProgress: true, hasGraph: true, configKey: 'showMemory' },
    { key: 'temperature', label: 'Temp', icon: Thermometer, unit: '°C', defaultSpan: 2, hasProgress: true, hasGraph: true, configKey: 'showTemperature' },
    { key: 'uptime', label: 'Uptime', icon: Clock, unit: '', defaultSpan: 2, hasProgress: false, hasGraph: false, configKey: 'showUptime' },
];

const DEFAULT_ORDER = METRIC_REGISTRY.map(m => m.key);

// ============================================================================
// PACKED METRIC TYPE
// ============================================================================

export interface PackedMetric extends MetricDef {
    /** Configured span (user's chosen size) */
    span: number;
    /** Effective span after row packing (may be stretched to fill) */
    effectiveSpan: number;
    /** Row index this metric belongs to (0-based) */
    rowIndex: number;
    /** Position within its row: 'left', 'right', or 'solo' */
    rowPosition: 'left' | 'right' | 'solo';
}

// ============================================================================
// ROW PACKING
// ============================================================================

function packMetrics(metrics: MetricDef[], spans: Record<string, number>): PackedMetric[] {
    if (metrics.length === 0) return [];

    const result: PackedMetric[] = [];
    let rowIndex = 0;
    let rowStart = 0;
    let rowTotal = 0;

    for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i];
        const span = spans[metric.key] ?? metric.defaultSpan;

        if (rowTotal + span > 4 && rowTotal > 0) {
            // Stretch last item in previous row to fill
            if (result.length > rowStart) {
                result[result.length - 1].effectiveSpan += (4 - rowTotal);
            }
            // Assign row positions for completed row
            assignRowPositions(result, rowStart);
            // Start new row
            rowIndex++;
            rowStart = result.length;
            rowTotal = 0;
        }

        result.push({
            ...metric,
            span,
            effectiveSpan: span,
            rowIndex,
            rowPosition: 'solo', // will be corrected
        });
        rowTotal += span;
    }

    // Finish last row
    if (rowTotal < 4 && result.length > 0) {
        result[result.length - 1].effectiveSpan += (4 - rowTotal);
    }
    assignRowPositions(result, rowStart);

    return result;
}

function assignRowPositions(metrics: PackedMetric[], rowStart: number): void {
    const rowMetrics = metrics.slice(rowStart);
    if (rowMetrics.length === 1) {
        rowMetrics[0].rowPosition = 'solo';
    } else if (rowMetrics.length >= 2) {
        rowMetrics[0].rowPosition = 'left';
        rowMetrics[rowMetrics.length - 1].rowPosition = 'right';
        // Middle items (if 3+ in a row) stay 'left' for simplicity
        for (let i = 1; i < rowMetrics.length - 1; i++) {
            rowMetrics[i].rowPosition = 'left';
        }
    }
}

/** Count how many rows a set of metrics would occupy */
function countRows(metrics: MetricDef[], spans: Record<string, number>): number {
    if (metrics.length === 0) return 0;
    let rows = 1;
    let rowTotal = 0;
    for (const metric of metrics) {
        const span = spans[metric.key] ?? metric.defaultSpan;
        if (rowTotal + span > 4 && rowTotal > 0) {
            rows++;
            rowTotal = span;
        } else {
            rowTotal += span;
        }
    }
    return rows;
}

/** Slice packed metrics to only include those from the first N rows */
function sliceToMaxRows(packed: PackedMetric[], maxRows: number): PackedMetric[] {
    if (maxRows <= 0) return [];
    let currentRow = 0;
    let rowTotal = 0;
    const result: PackedMetric[] = [];
    for (const metric of packed) {
        if (rowTotal + metric.effectiveSpan > 4 && rowTotal > 0) {
            currentRow++;
            rowTotal = 0;
        }
        if (currentRow >= maxRows) break;
        rowTotal += metric.effectiveSpan;
        result.push(metric);
    }
    return result;
}

// ============================================================================
// HOOK
// ============================================================================

interface UseMetricConfigOptions {
    widgetId: string;
    config: Record<string, unknown> | undefined;
    /** Widget height in grid units (from widget.layout.h) */
    widgetH: number;
    /** Whether header is visible in config (config.showHeader !== false) */
    showHeader: boolean;
}

interface UseMetricConfigReturn {
    /** Packed metrics ready for rendering (sliced to visible rows) */
    packedMetrics: PackedMetric[];
    /** All visible metrics (unpacked) */
    visibleMetrics: MetricDef[];
    /** Total visible metric count */
    visibleCount: number;
    /** Current metric order (keys) */
    metricOrder: string[];
    /** Current metric spans */
    metricSpans: Record<string, number>;
    /** Layout mode */
    layout: string;
    /** Number of visible grid rows for CSS grid-template-rows */
    visibleRows: number;
    /** Number of layout rows hidden due to widget height */
    hiddenRows: number;
    /** Whether cards should render in inline (compact) layout */
    isInline: boolean;
}

export function useMetricConfig({ widgetId, config, widgetH, showHeader }: UseMetricConfigOptions): UseMetricConfigReturn {
    // Read config values
    const layout = (config?.layout as string) || 'grid';
    const configOrder = config?.metricOrder as string[] | undefined;
    const configSpans = config?.metricSpans as Record<string, number> | undefined;

    // Local state for responsive editing (persisted debounced)
    const [localOrder, setLocalOrder] = useState<string[]>(configOrder || DEFAULT_ORDER);
    const [localSpans, setLocalSpans] = useState<Record<string, number>>(
        configSpans || Object.fromEntries(METRIC_REGISTRY.map(m => [m.key, m.defaultSpan]))
    );

    // Sync from config when it changes externally (e.g., config modal save)
    const prevConfigRef = useRef<string>('');
    useEffect(() => {
        const configFingerprint = JSON.stringify({
            order: configOrder,
            spans: configSpans,
            showCpu: config?.showCpu,
            showMemory: config?.showMemory,
            showTemperature: config?.showTemperature,
            showUptime: config?.showUptime,
        });
        if (configFingerprint !== prevConfigRef.current) {
            prevConfigRef.current = configFingerprint;
            // Always sync — use fallbacks when config values are undefined
            setLocalOrder(configOrder || DEFAULT_ORDER);
            setLocalSpans(
                configSpans || Object.fromEntries(METRIC_REGISTRY.map(m => [m.key, m.defaultSpan]))
            );
        }
    }, [config, configOrder, configSpans]);

    // Determine visible metrics in order
    const visibleMetrics = useMemo(() => {
        return localOrder
            .map(key => METRIC_REGISTRY.find(m => m.key === key))
            .filter((m): m is MetricDef => {
                if (!m) return false;
                const visible = config?.[m.configKey];
                return visible === undefined || visible === true;
            });
    }, [localOrder, config]);

    // Pack metrics into grid
    const allPackedMetrics = useMemo(() => packMetrics(visibleMetrics, localSpans), [visibleMetrics, localSpans]);

    // ── Row arithmetic (per SYSTEM_STATUS_ADAPTIVE_ROWS spec) ──
    const { visibleRows, hiddenRows, isInline, packedMetrics } = useMemo(() => {
        const totalPackedRows = countRows(visibleMetrics, localSpans);
        const selectedCount = visibleMetrics.length;

        // Header is visible at h>=2 when showHeader is true (matches useAdaptiveHeader)
        const headerVisible = widgetH >= 2 && showHeader;
        const headerCost = headerVisible ? 1 : 0;
        const contentH = Math.max(widgetH - headerCost, 1);

        // maxRows can never exceed the number of selected metrics
        const maxRows = selectedCount;

        // layoutRows defaults to the natural packing count
        const configLayoutRows = config?.layoutRows as number | undefined;
        const layoutRows = configLayoutRows ?? totalPackedRows;

        // effectiveLayout is clamped by maxRows
        const effectiveLayout = Math.min(layoutRows, maxRows);

        // visibleRows is clamped by available content height
        const vRows = Math.max(1, Math.min(effectiveLayout, contentH));
        const hRows = Math.max(0, effectiveLayout - vRows);

        // Inline mode only at h=1 — the minimum widget height where everything
        // must be in a single horizontal strip. All taller widgets use stacked cards.
        const inline = widgetH <= 1;

        // Slice packed metrics to visible rows
        const sliced = sliceToMaxRows(allPackedMetrics, vRows);

        return {
            visibleRows: vRows,
            hiddenRows: hRows,
            isInline: inline,
            packedMetrics: sliced,
        };
    }, [allPackedMetrics, visibleMetrics, localSpans, widgetH, showHeader, config?.layoutRows]);

    return {
        packedMetrics,
        visibleMetrics,
        visibleCount: visibleMetrics.length,
        metricOrder: localOrder,
        metricSpans: localSpans,
        layout,
        visibleRows,
        hiddenRows,
        isInline,
    };
}
