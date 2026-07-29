import { getWidgetMetadata } from '../../../widgets/registry';
import { GRID_COLS } from '../../../constants/gridConfig';
import type { Breakpoint } from '../core/types';

export interface EffectiveConstraints {
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
}

/**
 * Effective GridStack size constraints for a widget. Single source of truth
 * for the adapter node stamp, the live re-stamp effect, and WidgetResizeModal.
 * - relax=true (fixed-display): {} on BOTH breakpoints — GridStack's native
 *   unconstrained state; the engine still clamps w to the column count (4 on
 *   sm, 24 on lg) and enforces w/h >= 1 (vendor gridstack-engine.ts:405-415).
 * - relax=false, sm: hardcoded 1..4 width + registry minH/maxH (verbatim
 *   today's toGridStackWidget mobile stamp).
 * - relax=false, lg: registry minSize/maxSize verbatim (undefined = none).
 */
export function resolveWidgetConstraints(
    widgetType: string,
    breakpoint: Breakpoint,
    relaxConstraints: boolean,
): EffectiveConstraints {
    if (relaxConstraints) return {};
    const metadata = getWidgetMetadata(widgetType);
    if (breakpoint === 'sm') {
        return { minW: 1, maxW: GRID_COLS.sm, minH: metadata?.minSize?.h, maxH: metadata?.maxSize?.h };
    }
    return {
        minW: metadata?.minSize?.w,
        maxW: metadata?.maxSize?.w,
        minH: metadata?.minSize?.h,
        maxH: metadata?.maxSize?.h,
    };
}
