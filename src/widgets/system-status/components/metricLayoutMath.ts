import { isGaugeEligible, GAUGE_MIN_SPAN } from '../hooks/useMetricConfig';

export const COLS = 4;
export const MIN_ITEM_WIDTH = 1;

export interface MetricSlot {
    key: string;
    w: number;
}

export type LayoutRow = MetricSlot[];

/**
 * Per-slot minimum width floor. Mirrors MIN_ITEM_WIDTH, elevated to
 * GAUGE_MIN_SPAN for any slot whose stored viz preference is 'gauge'.
 */
export function effectiveMinWidth(key: string, metricViz: Record<string, string>): number {
    if (isGaugeEligible(key) && metricViz[key] === 'gauge') return GAUGE_MIN_SPAN;
    return MIN_ITEM_WIDTH;
}

/**
 * Pure paired-row resize arithmetic — bounds check for +/-1 resize on a 2-slot row.
 */
export function resizePairedRow(
    row: LayoutRow,
    slotIndex: number,
    delta: -1 | 1,
    metricViz: Record<string, string>
): LayoutRow | null {
    if (row.length !== 2) return null;
    const otherIndex = slotIndex === 0 ? 1 : 0;
    const newW = row[slotIndex].w + delta;
    const otherNewW = row[otherIndex].w - delta;
    const minW = effectiveMinWidth(row[slotIndex].key, metricViz);
    const otherMinW = effectiveMinWidth(row[otherIndex].key, metricViz);

    if (newW < minW || newW > COLS - otherMinW) return null;
    if (otherNewW < otherMinW || otherNewW > COLS - minW) return null;

    const newRow = [...row];
    newRow[slotIndex] = { ...newRow[slotIndex], w: newW };
    newRow[otherIndex] = { ...newRow[otherIndex], w: otherNewW };
    return newRow;
}

/**
 * Pure drag-swap acceptance check — each side must satisfy its floor after the trade.
 */
export function canAcceptSwap(
    fromSlot: MetricSlot,
    toSlot: MetricSlot,
    metricViz: Record<string, string>
): boolean {
    if (effectiveMinWidth(toSlot.key, metricViz) > fromSlot.w) return false;
    if (effectiveMinWidth(fromSlot.key, metricViz) > toSlot.w) return false;
    return true;
}

/**
 * Pure auto-adjust for enabling gauge on a too-narrow paired slot.
 */
export function computeGaugeAutoAdjustRow(
    row: LayoutRow,
    slotIndex: number,
    metricViz: Record<string, string>
): LayoutRow | null {
    const slot = row[slotIndex];
    if (row.length !== 2 || slot.w >= GAUGE_MIN_SPAN) return null;
    const otherIndex = slotIndex === 0 ? 1 : 0;
    const otherMinW = effectiveMinWidth(row[otherIndex].key, metricViz);
    const otherNewW = COLS - GAUGE_MIN_SPAN;
    if (otherNewW < otherMinW) return null;
    const newRow = [...row];
    newRow[slotIndex] = { ...newRow[slotIndex], w: GAUGE_MIN_SPAN };
    newRow[otherIndex] = { ...newRow[otherIndex], w: otherNewW };
    return newRow;
}

/**
 * Row-aware check for whether slotIndex's slot could become a gauge.
 */
export function canEnableGaugeInRow(row: LayoutRow, slotIndex: number, metricViz: Record<string, string>): boolean {
    const slot = row[slotIndex];
    if (slot.w >= GAUGE_MIN_SPAN) return true;
    if (row.length === 1) return true;
    return computeGaugeAutoAdjustRow(row, slotIndex, metricViz) !== null;
}
