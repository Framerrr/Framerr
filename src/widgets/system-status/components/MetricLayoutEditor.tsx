/**
 * MetricLayoutEditor — Custom row-based mini grid for configuring System Status metric layout.
 * 
 * Rendered inside WidgetConfigModal via the 'component' option type.
 * 
 * Custom implementation (no GridStack) because the layout needs:
 * - Paired resize: grow one item → shrink its row partner
 * - Row-level reorder via drag-to-swap (cards swap positions + inherit each other's width)
 * - Rows always fill full width (widths sum to 4)
 * - Max 2 items per row, bounded by widget height
 * - Smart insertion: adding a metric splits a full-width row if no empty slot
 * - Removing from a pair expands the remaining item to full width
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { METRIC_REGISTRY } from '../hooks/useMetricConfig';
import type { MetricDef } from '../hooks/useMetricConfig';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLS = 4;
const MAX_ITEMS_PER_ROW = 2;
const MIN_ITEM_WIDTH = 1;

// ============================================================================
// TYPES
// ============================================================================

interface MetricLayoutEditorProps {
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
    widgetHeight?: number;
}

interface MetricSlot {
    key: string;
    w: number;
}

type LayoutRow = MetricSlot[];

/** Uniquely identifies a card's position */
interface CardPosition {
    rowIndex: number;
    slotIndex: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate max internal rows based on widget height in grid units.
 * Header takes ~1h of space when visible (widget h >= 2, matching useAdaptiveHeader threshold).
 */
function calculateMaxRows(widgetH: number, showHeader: boolean): number {
    // Content area in widget-h units
    const headerCost = (widgetH >= 2 && showHeader) ? 1 : 0;
    const contentH = widgetH - headerCost;
    // Max 4 rows (one per metric), min 1
    return Math.max(1, Math.min(contentH, 4));
}

/**
 * Build rows from config state.
 * Rows always fill full width (widths sum to COLS).
 * In stacked mode, every metric gets its own full-width row.
 */
function buildRows(config: Record<string, unknown>, isStacked: boolean): LayoutRow[] {
    const order = (config.metricOrder as string[] | undefined) || METRIC_REGISTRY.map(m => m.key);
    const spans = (config.metricSpans as Record<string, number> | undefined) || {};

    const visibleKeys = order.filter(key => {
        const def = METRIC_REGISTRY.find(m => m.key === key);
        if (!def) return false;
        return config[def.configKey] !== false;
    });

    // Stacked mode: one metric per row, all full width
    if (isStacked) {
        return visibleKeys.map(key => [{ key, w: COLS }]);
    }

    // Auto mode: pack into rows, max 2 per row, widths sum to COLS
    const rows: LayoutRow[] = [];
    let currentRow: MetricSlot[] = [];
    let currentWidth = 0;

    for (const key of visibleKeys) {
        const def = METRIC_REGISTRY.find(m => m.key === key);
        if (!def) continue;
        const w = spans[key] ?? def.defaultSpan;

        // Start new row if: doesn't fit OR already 2 items
        if ((currentWidth + w > COLS && currentWidth > 0) || currentRow.length >= MAX_ITEMS_PER_ROW) {
            rows.push(normalizeRow(currentRow));
            currentRow = [];
            currentWidth = 0;
        }

        currentRow.push({ key, w });
        currentWidth += w;
    }

    if (currentRow.length > 0) {
        rows.push(normalizeRow(currentRow));
    }

    return rows;
}

/**
 * Normalize a row so widths sum to COLS.
 * Single items get full width. Two items get proportional split.
 */
function normalizeRow(row: LayoutRow): LayoutRow {
    if (row.length === 0) return row;

    if (row.length === 1) {
        // Single item always fills the entire row
        return [{ ...row[0], w: COLS }];
    }

    // Two items: ensure they sum to COLS
    const totalW = row[0].w + row[1].w;
    if (totalW === COLS) return row;

    // Proportionally scale to fill COLS
    const ratio = row[0].w / totalW;
    const w0 = Math.max(MIN_ITEM_WIDTH, Math.min(COLS - MIN_ITEM_WIDTH, Math.round(ratio * COLS)));
    const w1 = COLS - w0;
    return [{ ...row[0], w: w0 }, { ...row[1], w: w1 }];
}

/**
 * Flatten rows back into config values (metricOrder, metricSpans).
 */
function rowsToConfig(
    rows: LayoutRow[],
    config: Record<string, unknown>
): { metricOrder: string[]; metricSpans: Record<string, number> | undefined } {
    const newOrder: string[] = [];
    const newSpans: Record<string, number> = {};

    for (const row of rows) {
        for (const slot of row) {
            newOrder.push(slot.key);
            const def = METRIC_REGISTRY.find(m => m.key === slot.key);
            if (def && slot.w !== def.defaultSpan) {
                newSpans[slot.key] = slot.w;
            }
        }
    }

    // Preserve hidden metric spans + append hidden keys to order
    const existingSpans = (config.metricSpans as Record<string, number> | undefined) || {};
    for (const [key, span] of Object.entries(existingSpans)) {
        if (!newOrder.includes(key)) {
            newSpans[key] = span;
        }
    }

    const existingOrder = (config.metricOrder as string[] | undefined) || METRIC_REGISTRY.map(m => m.key);
    const hiddenKeys = existingOrder.filter(k => !newOrder.includes(k));
    const fullOrder = [...newOrder, ...hiddenKeys];

    return {
        metricOrder: fullOrder,
        metricSpans: Object.keys(newSpans).length > 0 ? newSpans : undefined,
    };
}

function getDef(key: string): MetricDef | undefined {
    return METRIC_REGISTRY.find(m => m.key === key);
}

// ============================================================================
// ROW COMPONENT
// ============================================================================

interface MetricRowProps {
    row: LayoutRow;
    rowIndex: number;
    isStacked: boolean;
    onResize: (rowIndex: number, slotIndex: number, delta: -1 | 1) => void;
    onRemoveMetric: (rowIndex: number, slotIndex: number) => void;
    rowHeight: number;
    hasRowBelow: boolean;
    dragState: CardPosition | null;
    onDragStart: (pos: CardPosition) => void;
    onDragOver: (pos: CardPosition) => void;
    onDragEnd: () => void;
    dropTarget: CardPosition | null;
}

function MetricRow({
    row, rowIndex, isStacked, onResize, onRemoveMetric, rowHeight, hasRowBelow,
    dragState, onDragStart, onDragOver, onDragEnd, dropTarget,
}: MetricRowProps) {
    return (
        <div className="metric-row" style={{ height: `${rowHeight}px` }}>
            {/* Metric slots */}
            <div className="metric-row-slots">
                {row.map((slot, slotIndex) => {
                    const def = getDef(slot.key);
                    if (!def) return null;
                    const Icon = def.icon;
                    const widthPercent = (slot.w / COLS) * 100;
                    const isDropTarget = dropTarget?.rowIndex === rowIndex && dropTarget?.slotIndex === slotIndex;
                    const isDragging = dragState?.rowIndex === rowIndex && dragState?.slotIndex === slotIndex;

                    return (
                        <React.Fragment key={slot.key}>
                            <div
                                className={`metric-slot ${isDragging ? 'metric-slot--dragging' : ''} ${isDropTarget ? 'metric-slot--drop-target' : ''}`}
                                style={{ width: `${widthPercent}%` }}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', `${rowIndex},${slotIndex}`);
                                    onDragStart({ rowIndex, slotIndex });
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    onDragOver({ rowIndex, slotIndex });
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    onDragEnd();
                                }}
                                onDragEnd={onDragEnd}
                            >
                                <div className="metric-slot-card">
                                    <div className="metric-slot-info">
                                        <Icon size={14} className="text-accent" />
                                        <span className="text-xs text-theme-primary font-medium">{def.label}</span>
                                        <span className="text-xs text-theme-tertiary ml-auto">{slot.w}/{COLS}</span>
                                    </div>
                                    <button
                                        onClick={() => onRemoveMetric(rowIndex, slotIndex)}
                                        className="metric-slot-remove"
                                        title={`Hide ${def.label}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* Resize handle between two items in paired row */}
                            {!isStacked && slotIndex === 0 && row.length === 2 && (
                                <div className="metric-resize-handle-area">
                                    <button
                                        onClick={() => onResize(rowIndex, 0, 1)}
                                        disabled={slot.w >= COLS}
                                        className="metric-resize-btn"
                                        title="Grow left / shrink right"
                                    >
                                        <Plus size={10} />
                                    </button>
                                    <div className="metric-resize-divider" />
                                    <button
                                        onClick={() => onResize(rowIndex, 0, -1)}
                                        disabled={slot.w <= MIN_ITEM_WIDTH}
                                        className="metric-resize-btn"
                                        title="Shrink left / grow right"
                                    >
                                        <Minus size={10} />
                                    </button>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* Resize handle on right edge of solo full-width card */}
                {!isStacked && row.length === 1 && (
                    <div className="metric-resize-handle-area">
                        <button
                            onClick={() => onResize(rowIndex, 0, 1)}
                            disabled={true}
                            className="metric-resize-btn"
                            title="Already full width"
                        >
                            <Plus size={10} />
                        </button>
                        <div className="metric-resize-divider" />
                        <button
                            onClick={() => onResize(rowIndex, 0, -1)}
                            disabled={!hasRowBelow}
                            className="metric-resize-btn"
                            title="Pull card from row below"
                        >
                            <Minus size={10} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MetricLayoutEditor: React.FC<MetricLayoutEditorProps> = ({ config, updateConfig, widgetHeight }) => {
    const isStacked = config.layout === 'stacked';
    const rows = useMemo(() => buildRows(config, isStacked), [config, isStacked]);

    const h = widgetHeight || 6;
    const showHeader = config.showHeader !== false;
    const maxRows = calculateMaxRows(h, showHeader);

    // Row height for config modal preview (fixed — actual widget uses CSS container queries)
    const rowGap = 4;
    const rowHeight = 48;

    // Drag-to-swap state
    const [dragState, setDragState] = useState<CardPosition | null>(null);
    const [dropTarget, setDropTarget] = useState<CardPosition | null>(null);
    const dragStateRef = useRef<CardPosition | null>(null);
    const dropTargetRef = useRef<CardPosition | null>(null);

    // Visible metrics
    const visibleMetrics = METRIC_REGISTRY.filter(m => config[m.configKey] !== false);

    // === ACTIONS ===

    const commitRows = useCallback((newRows: LayoutRow[]) => {
        const { metricOrder, metricSpans } = rowsToConfig(newRows, config);
        updateConfig('metricOrder', metricOrder);
        updateConfig('metricSpans', metricSpans);
    }, [config, updateConfig]);

    const resizeSlot = useCallback((rowIndex: number, slotIndex: number, delta: -1 | 1) => {
        const row = rows[rowIndex];
        if (row.length !== 2 && delta === 1 && row.length === 1 && row[0].w === COLS) {
            // Solo card at full width — can't grow further
            return;
        }

        if (row.length === 2) {
            const otherIndex = slotIndex === 0 ? 1 : 0;
            const newW = row[slotIndex].w + delta;
            const otherNewW = row[otherIndex].w - delta;

            // Push cascade: if left card grows to COLS, push partner to new row below
            if (newW >= COLS) {
                const partner = row[otherIndex];
                const newRows = rows.map(r => [...r]);
                // Make current card solo at full width
                newRows[rowIndex] = [{ key: row[slotIndex].key, w: COLS }];
                // Insert partner as new row below
                newRows.splice(rowIndex + 1, 0, [{ ...partner, w: COLS }]);
                commitRows(newRows);
                return;
            }

            // Normal paired resize
            if (newW < MIN_ITEM_WIDTH || newW > COLS - MIN_ITEM_WIDTH) return;
            if (otherNewW < MIN_ITEM_WIDTH || otherNewW > COLS - MIN_ITEM_WIDTH) return;

            const newRows = rows.map((r, i) => {
                if (i !== rowIndex) return r;
                const newRow = [...r];
                newRow[slotIndex] = { ...newRow[slotIndex], w: newW };
                newRow[otherIndex] = { ...newRow[otherIndex], w: otherNewW };
                return newRow;
            });
            commitRows(newRows);
        } else if (row.length === 1 && delta === -1) {
            // Pull cascade: solo card shrinking — pull first card from row below
            const nextRowIndex = rowIndex + 1;
            if (nextRowIndex >= rows.length) return; // No row below to pull from

            const nextRow = rows[nextRowIndex];
            const pulledCard = nextRow[0]; // Take the first card from row below

            const newRows = rows.map(r => [...r]);
            const newW = Math.max(MIN_ITEM_WIDTH, COLS / 2);
            // Merge: current solo + pulled card become a paired row
            newRows[rowIndex] = [
                { key: row[0].key, w: newW },
                { key: pulledCard.key, w: COLS - newW },
            ];

            if (nextRow.length === 1) {
                // Remove the now-empty row below
                newRows.splice(nextRowIndex, 1);
            } else {
                // Row below had 2 cards — remaining card goes solo
                const remaining = nextRow[1];
                newRows[nextRowIndex] = [{ key: remaining.key, w: COLS }];
            }

            commitRows(newRows);
        }
    }, [rows, commitRows]);

    const removeMetric = useCallback((rowIndex: number, slotIndex: number) => {
        const row = rows[rowIndex];
        const slot = row[slotIndex];
        const def = getDef(slot.key);
        if (!def) return;

        // The config change triggers a rebuild.
        // buildRows + normalizeRow handles expanding remaining item to full width
        // and collapsing empty rows.
        updateConfig(def.configKey, false);
    }, [rows, updateConfig]);


    // Drag-to-swap handlers
    const handleDragStart = useCallback((pos: CardPosition) => {
        setDragState(pos);
        dragStateRef.current = pos;
    }, []);

    const handleDragOver = useCallback((pos: CardPosition) => {
        if (!dragStateRef.current) return;
        // Don't target self
        if (dragStateRef.current.rowIndex === pos.rowIndex && dragStateRef.current.slotIndex === pos.slotIndex) {
            setDropTarget(null);
            dropTargetRef.current = null;
            return;
        }
        setDropTarget(pos);
        dropTargetRef.current = pos;
    }, []);

    const handleDragEnd = useCallback(() => {
        const from = dragStateRef.current;
        const to = dropTargetRef.current;

        setDragState(null);
        setDropTarget(null);
        dragStateRef.current = null;
        dropTargetRef.current = null;

        if (!from || !to) return;
        if (from.rowIndex === to.rowIndex && from.slotIndex === to.slotIndex) return;

        // Swap the two cards — each inherits the other's width
        const newRows = rows.map(r => [...r]);
        const fromSlot = newRows[from.rowIndex][from.slotIndex];
        const toSlot = newRows[to.rowIndex][to.slotIndex];

        // Swap keys, keep widths in place (each card inherits the target's width)
        newRows[from.rowIndex][from.slotIndex] = { key: toSlot.key, w: fromSlot.w };
        newRows[to.rowIndex][to.slotIndex] = { key: fromSlot.key, w: toSlot.w };

        commitRows(newRows);
    }, [rows, commitRows]);

    // Visible rows = clamped by widget height
    const visibleRowSlice = rows.slice(0, maxRows);
    const hiddenRowCount = rows.length - visibleRowSlice.length;

    // Row counter constraints
    // + is enabled when there's a row with 2 metrics that can be split AND we haven't hit maxRows
    const canSplitRow = visibleRowSlice.some(r => r.length === 2) && rows.length < visibleMetrics.length;
    // − is enabled when there's more than 1 row (destructive: removes last row, hides its metrics)
    const canMergeRows = rows.length > 1;

    const handleIncrementRows = useCallback(() => {
        if (!canSplitRow) return;
        // Find last visible row with 2 metrics and split it into 2 full-width rows
        for (let i = visibleRowSlice.length - 1; i >= 0; i--) {
            if (rows[i].length === 2) {
                const [m1, m2] = rows[i];
                const newRows = rows.map(r => [...r]);
                newRows.splice(i, 1, [{ ...m1, w: COLS }], [{ ...m2, w: COLS }]);
                commitRows(newRows);
                return;
            }
        }
    }, [rows, visibleRowSlice, canSplitRow, commitRows]);

    const handleDecrementRows = useCallback(() => {
        if (!canMergeRows) return;
        // DESTRUCTIVE: remove the last row and hide its metrics
        const lastRow = rows[rows.length - 1];
        const newRows = rows.slice(0, -1);

        // Commit the reduced layout
        commitRows(newRows);

        // Hide the metrics that were in the removed row
        for (const slot of lastRow) {
            const def = getDef(slot.key);
            if (def) {
                updateConfig(def.configKey, false);
            }
        }
    }, [rows, canMergeRows, commitRows, updateConfig]);

    return (
        <div className="metric-layout-editor">

            {/* Row count selector */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-theme-secondary">Rows</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleDecrementRows}
                        disabled={!canMergeRows}
                        className="metric-row-counter-btn"
                        aria-label="Decrease rows"
                    >
                        −
                    </button>
                    <span className="metric-row-counter-value">{rows.length}</span>
                    <button
                        type="button"
                        onClick={handleIncrementRows}
                        disabled={!canSplitRow}
                        className="metric-row-counter-btn"
                        aria-label="Increase rows"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Row-based mini grid */}
            <div className="metric-layout-grid-wrapper rounded-lg border border-theme overflow-hidden bg-theme-primary">
                <div className="metric-layout-rows" style={{ gap: `${rowGap}px`, padding: `${rowGap}px` }}>
                    {visibleRowSlice.map((row, rowIndex) => (
                        <MetricRow
                            key={row.map(s => s.key).join('-')}
                            row={row}
                            rowIndex={rowIndex}
                            isStacked={isStacked}
                            onResize={resizeSlot}
                            onRemoveMetric={removeMetric}
                            rowHeight={rowHeight}
                            hasRowBelow={rowIndex < rows.length - 1}
                            dragState={dragState}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            dropTarget={dropTarget}
                        />
                    ))}

                    {visibleRowSlice.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-sm text-theme-tertiary">
                            No metrics visible. Click above to show metrics.
                        </div>
                    )}
                </div>
            </div>

            {/* Info line */}
            <div className="mt-1.5 text-xs text-theme-tertiary flex items-center justify-between">
                <span>{visibleMetrics.length} of {METRIC_REGISTRY.length} metrics · Drag cards to swap</span>
                <span>
                    {visibleRowSlice.length}/{rows.length} rows
                    {hiddenRowCount > 0 && ` (${hiddenRowCount} hidden)`}
                </span>
            </div>
        </div>
    );
};

export default MetricLayoutEditor;
