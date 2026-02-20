/**
 * Grid Core Operations - Pure Functions
 *
 * Library-agnostic layout operations. No React, no side effects.
 * These functions operate on FramerrWidget[] and return new arrays.
 *
 * ARCHITECTURE REFERENCE: docs/grid-rework/ARCHITECTURE.md Lines 542-593
 *
 * Usage from wrappers:
 * ```typescript
 * const newWidgets = ops.addWidget(widgets, newWidget);
 * setWidgets(newWidgets);
 * history.push(newWidgets);
 * ```
 */

import type {
    FramerrWidget,
    WidgetLayout,
    LayoutItem,
    LayoutModel,
    Breakpoint,
    ChangeDetectionOptions,
    GetConstraintsFn,
    WidgetConstraints,
} from './types';

import logger from '../../../utils/logger';

// ============================================================================
// WIDGET CRUD OPERATIONS
// ============================================================================

/**
 * Add a widget to the array.
 * Returns a new array with the widget added.
 * 
 * @param widgets - Current widget array
 * @param newWidget - Widget to add
 * @param options - Optional: position for drag-to-add, breakpoint for layout targeting
 */
export function addWidget(
    widgets: FramerrWidget[],
    newWidget: FramerrWidget,
    options?: {
        position?: { x: number; y: number };
        breakpoint?: Breakpoint;
    }
): FramerrWidget[] {
    if (!options?.position) {
        // Simple append (no position specified)
        return [...widgets, newWidget];
    }

    // Add with specific position (for drag-to-add)
    const { position, breakpoint = 'lg' } = options;

    const widgetWithPosition: FramerrWidget = breakpoint === 'sm'
        ? {
            ...newWidget,
            mobileLayout: {
                ...(newWidget.mobileLayout ?? newWidget.layout),
                x: position.x,
                y: position.y,
            },
        }
        : {
            ...newWidget,
            layout: {
                ...newWidget.layout,
                x: position.x,
                y: position.y,
            },
        };

    return [...widgets, widgetWithPosition];
}

/**
 * Delete a widget by ID.
 * Returns a new array without the widget.
 */
export function deleteWidget(
    widgets: FramerrWidget[],
    widgetId: string
): FramerrWidget[] {
    return widgets.filter(w => w.id !== widgetId);
}



// ============================================================================
// TENTATIVE WIDGET OPERATIONS (External Drag-to-Grid)
// ============================================================================

/**
 * Special ID used for tentative widgets during external drag.
 * Only one tentative widget can exist at a time.
 */
export const TENTATIVE_WIDGET_ID = '__tentative__';

/**
 * Inject a tentative widget during external drag.
 * 
 * The tentative widget is a placeholder that shows where the new widget
 * will be placed. It triggers RGL compaction so other widgets shift.
 * 
 * @param widgets - Current widget array
 * @param type - Widget type (e.g., 'clock', 'weather')  
 * @param position - Grid position { x, y }
 * @param size - Grid size { w, h }
 * @returns New array with tentative widget added
 * 
 * @example
 * ```typescript
 * // On drag move when entering grid
 * if (isOverGrid && !hasTentative) {
 *     setWidgets(injectTentativeWidget(widgets, 'clock', { x: 2, y: 0 }, { w: 4, h: 2 }));
 * }
 * ```
 */
export function injectTentativeWidget(
    widgets: FramerrWidget[],
    type: string,
    position: { x: number; y: number },
    size: { w: number; h: number }
): FramerrWidget[] {
    // Remove existing tentative if any (shouldn't happen, but safety)
    const filtered = widgets.filter(w => w.id !== TENTATIVE_WIDGET_ID);

    const tentativeWidget: FramerrWidget = {
        id: TENTATIVE_WIDGET_ID,
        type,
        layout: {
            x: position.x,
            y: position.y,
            w: size.w,
            h: size.h,
        },
        config: {},
    };

    return [...filtered, tentativeWidget];
}

/**
 * Update tentative widget position during drag.
 * 
 * @param widgets - Current widget array (must contain tentative)
 * @param position - New grid position
 * @returns Updated array, or original if no tentative exists
 */
export function moveTentativeWidget(
    widgets: FramerrWidget[],
    position: { x: number; y: number }
): FramerrWidget[] {
    const tentative = widgets.find(w => w.id === TENTATIVE_WIDGET_ID);
    if (!tentative) return widgets;

    // Skip if position hasn't changed
    if (tentative.layout.x === position.x && tentative.layout.y === position.y) {
        return widgets;
    }

    return widgets.map(w =>
        w.id === TENTATIVE_WIDGET_ID
            ? { ...w, layout: { ...w.layout, ...position } }
            : w
    );
}

/**
 * Commit tentative widget - convert to permanent widget.
 * 
 * Called on successful drop. Renames the tentative widget to a permanent ID.
 * 
 * @param widgets - Current widget array (must contain tentative)
 * @param newId - Permanent ID for the widget (optional, auto-generates if not provided)
 * @returns Updated array with permanent widget, or original if no tentative
 * 
 * @example
 * ```typescript
 * // On drop inside grid
 * if (over?.id === 'grid-dropzone') {
 *     setWidgets(commitTentativeWidget(widgets, `${type}-${Date.now()}`));
 * }
 * ```
 */
export function commitTentativeWidget(
    widgets: FramerrWidget[],
    newId?: string
): FramerrWidget[] {
    const tentative = widgets.find(w => w.id === TENTATIVE_WIDGET_ID);
    if (!tentative) return widgets;

    const permanentId = newId ?? generateWidgetId();

    return widgets.map(w =>
        w.id === TENTATIVE_WIDGET_ID
            ? { ...w, id: permanentId }
            : w
    );
}

/**
 * Remove tentative widget - cancel the drag or left the grid.
 * 
 * @param widgets - Current widget array
 * @returns Array without tentative widget
 * 
 * @example
 * ```typescript
 * // On drag leave grid or cancel
 * setWidgets(removeTentativeWidget(widgets));
 * ```
 */
export function removeTentativeWidget(
    widgets: FramerrWidget[]
): FramerrWidget[] {
    return widgets.filter(w => w.id !== TENTATIVE_WIDGET_ID);
}

/**
 * Check if a tentative widget exists.
 */
export function hasTentativeWidget(widgets: FramerrWidget[]): boolean {
    return widgets.some(w => w.id === TENTATIVE_WIDGET_ID);
}

/**
 * Get the tentative widget if it exists.
 */
export function getTentativeWidget(widgets: FramerrWidget[]): FramerrWidget | undefined {
    return widgets.find(w => w.id === TENTATIVE_WIDGET_ID);
}

// ============================================================================
// WIDGET MODIFICATION OPERATIONS
// ============================================================================

/**
 * Update a widget's config.
 * Returns a new array with the updated widget.
 */
export function updateWidgetConfig(
    widgets: FramerrWidget[],
    widgetId: string,
    configUpdates: Partial<FramerrWidget['config']>
): FramerrWidget[] {
    return widgets.map(w =>
        w.id === widgetId
            ? { ...w, config: { ...w.config, ...configUpdates } }
            : w
    );
}

/**
 * Resize/reposition a widget.
 * Returns a new array with the updated widget layout.
 */
export function resizeWidget(
    widgets: FramerrWidget[],
    widgetId: string,
    layoutUpdates: Partial<WidgetLayout>,
    breakpoint: Breakpoint = 'lg'
): FramerrWidget[] {
    return widgets.map(w => {
        if (w.id !== widgetId) return w;

        if (breakpoint === 'sm') {
            return {
                ...w,
                mobileLayout: {
                    ...(w.mobileLayout ?? w.layout),
                    ...layoutUpdates,
                },
            };
        }
        return {
            ...w,
            layout: { ...w.layout, ...layoutUpdates },
        };
    });
}

/**
 * Move a widget to a new position.
 * Convenience wrapper around resizeWidget for position-only changes.
 */
export function moveWidget(
    widgets: FramerrWidget[],
    widgetId: string,
    position: { x: number; y: number },
    breakpoint: Breakpoint = 'lg'
): FramerrWidget[] {
    return resizeWidget(widgets, widgetId, position, breakpoint);
}

// ============================================================================
// LAYOUT OPERATIONS
// ============================================================================

/**
 * Convert widgets to a LayoutModel (derived, transient).
 *
 * @param widgets - Source widget array
 * @param breakpoint - Which layout to extract ('lg' or 'sm')
 * @returns LayoutItem array for the specified breakpoint
 */
export function widgetsToLayoutItems(
    widgets: FramerrWidget[],
    breakpoint: Breakpoint
): LayoutItem[] {
    return widgets.map(w => {
        const layout = breakpoint === 'sm' && w.mobileLayout
            ? w.mobileLayout
            : w.layout;

        return {
            id: w.id,
            x: layout.x,
            y: layout.y,
            w: layout.w,
            h: layout.h,
        };
    });
}

/**
 * Convert widgets to full LayoutModel including both breakpoints.
 */
export function widgetsToLayoutModel(
    widgets: FramerrWidget[],
    includeMobile: boolean = true
): LayoutModel {
    return {
        desktop: widgetsToLayoutItems(widgets, 'lg'),
        mobile: includeMobile ? widgetsToLayoutItems(widgets, 'sm') : undefined,
    };
}

/**
 * Apply layout changes from LayoutItem[] back to widgets.
 *
 * @param widgets - Original widget array
 * @param layout - New layout positions
 * @param breakpoint - Which layout was changed
 * @returns Updated widget array
 */
export function applyLayoutToWidgets(
    widgets: FramerrWidget[],
    layout: LayoutItem[],
    breakpoint: Breakpoint
): FramerrWidget[] {
    const layoutMap = new Map(layout.map(l => [l.id, l]));

    return widgets.map(widget => {
        const item = layoutMap.get(widget.id);
        if (!item) return widget;

        const newLayout: WidgetLayout = {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
        };

        if (breakpoint === 'sm') {
            return { ...widget, mobileLayout: newLayout };
        }
        return { ...widget, layout: newLayout };
    });
}

/**
 * Normalize a layout - ensure all required fields are present.
 * Handles null/undefined gracefully.
 */
export function normalizeLayout(
    data: unknown
): LayoutItem[] {
    // Handle null/undefined
    if (!data || !Array.isArray(data)) {
        logger.warn('[Grid] Invalid layout data, returning empty');
        return [];
    }

    // Filter and normalize items
    return data
        .filter((item): item is Record<string, unknown> =>
            item !== null && typeof item === 'object'
        )
        .map(item => ({
            id: String(item.id ?? item.i ?? ''),
            x: Number(item.x ?? 0),
            y: Number(item.y ?? 0),
            w: Number(item.w ?? 4),
            h: Number(item.h ?? 2),
            minW: item.minW != null ? Number(item.minW) : undefined,
            maxW: item.maxW != null ? Number(item.maxW) : undefined,
            minH: item.minH != null ? Number(item.minH) : undefined,
            maxH: item.maxH != null ? Number(item.maxH) : undefined,
            locked: item.locked === true,
            static: item.static === true,
        }))
        .filter(item => item.id !== ''); // Remove items without ID
}

/**
 * Validate a layout - check for issues.
 */
export function validateLayout(layout: LayoutItem[]): boolean {
    if (!Array.isArray(layout)) return false;

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const item of layout) {
        if (!item.id) return false;
        if (ids.has(item.id)) return false;
        ids.add(item.id);
    }

    // Check for valid positions
    for (const item of layout) {
        if (item.x < 0 || item.y < 0) return false;
        if (item.w <= 0 || item.h <= 0) return false;
    }

    return true;
}

/**
 * Apply size constraints to layout items.
 */
export function applyConstraintsToLayout(
    layout: LayoutItem[],
    getConstraints: GetConstraintsFn,
    widgets: FramerrWidget[]
): LayoutItem[] {
    return layout.map(item => {
        const widget = widgets.find(w => w.id === item.id);
        if (!widget) return item;

        const constraints = getConstraints(widget.type);
        if (!constraints) return item;

        return {
            ...item,
            minW: constraints.minW ?? item.minW,
            maxW: constraints.maxW ?? item.maxW,
            minH: constraints.minH ?? item.minH,
            maxH: constraints.maxH ?? item.maxH,
        };
    });
}

// ============================================================================
// MOBILE LAYOUT OPERATIONS
// ============================================================================

/**
 * Band detection algorithm for auto-generating mobile layout order.
 *
 * Groups widgets that vertically overlap into "bands", then within each band
 * sorts by X position (left to right). This preserves intended reading order
 * when converting a multi-column desktop layout to single-column mobile.
 *
 * @param widgets - Source widgets with desktop layouts
 * @param mobileColumns - Number of columns in mobile view (default: 2)
 * @returns Widgets with mobileLayout populated in reading order
 */
export function deriveLinkedMobileLayout(
    widgets: FramerrWidget[],
    mobileColumns: number = 2
): FramerrWidget[] {
    if (widgets.length === 0) return [];

    interface BandInfo {
        widget: FramerrWidget;
        x: number;
        y: number;
        yEnd: number;
    }

    // Extract desktop layout info with Y range
    const bandInfos: BandInfo[] = widgets.map(w => ({
        widget: w,
        x: w.layout.x,
        y: w.layout.y,
        yEnd: w.layout.y + w.layout.h,
    }));

    // Sort by Y, then X, then ID for deterministic ordering
    const ySorted = [...bandInfos].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return a.widget.id.localeCompare(b.widget.id);
    });

    // Sweep line: Separate into horizontal bands
    const bands: BandInfo[][] = [];
    let currentBand: BandInfo[] = [];
    let currentBandMaxY = -1;

    ySorted.forEach(info => {
        if (currentBand.length === 0) {
            currentBand.push(info);
            currentBandMaxY = info.yEnd;
            return;
        }

        // Hard cut: widget starts at or after current band's bottom
        if (info.y >= currentBandMaxY) {
            bands.push(currentBand);
            currentBand = [info];
            currentBandMaxY = info.yEnd;
        } else {
            // Widget overlaps with current band
            currentBand.push(info);
            currentBandMaxY = Math.max(currentBandMaxY, info.yEnd);
        }
    });

    // Push final band
    if (currentBand.length > 0) {
        bands.push(currentBand);
    }

    // Sort each band by X (column), then Y, then ID
    const sortedInfos = bands.flatMap(band =>
        [...band].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            if (a.y !== b.y) return a.y - b.y;
            return a.widget.id.localeCompare(b.widget.id);
        })
    );

    // Create stacked mobile layout
    let currentY = 0;
    return sortedInfos.map(info => {
        const mobileHeight = info.widget.layout.h;
        const newMobileLayout: WidgetLayout = {
            x: 0,
            y: currentY,
            w: mobileColumns,
            h: mobileHeight,
        };
        currentY += mobileHeight;
        return {
            ...info.widget,
            mobileLayout: newMobileLayout,
        };
    });
}

/**
 * Create a snapshot of desktop layout as mobile layout.
 * Used when first editing on mobile while in linked mode.
 */
export function snapshotToMobileLayout(
    widgets: FramerrWidget[],
    mobileColumns: number = 2
): FramerrWidget[] {
    return widgets.map(w => ({
        ...w,
        mobileLayout: w.mobileLayout ?? {
            x: 0,
            y: 0,
            w: mobileColumns,
            h: w.layout.h,
        },
    }));
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Check if two widget arrays are structurally different.
 */
export function isDifferent(
    current: FramerrWidget[],
    baseline: FramerrWidget[],
    options: ChangeDetectionOptions = {}
): boolean {
    const {
        compareLayout = true,
        compareConfig = true,
        breakpoint = 'lg',
    } = options;

    // Different counts = definitely different
    if (current.length !== baseline.length) return true;

    // Compare each widget
    for (const currentWidget of current) {
        const baseWidget = baseline.find(w => w.id === currentWidget.id);

        // Widget doesn't exist in baseline
        if (!baseWidget) return true;

        // Compare layouts
        if (compareLayout) {
            const currentLayout = breakpoint === 'sm'
                ? (currentWidget.mobileLayout ?? currentWidget.layout)
                : currentWidget.layout;
            const baseLayout = breakpoint === 'sm'
                ? (baseWidget.mobileLayout ?? baseWidget.layout)
                : baseWidget.layout;

            if (
                currentLayout.x !== baseLayout.x ||
                currentLayout.y !== baseLayout.y ||
                currentLayout.w !== baseLayout.w ||
                currentLayout.h !== baseLayout.h
            ) {
                return true;
            }
        }

        // Compare configs
        if (compareConfig) {
            const currentConfig = JSON.stringify(currentWidget.config ?? {});
            const baseConfig = JSON.stringify(baseWidget.config ?? {});
            if (currentConfig !== baseConfig) return true;
        }
    }

    return false;
}

/**
 * Get IDs of widgets that changed between two arrays.
 */
export function getChangedWidgetIds(
    current: FramerrWidget[],
    baseline: FramerrWidget[]
): string[] {
    const changedIds: string[] = [];
    const baselineMap = new Map(baseline.map(w => [w.id, w]));

    for (const currentWidget of current) {
        const baseWidget = baselineMap.get(currentWidget.id);

        // New widget
        if (!baseWidget) {
            changedIds.push(currentWidget.id);
            continue;
        }

        // Check for changes
        if (
            currentWidget.layout.x !== baseWidget.layout.x ||
            currentWidget.layout.y !== baseWidget.layout.y ||
            currentWidget.layout.w !== baseWidget.layout.w ||
            currentWidget.layout.h !== baseWidget.layout.h ||
            JSON.stringify(currentWidget.config) !== JSON.stringify(baseWidget.config)
        ) {
            changedIds.push(currentWidget.id);
        }
    }

    // Deleted widgets
    for (const baseWidget of baseline) {
        if (!current.find(w => w.id === baseWidget.id)) {
            changedIds.push(baseWidget.id);
        }
    }

    return changedIds;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a widget by ID.
 */
export function getWidgetById(
    widgets: FramerrWidget[],
    widgetId: string
): FramerrWidget | undefined {
    return widgets.find(w => w.id === widgetId);
}

/**
 * Generate a unique widget ID.
 */
export function generateWidgetId(): string {
    return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if widget sets have the same IDs (for revert detection).
 */
export function widgetSetsMatch(
    widgetsA: FramerrWidget[],
    widgetsB: FramerrWidget[]
): boolean {
    if (widgetsA.length !== widgetsB.length) return false;

    const idsA = widgetsA.map(w => w.id).sort();
    const idsB = widgetsB.map(w => w.id).sort();

    return idsA.every((id, i) => id === idsB[i]);
}

// ============================================================================
// CRACK-BASED SNAPPING (Vertical Insertion Points)
// ============================================================================

/**
 * Breakpoint type for crack snapping (re-declared here to avoid circular deps).
 */
type BreakpointKey = 'lg' | 'sm';

/**
 * Find all vertical "cracks" (insertion points) from widget boundaries.
 * 
 * Cracks are the Y positions where new widgets can be inserted:
 * - Row 0 (top of grid)
 * - Top edge of each widget (widget.y)
 * - Bottom edge of each widget (widget.y + widget.h)
 * 
 * @param widgets - Current widget array
 * @param excludeId - Widget ID to exclude (e.g., the one being dragged)
 * @param breakpoint - Current breakpoint for layout selection
 * @returns Sorted array of unique crack positions
 * 
 * @example
 * ```typescript
 * // Widget A at y=0, h=2 and Widget B at y=2, h=3
 * const cracks = findVerticalCracks(widgets, null, 'lg');
 * // Returns: [0, 2, 5] (top, A-bottom/B-top, B-bottom)
 * ```
 */
export function findVerticalCracks(
    widgets: FramerrWidget[],
    excludeId: string | null,
    breakpoint: BreakpointKey
): number[] {
    const filtered = excludeId
        ? widgets.filter(w => w.id !== excludeId)
        : widgets;

    const crackSet = new Set<number>([0]); // Always include row 0

    for (const w of filtered) {
        const layout = (breakpoint === 'sm' && w.mobileLayout) ? w.mobileLayout : w.layout;
        crackSet.add(layout.y);
        crackSet.add(layout.y + layout.h);
    }

    return Array.from(crackSet).sort((a, b) => a - b);
}

/**
 * Select the optimal crack based on cursor position and movement direction.
 * 
 * When direction is known, selects the FIRST crack in that direction
 * (prevents skipping to farther cracks). When direction is null, uses
 * nearest by absolute distance.
 * 
 * @param cracks - Sorted array of crack positions
 * @param cursorRow - Current cursor row position
 * @param direction - Movement direction ('up', 'down', or null)
 * @param toleranceBuffer - Extra rows to include in direction filter (prevents skipping)
 *        - 0 = strict filtering (c < cursorRow for UP, c > cursorRow for DOWN) - best for internal drags
 *        - 1+ = tolerant filtering (includes cracks you might have just passed) - best for external drags
 * @returns The selected crack position
 * 
 * @example
 * ```typescript
 * const cracks = [0, 2, 5, 8];
 * // Strict mode (internal drags)
 * selectCrackByDirection(cracks, 3, 'down', 0); // Returns 5 (first crack strictly below)
 * // Tolerant mode (external drags)
 * selectCrackByDirection(cracks, 3, 'down', 1); // Returns 2 (includes crack we might have passed)
 * ```
 */
export function selectCrackByDirection(
    cracks: number[],
    cursorRow: number,
    direction: 'up' | 'down' | null,
    toleranceBuffer: number = 0
): number {
    if (cracks.length === 0) return 0;

    // Filter cracks by direction
    // toleranceBuffer controls strictness:
    // - 0: strict filtering (original internal drag behavior)
    // - 1+: tolerant filtering (original external drag behavior)
    let relevantCracks = cracks;

    if (direction === 'up') {
        // UP = toward row 0
        // Strict: only cracks strictly above cursor (c < cursorRow)
        // Tolerant: include crack at or slightly below cursor position (in case we just passed it)
        // But still exclude cracks far below (in the DOWN direction)
        const threshold = toleranceBuffer > 0 ? cursorRow + toleranceBuffer : cursorRow;
        relevantCracks = cracks.filter(c => c < threshold);
    } else if (direction === 'down') {
        // DOWN = toward higher rows  
        // Strict: only cracks strictly below cursor (c > cursorRow)
        // Tolerant: include crack at or slightly above cursor position (in case we just passed it)
        // But still exclude cracks far above (in the UP direction)
        const threshold = toleranceBuffer > 0 ? cursorRow - toleranceBuffer : cursorRow;
        relevantCracks = cracks.filter(c => c > threshold);
    }

    // Select first-in-direction crack
    if (direction === 'up' && relevantCracks.length > 0) {
        // Moving UP: take the MAX (highest crack that's still above us = first you'll hit)
        return Math.max(...relevantCracks);
    } else if (direction === 'down' && relevantCracks.length > 0) {
        // Moving DOWN: take the MIN (lowest crack that's still below us = first you'll hit)
        return Math.min(...relevantCracks);
    } else if (relevantCracks.length > 0) {
        // No direction yet: use nearest by absolute distance
        return relevantCracks.reduce((best, crack) =>
            Math.abs(crack - cursorRow) < Math.abs(best - cursorRow) ? crack : best);
    }

    return cracks[0] ?? 0;
}

/**
 * Calculate adaptive snap threshold based on gap size between cracks.
 * 
 * Small gaps require more precision (smaller threshold).
 * Large gaps allow more tolerance (larger threshold).
 * 
 * @param cracks - Sorted array of crack positions
 * @param targetCrack - The crack we're considering snapping to
 * @returns Threshold in rows (clamped between 0.5 and 1.5)
 * 
 * @example
 * ```typescript
 * const cracks = [0, 1, 3]; // Gap of 1 row, then 2 rows
 * calculateAdaptiveThreshold(cracks, 1); // Returns 0.5 (small gap = precise)
 * calculateAdaptiveThreshold(cracks, 3); // Returns 1.0 (medium gap)
 * ```
 */
export function calculateAdaptiveThreshold(
    cracks: number[],
    targetCrack: number
): number {
    const crackIndex = cracks.indexOf(targetCrack);
    if (crackIndex === -1) return 1.0;

    const gapToPrev = crackIndex > 0 ? targetCrack - cracks[crackIndex - 1] : 100;
    const gapToNext = crackIndex < cracks.length - 1 ? cracks[crackIndex + 1] - targetCrack : 100;
    const minGap = Math.min(gapToPrev, gapToNext);

    // Adaptive threshold: half the gap size, clamped between 0.5 and 1.5
    return Math.max(0.5, Math.min(1.5, minGap / 2));
}
