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

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    closestCenter,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { METRIC_REGISTRY, getMetricDefsForIntegration, computeMaxRows } from '../hooks/useMetricConfig';
import { useIntegrationSchemas } from '../../../api/hooks';
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
 * Build rows from config state.
 * Rows always fill full width (widths sum to COLS).
 * In stacked mode, every metric gets its own full-width row.
 *
 * Dual layout storage:
 * - Collapsed mode reads from metricOrder / metricSpans
 * - Individual disk mode reads from diskMetricOrder / diskMetricSpans
 *   (falling back to expanding metricOrder on first use)
 */
function buildRows(config: Record<string, unknown>, isStacked: boolean, registry: MetricDef[]): LayoutRow[] {
    const isDiskIndividual = config.diskCollapsed === 'individual';
    const diskList = (config._diskList as { id: string; name: string }[] | undefined) || [];
    const diskSelection = config.diskSelection as string[] | undefined;

    // Choose the right order/spans for the current mode
    let order: string[];
    let spans: Record<string, number>;

    if (isDiskIndividual && diskList.length > 0) {
        // Individual mode: use diskMetricOrder if it exists
        const savedDiskOrder = config.diskMetricOrder as string[] | undefined;
        if (savedDiskOrder && savedDiskOrder.length > 0) {
            order = savedDiskOrder;
            spans = (config.diskMetricSpans as Record<string, number> | undefined) || {};
        } else {
            // First time in individual mode: expand diskUsage from collapsed layout
            const baseOrder = (config.metricOrder as string[] | undefined) || registry.map(m => m.key);
            spans = { ...((config.metricSpans as Record<string, number> | undefined) || {}) };
            const selectedDisks = diskList.filter(d =>
                !diskSelection || diskSelection.length === 0 || diskSelection.includes(d.id)
            );
            const diskIdx = baseOrder.indexOf('diskUsage');
            if (diskIdx >= 0 && selectedDisks.length > 0) {
                const diskKeys = selectedDisks.map(d => `disk-${d.id}`);
                order = [
                    ...baseOrder.slice(0, diskIdx),
                    ...diskKeys,
                    ...baseOrder.slice(diskIdx + 1),
                ];
            } else {
                order = baseOrder;
            }
        }
    } else {
        // Collapsed mode: use metricOrder (normal)
        order = (config.metricOrder as string[] | undefined) || registry.map(m => m.key);
        spans = (config.metricSpans as Record<string, number> | undefined) || {};
    }

    // Ensure all registry metrics are in the order — append any missing ones.
    // This handles metrics that were added to the registry after the order was saved,
    // or metrics that weren't included when the order was first persisted.
    const orderSet = new Set(order);
    const missingKeys = registry.map(m => m.key).filter(k => !orderSet.has(k));
    if (missingKeys.length > 0) {
        order = [...order, ...missingKeys];
    }

    // Filter to visible keys using getDef (handles disk-{id} → diskUsage fallback)
    let visibleKeys = order.filter(key => {
        const def = getDef(key, registry);
        if (!def) return false;
        return config[def.configKey] !== false;
    });

    // In individual mode, filter out diskUsage (replaced by disk-{id} keys)
    // and filter disk keys by current selection
    if (isDiskIndividual && diskList.length > 0) {
        const selectedDisks = diskList.filter(d =>
            !diskSelection || diskSelection.length === 0 || diskSelection.includes(d.id)
        );
        const selectedIds = new Set(selectedDisks.map(d => d.id));
        visibleKeys = visibleKeys.filter(k => {
            if (k === 'diskUsage') return false; // replaced by individual entries
            if (!k.startsWith('disk-')) return true;
            return selectedIds.has(k.slice(5));
        });
    }

    // Stacked mode: one metric per row, all full width
    if (isStacked) {
        return visibleKeys.map(key => [{ key, w: COLS }]);
    }

    // Auto mode: pack into rows, max 2 per row, widths sum to COLS
    const rows: LayoutRow[] = [];
    let currentRow: MetricSlot[] = [];
    let currentWidth = 0;

    for (const key of visibleKeys) {
        const def = getDef(key, registry);
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
 * Flatten rows back into config values.
 * Returns keys appropriate for the current mode
 * (disk-{id} keys for individual mode, regular keys for collapsed).
 */
function rowsToConfig(
    rows: LayoutRow[],
    config: Record<string, unknown>,
    registry: MetricDef[]
): { order: string[]; spans: Record<string, number> | undefined } {
    const newOrder: string[] = [];
    const newSpans: Record<string, number> = {};

    for (const row of rows) {
        for (const slot of row) {
            newOrder.push(slot.key);
            const def = getDef(slot.key, registry);
            if (def && slot.w !== def.defaultSpan) {
                newSpans[slot.key] = slot.w;
            }
        }
    }

    // Determine the full order including hidden keys from the source config
    const isDiskIndividual = config.diskCollapsed === 'individual';
    const sourceOrderKey = isDiskIndividual ? 'diskMetricOrder' : 'metricOrder';
    const existingOrder = (config[sourceOrderKey] as string[] | undefined)
        || (config.metricOrder as string[] | undefined)
        || registry.map(m => m.key);

    // Preserve hidden metric spans
    const sourceSpansKey = isDiskIndividual ? 'diskMetricSpans' : 'metricSpans';
    const existingSpans = (config[sourceSpansKey] as Record<string, number> | undefined) || {};
    for (const [key, span] of Object.entries(existingSpans)) {
        if (!newOrder.includes(key)) {
            newSpans[key] = span;
        }
    }

    const hiddenKeys = existingOrder.filter(k => !newOrder.includes(k));
    const fullOrder = [...newOrder, ...hiddenKeys];

    return {
        order: fullOrder,
        spans: Object.keys(newSpans).length > 0 ? newSpans : undefined,
    };
}

function getDef(key: string, registry: MetricDef[]): MetricDef | undefined {
    // For individual disk keys, fall back to the diskUsage definition
    if (key.startsWith('disk-')) {
        return registry.find(m => m.key === 'diskUsage');
    }
    return registry.find(m => m.key === key);
}

// ============================================================================
// DRAGGABLE METRIC SLOT (per card)
// ============================================================================

interface DraggableSlotProps {
    slot: MetricSlot;
    slotId: string;
    rowIndex: number;
    slotIndex: number;
    registry: MetricDef[];
    diskList?: { id: string; name: string }[];
    onRemoveMetric: (rowIndex: number, slotIndex: number) => void;
    activeId: string | null;
}

function DraggableSlot({
    slot, slotId, rowIndex, slotIndex, registry, diskList, onRemoveMetric, activeId,
}: DraggableSlotProps) {
    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        isDragging,
    } = useDraggable({ id: slotId, data: { rowIndex, slotIndex } });

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: slotId,
        data: { rowIndex, slotIndex },
    });

    const def = getDef(slot.key, registry);
    if (!def) return null;
    const Icon = def.icon;
    const diskName = slot.key.startsWith('disk-')
        ? diskList?.find(d => d.id === slot.key.slice(5))?.name
        : undefined;
    const label = diskName || def.label;
    const widthPercent = (slot.w / COLS) * 100;
    const isActiveSlot = activeId === slotId;

    // Merge draggable + droppable refs
    const setRefs = (el: HTMLDivElement | null) => {
        setDragRef(el);
        setDropRef(el);
    };

    return (
        <div
            ref={setRefs}
            className={`metric-slot ${isActiveSlot ? 'metric-slot--dragging' : ''} ${isOver && !isDragging ? 'metric-slot--drop-target' : ''}`}
            style={{
                width: `${widthPercent}%`,
                opacity: isDragging ? 0.4 : 1,
                transition: isDragging ? 'none' : 'opacity 150ms ease',
            }}
            {...attributes}
            {...listeners}
        >
            <div className="metric-slot-card">
                <div className="metric-slot-info">
                    <Icon size={14} className="text-accent" />
                    <span className="text-xs text-theme-primary font-medium">{label}</span>
                    <span className="text-xs text-theme-tertiary ml-auto">{slot.w}/{COLS}</span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMetric(rowIndex, slotIndex);
                    }}
                    className="metric-slot-remove"
                    title={`Hide ${label}`}
                >
                    ×
                </button>
            </div>
        </div>
    );
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
    registry: MetricDef[];
    diskList?: { id: string; name: string }[];
    totalRows: number;
    onMoveRow: (rowIndex: number, direction: -1 | 1) => void;
    activeId: string | null;
}

function MetricRow({
    row, rowIndex, isStacked, onResize, onRemoveMetric, rowHeight, hasRowBelow,
    registry, diskList, totalRows, onMoveRow, activeId,
}: MetricRowProps) {
    const isFirstRow = rowIndex === 0;
    const isLastRow = rowIndex === totalRows - 1;

    return (
        <div className="metric-row" style={{ height: `${rowHeight}px` }}>
            {/* Row move buttons (left side) */}
            <div className="metric-row-move-area">
                <button
                    onClick={() => onMoveRow(rowIndex, -1)}
                    disabled={isFirstRow}
                    className="metric-resize-btn"
                    title="Move row up"
                >
                    <ChevronUp size={10} />
                </button>
                <div className="metric-resize-divider" />
                <button
                    onClick={() => onMoveRow(rowIndex, 1)}
                    disabled={isLastRow}
                    className="metric-resize-btn"
                    title="Move row down"
                >
                    <ChevronDown size={10} />
                </button>
            </div>
            {/* Metric slots */}
            <div className="metric-row-slots">
                {row.map((slot, slotIndex) => {
                    const slotId = `${rowIndex}-${slotIndex}`;
                    return (
                        <React.Fragment key={slotId}>
                            <DraggableSlot
                                slot={slot}
                                slotId={slotId}
                                rowIndex={rowIndex}
                                slotIndex={slotIndex}
                                registry={registry}
                                diskList={diskList}
                                onRemoveMetric={onRemoveMetric}
                                activeId={activeId}
                            />

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
    // Derive integration type from the selected integration ID
    const selectedIntId = config.integrationId as string | undefined;
    const integrationType = selectedIntId ? selectedIntId.split('-')[0] : undefined;

    // Schema-driven metric filtering: only show metrics the plugin declares
    const { data: schemas } = useIntegrationSchemas();
    const schemaMetricKeys = useMemo(
        () => integrationType ? schemas?.[integrationType]?.metrics?.map(m => m.key) : undefined,
        [integrationType, schemas]
    );
    const availableMetrics = useMemo(
        () => getMetricDefsForIntegration(integrationType, schemaMetricKeys),
        [integrationType, schemaMetricKeys]
    );
    const isStacked = config.layout === 'stacked';
    const rows = useMemo(() => buildRows(config, isStacked, availableMetrics), [config, isStacked, availableMetrics]);
    const diskList = (config._diskList as { id: string; name: string }[] | undefined) || [];

    const h = widgetHeight || 6;
    const showHeader = config.showHeader !== false;
    const maxRows = computeMaxRows(h, showHeader);

    // Row height for config modal preview (fixed — actual widget uses CSS container queries)
    const rowGap = 4;
    const rowHeight = 48;

    // @dnd-kit sensors for drag
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        useSensor(KeyboardSensor)
    );

    // Track the actively dragged slot ID and its pixel dimensions for DragOverlay
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [activeWidth, setActiveWidth] = useState<number>(120);
    const [activeHeight, setActiveHeight] = useState<number>(48);

    // Visible metrics — filtered by integration availability
    const visibleMetrics = availableMetrics.filter(m => config[m.configKey] !== false);

    // === ACTIONS ===

    const commitRows = useCallback((newRows: LayoutRow[]) => {
        const isDiskIndividual = config.diskCollapsed === 'individual';
        const { order, spans } = rowsToConfig(newRows, config, availableMetrics);

        if (isDiskIndividual) {
            updateConfig('diskMetricOrder', order);
            updateConfig('diskMetricSpans', spans);
        } else {
            updateConfig('metricOrder', order);
            updateConfig('metricSpans', spans);
        }
    }, [config, updateConfig, availableMetrics]);

    const resizeSlot = useCallback((rowIndex: number, slotIndex: number, delta: -1 | 1) => {
        const row = rows[rowIndex];
        if (row.length !== 2 && delta === 1 && row.length === 1 && row[0].w === COLS) {
            return;
        }

        if (row.length === 2) {
            const otherIndex = slotIndex === 0 ? 1 : 0;
            const newW = row[slotIndex].w + delta;
            const otherNewW = row[otherIndex].w - delta;

            if (newW >= COLS) {
                const partner = row[otherIndex];
                const newRows = rows.map(r => [...r]);
                newRows[rowIndex] = [{ key: row[slotIndex].key, w: COLS }];
                newRows.splice(rowIndex + 1, 0, [{ ...partner, w: COLS }]);
                commitRows(newRows);
                return;
            }

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
            const nextRowIndex = rowIndex + 1;
            if (nextRowIndex >= rows.length) return;

            const nextRow = rows[nextRowIndex];
            const pulledCard = nextRow[0];

            const newRows = rows.map(r => [...r]);
            const newW = Math.max(MIN_ITEM_WIDTH, COLS / 2);
            newRows[rowIndex] = [
                { key: row[0].key, w: newW },
                { key: pulledCard.key, w: COLS - newW },
            ];

            if (nextRow.length === 1) {
                newRows.splice(nextRowIndex, 1);
            } else {
                const remaining = nextRow[1];
                newRows[nextRowIndex] = [{ key: remaining.key, w: COLS }];
            }

            commitRows(newRows);
        }
    }, [rows, commitRows]);

    const removeMetric = useCallback((rowIndex: number, slotIndex: number) => {
        const row = rows[rowIndex];
        const slot = row[slotIndex];

        if (slot.key.startsWith('disk-')) {
            const diskId = slot.key.slice(5);
            const diskList = (config._diskList as { id: string; name: string }[] | undefined) || [];
            const currentSelection = config.diskSelection as string[] | undefined;

            const allIds = diskList.map(d => d.id);
            const currentIds = currentSelection && currentSelection.length > 0
                ? currentSelection
                : allIds;

            const newIds = currentIds.filter(id => id !== diskId);
            updateConfig('diskSelection', newIds.length > 0 ? newIds : undefined);
            return;
        }

        const def = getDef(slot.key, availableMetrics);
        if (!def) return;
        updateConfig(def.configKey, false);
    }, [rows, updateConfig, config, availableMetrics]);

    // @dnd-kit drag handlers
    const handleDndDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        // Capture the dragged element's actual dimensions so DragOverlay matches
        const target = event.activatorEvent?.target as HTMLElement | null;
        const slotEl = target?.closest('.metric-slot') as HTMLElement | null;
        if (slotEl) {
            const rect = slotEl.getBoundingClientRect();
            setActiveWidth(rect.width);
            setActiveHeight(rect.height);
        }
    }, []);

    const handleDndDragOver = useCallback((event: DragOverEvent) => {
        setOverId(event.over ? (event.over.id as string) : null);
    }, []);

    const handleDndDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id) return;

        const from = active.data.current as CardPosition;
        const to = over.data.current as CardPosition;
        if (!from || !to) return;

        // Swap the two cards — each inherits the other's width
        const newRows = rows.map(r => [...r]);
        const fromSlot = newRows[from.rowIndex][from.slotIndex];
        const toSlot = newRows[to.rowIndex][to.slotIndex];

        newRows[from.rowIndex][from.slotIndex] = { key: toSlot.key, w: fromSlot.w };
        newRows[to.rowIndex][to.slotIndex] = { key: fromSlot.key, w: toSlot.w };

        commitRows(newRows);
    }, [rows, commitRows]);

    const moveRow = useCallback((rowIndex: number, direction: -1 | 1) => {
        const targetIndex = rowIndex + direction;
        if (targetIndex < 0 || targetIndex >= rows.length) return;
        const newRows = rows.map(r => [...r]);
        [newRows[rowIndex], newRows[targetIndex]] = [newRows[targetIndex], newRows[rowIndex]];
        commitRows(newRows);
    }, [rows, commitRows]);

    // Find the slot info for the active drag overlay
    const activeSlotInfo = useMemo(() => {
        if (!activeId) return null;
        const [r, s] = activeId.split('-').map(Number);
        const row = rows[r];
        if (!row) return null;
        const slot = row[s];
        if (!slot) return null;
        const def = getDef(slot.key, availableMetrics);
        if (!def) return null;
        const diskName = slot.key.startsWith('disk-')
            ? diskList?.find(d => d.id === slot.key.slice(5))?.name
            : undefined;
        return { label: diskName || def.label, icon: def.icon, w: slot.w };
    }, [activeId, rows, availableMetrics, diskList]);

    // Compute display rows — show live swap preview during drag
    const displayRows = useMemo(() => {
        if (!activeId || !overId || activeId === overId) return rows;
        const [fromR, fromS] = activeId.split('-').map(Number);
        const [toR, toS] = overId.split('-').map(Number);
        // Bounds check
        if (fromR >= rows.length || toR >= rows.length) return rows;
        if (fromS >= rows[fromR].length || toS >= rows[toR].length) return rows;

        const preview = rows.map(r => [...r]);
        const fromSlot = preview[fromR][fromS];
        const toSlot = preview[toR][toS];
        preview[fromR][fromS] = { key: toSlot.key, w: fromSlot.w };
        preview[toR][toS] = { key: fromSlot.key, w: toSlot.w };
        return preview;
    }, [rows, activeId, overId]);

    // Visible rows = clamped by widget height
    const visibleRowSlice = displayRows.slice(0, maxRows);
    const hiddenRowCount = rows.length - visibleRowSlice.length;

    return (
        <div className="metric-layout-editor">

            {/* Row-based mini grid */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDndDragStart}
                onDragOver={handleDndDragOver}
                onDragEnd={handleDndDragEnd}
            >
                <div className="metric-layout-grid-wrapper rounded-lg border border-theme overflow-hidden bg-theme-primary">
                    <div className="metric-layout-rows" style={{ gap: `${rowGap}px`, padding: `${rowGap}px` }}>
                        {visibleRowSlice.map((row: LayoutRow, rowIndex: number) => (
                            <MetricRow
                                key={`row-${rowIndex}`}
                                row={row}
                                rowIndex={rowIndex}
                                isStacked={isStacked}
                                onResize={resizeSlot}
                                onRemoveMetric={removeMetric}
                                rowHeight={rowHeight}
                                hasRowBelow={rowIndex < rows.length - 1}
                                registry={availableMetrics}
                                diskList={diskList}
                                totalRows={visibleRowSlice.length}
                                onMoveRow={moveRow}
                                activeId={activeId}
                            />
                        ))}

                        {visibleRowSlice.length === 0 && (
                            <div className="flex items-center justify-center py-8 text-sm text-theme-tertiary">
                                No metrics visible. Click above to show metrics.
                            </div>
                        )}
                    </div>
                </div>

                {/* Drag overlay — follows pointer/finger */}
                <DragOverlay dropAnimation={null}>
                    {activeSlotInfo ? (
                        <div className="metric-slot" style={{ width: `${activeWidth}px`, height: `${activeHeight}px`, opacity: 0.9 }}>
                            <div className="metric-slot-card" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                <div className="metric-slot-info">
                                    <activeSlotInfo.icon size={14} className="text-accent" />
                                    <span className="text-xs text-theme-primary font-medium">{activeSlotInfo.label}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Info line */}
            <div className="mt-1.5 text-xs text-theme-tertiary flex items-center justify-between">
                <span>{visibleMetrics.length} of {availableMetrics.length} metrics · Drag cards to swap</span>
                <span>
                    {visibleRowSlice.length}/{rows.length} rows
                    {hiddenRowCount > 0 && ` (${hiddenRowCount} hidden)`}
                </span>
            </div>
        </div>
    );
};

export default MetricLayoutEditor;
