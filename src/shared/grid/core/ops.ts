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
import { GRID_COLS } from '../../../constants/gridConfig';

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

/**
 * Duplicate a widget with a new ID.
 * The clone is nudged one column to the right but keeps the source row.
 */
export function duplicateWidget(
    widgets: FramerrWidget[],
    widgetId: string,
    newId?: string
): FramerrWidget[] {
    const source = widgets.find(w => w.id === widgetId);
    if (!source) return widgets;

    const duplicated: FramerrWidget = {
        ...source,
        id: newId ?? generateWidgetId(),
        layout: {
            ...source.layout,
            x: source.layout.x + 1,
            y: source.layout.y,
        },
        mobileLayout: source.mobileLayout
            ? {
                ...source.mobileLayout,
                x: source.mobileLayout.x + 1,
                y: source.mobileLayout.y,
            }
            : undefined,
        config: source.config ? { ...source.config } : source.config,
    };

    return [...widgets, duplicated];
}



// ============================================================================
// TENTATIVE WIDGET OPERATIONS (External Drag-to-Grid)
// ============================================================================

/**
 * Special ID used for tentative widgets during external drag.
 * Only one tentative widget can exist at a time.
 */
export const TENTATIVE_WIDGET_ID = '__tentative__';


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
 * @param options - Optional configuration
 * @param options.mobileColumns - Number of columns in mobile view (default: GRID_COLS.sm = 4)
 * @param options.getMinHeight - Optional callback for registry-aware minimum height lookup
 * @returns Widgets with mobileLayout populated in reading order
 */
export function deriveLinkedMobileLayout(
    widgets: FramerrWidget[],
    options?: {
        mobileColumns?: number;
        getMinHeight?: (widgetType: string) => number | undefined;
    }
): FramerrWidget[] {
    // Defensive filter: skip widgets without valid desktop layout
    const validWidgets = widgets.filter(
        w => w.layout && typeof w.layout.x === 'number'
    );
    if (validWidgets.length === 0) return [];

    const mobileColumns = options?.mobileColumns ?? GRID_COLS.sm;
    const getMinHeight = options?.getMinHeight;

    interface BandInfo {
        widget: FramerrWidget;
        x: number;
        y: number;
        yEnd: number;
    }

    // Extract desktop layout info with Y range
    const bandInfos: BandInfo[] = validWidgets.map(w => ({
        widget: w,
        x: w.layout.x,
        y: w.layout.y,
        yEnd: w.layout.y + w.layout.h,
    }));

    // Sort by Y, then X, then ID for deterministic ordering
    const ySorted = [...bandInfos].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return (a.widget.id || '').localeCompare(b.widget.id || '');
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
            return (a.widget.id || '').localeCompare(b.widget.id || '');
        })
    );

    // Create stacked mobile layout
    let currentY = 0;
    return sortedInfos.map(info => {
        // Registry-aware height: max of registry minH and desktop h
        const registryMinH = getMinHeight?.(info.widget.type) ?? 0;
        const mobileHeight = Math.max(registryMinH, info.widget.layout.h);
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
 *
 * @param widgets - Source widgets
 * @param options - Optional configuration
 * @param options.mobileColumns - Number of columns in mobile view (default: GRID_COLS.sm = 4)
 * @param options.getMinHeight - Optional callback for registry-aware minimum height lookup
 */
export function snapshotToMobileLayout(
    widgets: FramerrWidget[],
    options?: {
        mobileColumns?: number;
        getMinHeight?: (widgetType: string) => number | undefined;
    }
): FramerrWidget[] {
    const mobileColumns = options?.mobileColumns ?? GRID_COLS.sm;
    const getMinHeight = options?.getMinHeight;

    return widgets.map(w => ({
        ...w,
        mobileLayout: w.mobileLayout ?? {
            x: 0,
            y: 0,
            w: mobileColumns,
            h: Math.max(getMinHeight?.(w.type) ?? 0, w.layout.h),
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

