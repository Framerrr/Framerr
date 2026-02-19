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

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';
import { Activity, Disc, Thermometer, Clock, HardDrive, ArrowUp, ArrowDown } from 'lucide-react';
import type { StatusData } from '../types';

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
    /** Visualization type for this metric */
    vizType: 'progress' | 'sparkline' | 'status' | 'text';
    /** Whether this metric opens a graph popover */
    hasGraph: boolean;
    /** Config key for visibility toggle */
    configKey: string;
}

export const METRIC_REGISTRY: MetricDef[] = [
    { key: 'cpu', label: 'CPU', icon: Activity, unit: '%', defaultSpan: 2, vizType: 'progress', hasGraph: true, configKey: 'showCpu' },
    { key: 'memory', label: 'Memory', icon: Disc, unit: '%', defaultSpan: 2, vizType: 'progress', hasGraph: true, configKey: 'showMemory' },
    { key: 'temperature', label: 'Temp', icon: Thermometer, unit: '°C', defaultSpan: 2, vizType: 'progress', hasGraph: true, configKey: 'showTemperature' },
    { key: 'uptime', label: 'Uptime', icon: Clock, unit: '', defaultSpan: 2, vizType: 'text', hasGraph: false, configKey: 'showUptime' },
    { key: 'diskUsage', label: 'Disk', icon: HardDrive, unit: '%', defaultSpan: 2, vizType: 'progress', hasGraph: false, configKey: 'showDiskUsage' },
    { key: 'networkUp', label: 'Net ↑', icon: ArrowUp, unit: '', defaultSpan: 2, vizType: 'text', hasGraph: false, configKey: 'showNetworkUp' },
    { key: 'networkDown', label: 'Net ↓', icon: ArrowDown, unit: '', defaultSpan: 2, vizType: 'text', hasGraph: false, configKey: 'showNetworkDown' },
];

const DEFAULT_ORDER = METRIC_REGISTRY.map(m => m.key);

// ============================================================================
// LAYOUT TUNING CONSTANTS — tweak these to adjust how rows fit in the widget
// ============================================================================

/** GridStack cell height = ROW_HEIGHT(60) + MARGIN(10) */
export const SS_CELL_HEIGHT = 70;
/** Widget header pixel height when visible */
export const SS_HEADER_HEIGHT = 40;
/** Equal padding on all 4 sides of the metric grid (px) */
export const SS_GRID_PAD = 8;
/** Minimum gap between metric rows (px) — actual gap may be larger to fill space */
export const SS_ROW_GAP_MIN = 6;
/** Minimum pixel height for a standard metric row (used for row COUNT calculation) */
export const SS_ROW_MIN = 65;
/** Maximum pixel height for a standard metric row */
export const SS_ROW_MAX = 90;
/** Compact row weight (uptime, text-only metrics) relative to standard rows */
export const SS_COMPACT_WEIGHT = 0.6;

/** Keys that use compact (shorter) row height */
const COMPACT_KEYS = new Set(['uptime']);

/**
 * Compute how many metric rows fit in a given widget height.
 * This is the core conversion: widget grid units → metric row count.
 */
export function computeMaxRows(widgetH: number, headerVisible: boolean): number {
    const widgetPx = widgetH * SS_CELL_HEIGHT - (SS_CELL_HEIGHT - 60); // GridStack formula
    const contentPx = widgetPx - (headerVisible ? SS_HEADER_HEIGHT : 0) - (SS_GRID_PAD * 2);
    // Each row needs at least ROW_MIN + GAP (except last row, no trailing gap)
    return Math.max(1, Math.floor((contentPx + SS_ROW_GAP_MIN) / (SS_ROW_MIN + SS_ROW_GAP_MIN)));
}

/** All known metric keys from the registry (used as fallback) */
const ALL_METRIC_KEYS = METRIC_REGISTRY.map(m => m.key);

/**
 * Get the metric keys available for a given integration type.
 * Prefers schema-derived keys from the plugin API; falls back to all known metrics.
 */
export function getMetricsForIntegration(
    integrationType: string | undefined,
    schemaMetricKeys?: string[]
): string[] {
    if (schemaMetricKeys && schemaMetricKeys.length > 0) return schemaMetricKeys;
    // Fallback: if no schema data available, show all known metrics
    return ALL_METRIC_KEYS;
}

/** Get MetricDef objects for a given integration type */
export function getMetricDefsForIntegration(
    integrationType: string | undefined,
    schemaMetricKeys?: string[]
): MetricDef[] {
    const keys = getMetricsForIntegration(integrationType, schemaMetricKeys);
    return METRIC_REGISTRY.filter(m => keys.includes(m.key));
}

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
    /** Integration type to filter available metrics (e.g., 'glances', 'unraid') */
    integrationType?: string;
    /** Current SSE data — used to hide metrics whose value is null */
    statusData?: StatusData;
    /** Metric keys from the plugin schemas API (replaces hardcoded INTEGRATION_METRICS) */
    schemaMetricKeys?: string[];
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
    /** Number of visible grid rows */
    visibleRows: number;
    /** Number of layout rows hidden due to widget height */
    hiddenRows: number;
    /** Whether cards should render in inline (compact) layout */
    isInline: boolean;
    /** Grouped rows for rendering: each inner array is one visual row */
    rowGroups: PackedMetric[][];
    /** CSS custom properties for the grid container */
    gridCssVars: Record<string, string>;
}

export function useMetricConfig({ widgetId, config, widgetH, showHeader, integrationType, statusData, schemaMetricKeys }: UseMetricConfigOptions): UseMetricConfigReturn {
    // Get the metrics available for this integration type (schema-driven when available)
    const availableMetrics = useMemo(
        () => getMetricDefsForIntegration(integrationType, schemaMetricKeys),
        [integrationType, schemaMetricKeys]
    );
    const availableKeys = useMemo(
        () => new Set(availableMetrics.map(m => m.key)),
        [availableMetrics]
    );

    // Read config values — dual storage for collapsed vs individual disk mode
    const layout = (config?.layout as string) || 'grid';
    const isDiskIndividual = config?.diskCollapsed === 'individual';
    const hasSavedDiskLayout = isDiskIndividual
        && Array.isArray(config?.diskMetricOrder)
        && (config.diskMetricOrder as string[]).length > 0;
    const configOrder = hasSavedDiskLayout
        ? (config.diskMetricOrder as string[])
        : (config?.metricOrder as string[] | undefined);
    const configSpans = hasSavedDiskLayout
        ? (config?.diskMetricSpans as Record<string, number> | undefined)
        : (config?.metricSpans as Record<string, number> | undefined);

    // Reconcile saved order: append any enabled metrics missing from the saved order.
    // This self-heals stale configs where a metric was enabled but missing from metricOrder
    // (e.g. temperature dropped during a layout save, or a new metric was added).
    const reconcileOrder = useCallback((savedOrder: string[] | undefined): string[] => {
        if (!savedOrder) return DEFAULT_ORDER;
        const savedSet = new Set(savedOrder);
        const missing = availableMetrics
            .filter(m => !savedSet.has(m.key) && config?.[m.configKey] !== false)
            .map(m => m.key);
        return missing.length > 0 ? [...savedOrder, ...missing] : savedOrder;
    }, [availableMetrics, config]);

    // Local state for responsive editing (persisted debounced)
    const [localOrder, setLocalOrder] = useState<string[]>(reconcileOrder(configOrder));
    const [localSpans, setLocalSpans] = useState<Record<string, number>>(
        configSpans || Object.fromEntries(METRIC_REGISTRY.map(m => [m.key, m.defaultSpan]))
    );

    // Sync from config when it changes externally (e.g., config modal save, integration switch)
    const prevConfigRef = useRef<string>('');
    useEffect(() => {
        const configFingerprint = JSON.stringify({
            integrationType,
            order: configOrder,
            spans: configSpans,
            showCpu: config?.showCpu,
            showMemory: config?.showMemory,
            showTemperature: config?.showTemperature,
            showUptime: config?.showUptime,
            showDiskUsage: config?.showDiskUsage,
            showNetworkUp: config?.showNetworkUp,
            showNetworkDown: config?.showNetworkDown,
            diskCollapsed: config?.diskCollapsed,
            diskSelection: config?.diskSelection,
            diskMetricOrder: config?.diskMetricOrder,
            diskMetricSpans: config?.diskMetricSpans,
        });
        if (configFingerprint !== prevConfigRef.current) {
            prevConfigRef.current = configFingerprint;
            // Always sync — use fallbacks when config values are undefined
            setLocalOrder(reconcileOrder(configOrder));
            setLocalSpans(
                configSpans || Object.fromEntries(METRIC_REGISTRY.map(m => [m.key, m.defaultSpan]))
            );
        }
    }, [config, configOrder, configSpans, integrationType, reconcileOrder]);

    // Track which metrics have ever reported non-null data (sticky — never revert)
    // This prevents cards from flickering when values are briefly null between polls
    const seenMetricsRef = useRef<Set<string>>(new Set());

    // Update the "ever seen" set when statusData changes
    if (statusData) {
        for (const key of Object.keys(statusData) as (keyof StatusData)[]) {
            if (statusData[key] !== null && statusData[key] !== undefined) {
                seenMetricsRef.current.add(key);
            }
        }
    }

    const visibleMetrics = useMemo(() => {
        const base = localOrder
            .filter(key => {
                // disk-{id} keys pass if diskUsage is available
                if (key.startsWith('disk-')) return availableKeys.has('diskUsage');
                return availableKeys.has(key);
            })
            .map(key => {
                // disk-{id} keys: create a placeholder MetricDef (resolved later)
                if (key.startsWith('disk-')) {
                    const diskDef = METRIC_REGISTRY.find(m => m.key === 'diskUsage');
                    if (!diskDef) return undefined;
                    return {
                        key,
                        label: key, // temporary, resolved below
                        icon: diskDef.icon,
                        unit: '%',
                        defaultSpan: diskDef.defaultSpan,
                        vizType: 'progress' as const,
                        hasGraph: false,
                        configKey: 'showDiskUsage',
                    } as MetricDef;
                }
                return METRIC_REGISTRY.find(m => m.key === key);
            })
            .filter((m): m is MetricDef => {
                if (!m) return false;
                const visible = config?.[m.configKey];
                if (visible === false) return false;
                // If we have live data, hide metrics that have NEVER reported a value
                // Once a metric has been seen, it stays visible (sticky)
                if (statusData && !m.key.startsWith('disk-')) {
                    const value = statusData[m.key as keyof StatusData];
                    const everSeen = seenMetricsRef.current.has(m.key);
                    if ((value === null || value === undefined) && !everSeen) return false;
                }
                return true;
            });

        // Individual disk mode: expand diskUsage into per-disk entries
        // Only needed when there's no saved diskMetricOrder (first-time initialization)
        // When hasSavedDiskLayout, the order already contains disk-{id} keys
        const diskCollapsed = config?.diskCollapsed !== 'individual'; // default collapsed
        if (!diskCollapsed && !hasSavedDiskLayout && integrationType === 'unraid' && statusData?.disks?.length) {
            const diskSelection = config?.diskSelection as string[] | undefined;
            const selectedDisks = statusData.disks.filter((d) =>
                !diskSelection || diskSelection.length === 0 || diskSelection.includes(d.id)
            );

            if (selectedDisks.length > 0) {
                // Find diskUsage position and replace with per-disk entries
                const diskIdx = base.findIndex(m => m.key === 'diskUsage');
                if (diskIdx >= 0) {
                    const diskDef = base[diskIdx];
                    const diskEntries: MetricDef[] = selectedDisks.map((d) => ({
                        key: `disk-${d.id}`,
                        label: d.name,
                        icon: diskDef.icon,
                        unit: '%',
                        defaultSpan: diskDef.defaultSpan,
                        vizType: 'progress' as const,
                        hasGraph: false,
                        configKey: 'showDiskUsage',
                    }));
                    base.splice(diskIdx, 1, ...diskEntries);
                }
            }
        }

        // When using saved disk layout, resolve disk-{id} keys to MetricDef entries
        if (!diskCollapsed && hasSavedDiskLayout && integrationType === 'unraid' && statusData?.disks?.length) {
            const diskDef = METRIC_REGISTRY.find(m => m.key === 'diskUsage');
            if (diskDef) {
                // Replace any disk-{id} keys that passed the filter with proper MetricDef entries
                for (let i = 0; i < base.length; i++) {
                    if (base[i].key.startsWith('disk-')) {
                        const diskId = base[i].key.slice(5);
                        const diskData = statusData.disks.find(d => d.id === diskId);
                        if (diskData) {
                            base[i] = {
                                key: `disk-${diskId}`,
                                label: diskData.name,
                                icon: diskDef.icon,
                                unit: '%',
                                defaultSpan: diskDef.defaultSpan,
                                vizType: 'progress' as const,
                                hasGraph: false,
                                configKey: 'showDiskUsage',
                            };
                        }
                    }
                }
            }
        }

        return base;
    }, [localOrder, config, availableKeys, statusData, integrationType]);

    // Pack metrics into grid
    const allPackedMetrics = useMemo(() => packMetrics(visibleMetrics, localSpans), [visibleMetrics, localSpans]);

    // ── Row arithmetic — pixel-based computation ──
    const { visibleRows, hiddenRows, isInline, packedMetrics, rowGroups, gridCssVars } = useMemo(() => {
        const totalPackedRows = countRows(visibleMetrics, localSpans);

        // Header is visible at h>=2 when showHeader is true (matches useAdaptiveHeader)
        const headerVisible = widgetH >= 2 && showHeader;

        // Pixel-based max rows computation
        const maxFittingRows = computeMaxRows(widgetH, headerVisible);

        // layoutRows defaults to the natural packing count
        const configLayoutRows = config?.layoutRows as number | undefined;
        const layoutRows = configLayoutRows ?? totalPackedRows;

        // effectiveLayout is clamped by maxFittingRows and by metric count
        const effectiveLayout = Math.min(layoutRows, visibleMetrics.length);

        // visibleRows is clamped by pixel-based max
        const vRows = Math.max(1, Math.min(effectiveLayout, maxFittingRows));
        const hRows = Math.max(0, effectiveLayout - vRows);

        // Inline mode only at h=1
        const inline = widgetH <= 1;

        // Slice packed metrics to visible rows
        const sliced = sliceToMaxRows(allPackedMetrics, vRows);

        // Group packed metrics into row arrays for rendering
        const groups: PackedMetric[][] = [];
        let currentGroup: PackedMetric[] = [];
        let rowTotal = 0;
        for (const m of sliced) {
            if (rowTotal + m.effectiveSpan > 4 && rowTotal > 0) {
                groups.push(currentGroup);
                currentGroup = [];
                rowTotal = 0;
            }
            currentGroup.push(m);
            rowTotal += m.effectiveSpan;
        }
        if (currentGroup.length > 0) groups.push(currentGroup);

        // Compute per-row heights for flexbox
        // Compact rows (uptime-only) get COMPACT_WEIGHT of a standard row
        const widgetPx = widgetH * SS_CELL_HEIGHT - (SS_CELL_HEIGHT - 60);
        const contentPx = widgetPx - (headerVisible ? SS_HEADER_HEIGHT : 0) - (SS_GRID_PAD * 2);
        const rowCount = groups.length;
        const gapTotal = Math.max(0, rowCount - 1) * SS_ROW_GAP_MIN;
        const availableForRows = contentPx - gapTotal;

        // Compute weights
        let totalWeight = 0;
        const rowWeights = groups.map(group => {
            const isCompact = group.every(m => COMPACT_KEYS.has(m.key));
            const w = isCompact ? SS_COMPACT_WEIGHT : 1;
            totalWeight += w;
            return w;
        });

        // Compute actual row heights (clamped)
        const unitHeight = totalWeight > 0 ? availableForRows / totalWeight : SS_ROW_MIN;
        const rowHeights = rowWeights.map(w => {
            const minH = w < 1 ? SS_ROW_MIN * w : SS_ROW_MIN;
            const maxH = w < 1 ? SS_ROW_MAX * w : SS_ROW_MAX;
            return Math.max(minH, Math.min(maxH, unitHeight * w));
        });

        // Compute actual gap to fill remaining space
        const usedByRows = rowHeights.reduce((s, h) => s + h, 0);
        const remainingSpace = Math.max(0, contentPx - usedByRows);
        const gapCount = Math.max(1, rowCount - 1);
        const actualGap = rowCount <= 1 ? 0 : remainingSpace / gapCount;

        // CSS vars for the grid container
        const cssVars: Record<string, string> = {
            '--ss-pad': `${SS_GRID_PAD}px`,
            '--ss-gap': `${Math.round(actualGap)}px`,
        };
        // Per-row height vars
        rowHeights.forEach((h, i) => {
            cssVars[`--ss-row-${i}`] = `${Math.round(h)}px`;
        });

        return {
            visibleRows: vRows,
            hiddenRows: hRows,
            isInline: inline,
            packedMetrics: sliced,
            rowGroups: groups,
            gridCssVars: cssVars,
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
        rowGroups,
        gridCssVars,
    };
}
