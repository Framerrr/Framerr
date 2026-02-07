/**
 * layoutEngine.ts - RGL Layout Computation (Adapter Layer)
 *
 * This module encapsulates all RGL-specific layout computation logic.
 * Core modules call these functions without knowing about RGL internals.
 *
 * Key functions:
 * - computeLayout: Move a widget and get the compacted layout
 */

// @ts-expect-error - RGL utils are not typed but exported
import { moveElement, compact, cloneLayout } from 'react-grid-layout/build/utils';
import type { FramerrWidget } from '../core/types';
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/** RGL's internal layout item format */
interface RglLayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    moved?: boolean;
    static?: boolean;
}

/** Configuration for layout computation */
export interface LayoutComputeConfig {
    cols: number;
    compactType: 'vertical' | 'horizontal' | null;
    isMobile: boolean;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert FramerrWidgets to RGL layout format
 */
function widgetsToRglLayout(widgets: FramerrWidget[], isMobile: boolean): RglLayoutItem[] {
    return widgets.map(w => {
        const layout = isMobile ? (w.mobileLayout ?? w.layout) : w.layout;
        return {
            i: w.id,
            x: layout.x,
            y: layout.y,
            w: layout.w,
            h: layout.h,
        };
    });
}

/**
 * Apply RGL layout back to FramerrWidgets
 */
function applyRglLayoutToWidgets(
    widgets: FramerrWidget[],
    rglLayout: RglLayoutItem[],
    isMobile: boolean
): FramerrWidget[] {
    return widgets.map(w => {
        const layoutItem = rglLayout.find((item: RglLayoutItem) => item.i === w.id);
        if (!layoutItem) return w;

        const newLayoutData = {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
        };

        if (isMobile) {
            return {
                ...w,
                mobileLayout: newLayoutData,
            };
        } else {
            return {
                ...w,
                layout: newLayoutData,
            };
        }
    });
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Compute a new layout after moving a widget to a new position.
 *
 * This uses RGL's internal moveElement() function which:
 * 1. Moves the widget to the new position
 * 2. Detects collisions with other widgets
 * 3. Pushes colliding widgets away
 *
 * Then applies compact() to fill any gaps.
 *
 * @param widgets - Current widget array
 * @param draggedId - ID of the widget being dragged
 * @param newPosition - New grid position { x, y }
 * @param config - Layout configuration
 * @returns Updated widget array with new positions
 */
export function computeLayout(
    widgets: FramerrWidget[],
    draggedId: string,
    newPosition: { x: number; y: number },
    config: LayoutComputeConfig
): FramerrWidget[] {
    const { cols, compactType, isMobile } = config;



    // Convert to RGL format
    const rglLayout = widgetsToRglLayout(widgets, isMobile);


    // Find the dragged item in the layout
    const draggedItem = rglLayout.find(item => item.i === draggedId);
    if (!draggedItem) {
        logger.warn('[layoutEngine] Dragged widget not found:', draggedId);
        return widgets;
    }

    // Clone layout to avoid mutations
    const layoutCopy = cloneLayout(rglLayout);

    // Find the dragged item in the cloned layout (at its ORIGINAL position)
    const draggedInCopy = layoutCopy.find((item: RglLayoutItem) => item.i === draggedId);
    if (!draggedInCopy) {
        return widgets;
    }



    // Mark dragged widget as moved=true for priority during compaction
    // This makes RGL treat it as "intentionally placed" so other widgets yield
    draggedInCopy.moved = true;

    // Use RGL's moveElement to handle collisions
    // IMPORTANT: Pass the item at its ORIGINAL position, moveElement will update it
    // The x,y params tell it WHERE to move the widget
    const movedLayout = moveElement(
        layoutCopy,
        draggedInCopy,
        newPosition.x,
        newPosition.y,
        true,  // isUserAction - enables smart swap behavior
        false, // preventCollision - allow widgets to push each other
        compactType,
        cols
    );



    // Compact the layout to fill any gaps
    const compactedLayout = compact(movedLayout, compactType, cols);



    // Convert back to FramerrWidgets
    return applyRglLayoutToWidgets(widgets, compactedLayout, isMobile);
}

/**
 * Get the grid configuration from a GridPolicy
 */
export function getLayoutConfig(
    policy: {
        view: { breakpoint: 'lg' | 'sm' };
        layout: {
            cols?: { lg?: number; sm?: number };
            compactType?: 'vertical' | 'horizontal' | null;
        };
    }
): LayoutComputeConfig {
    const isMobile = policy.view.breakpoint === 'sm';
    const cols = isMobile
        ? (policy.layout.cols?.sm ?? 4)
        : (policy.layout.cols?.lg ?? 24);
    const compactType = policy.layout.compactType ?? 'vertical';

    return { cols, compactType, isMobile };
}
