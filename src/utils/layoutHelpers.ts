/**
 * Layout Helper Functions
 * 
 * Centralized functions for creating layout items and calculating constraints.
 * Used by Dashboard, Template Builder, and layout utilities.
 * 
 * IMPORTANT: These functions ensure TRUE PARITY between Dashboard and Template Builder.
 */

import {
    GRID_COLS,
    DESKTOP_BREAKPOINT,
    MOBILE_BREAKPOINT,
    DEFAULT_WIDGET_WIDTH,
    DEFAULT_WIDGET_HEIGHT,
    DEFAULT_MIN_HEIGHT,
    DEFAULT_MAX_HEIGHT,
    type Breakpoint
} from '../constants/gridConfig';
import { getWidgetMetadata } from '../widgets/registry';
import type { FramerrWidget, WidgetLayout } from '../../shared/types/widget';

// =============================================================================
// Types
// =============================================================================

export interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
}

export interface LayoutConstraints {
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
}

// =============================================================================
// Constraint Scaling
// =============================================================================

/**
 * Scale desktop column width to mobile column width
 * Desktop uses 24 columns, mobile uses 4 columns
 * 
 * Example: Desktop minW of 12 → Mobile minW of 2 (12/24*4 = 2)
 */
export const scaleWidthToMobile = (desktopWidth: number): number => {
    return Math.max(1, Math.round(desktopWidth / GRID_COLS.lg * GRID_COLS.sm));
};

/**
 * Get layout constraints for a widget type, scaled appropriately for breakpoint
 * 
 * CRITICAL: This is the key function for Dashboard/Template Builder parity.
 * Mobile constraints are scaled from desktop values.
 */
export const getScaledConstraints = (
    widgetType: string,
    breakpoint: Breakpoint
): LayoutConstraints => {
    const metadata = getWidgetMetadata(widgetType);
    if (!metadata) {
        return {
            minW: 1,
            minH: DEFAULT_MIN_HEIGHT,
            maxW: breakpoint === MOBILE_BREAKPOINT ? GRID_COLS.sm : GRID_COLS.lg,
            maxH: DEFAULT_MAX_HEIGHT,
        };
    }

    if (breakpoint === MOBILE_BREAKPOINT) {
        // Mobile: Scale minW, cap maxW to full width
        return {
            minW: scaleWidthToMobile(metadata.minSize?.w || 1),
            minH: metadata.minSize?.h || DEFAULT_MIN_HEIGHT,
            maxW: GRID_COLS.sm, // Always full width max on mobile
            maxH: metadata.maxSize?.h || DEFAULT_MAX_HEIGHT,
        };
    }

    // Desktop: Use raw values
    return {
        minW: metadata.minSize?.w || 1,
        minH: metadata.minSize?.h || DEFAULT_MIN_HEIGHT,
        maxW: metadata.maxSize?.w || GRID_COLS.lg,
        maxH: metadata.maxSize?.h || DEFAULT_MAX_HEIGHT,
    };
};

/**
 * Get raw (desktop) layout constraints from widget metadata
 * Used when building layouts useMemo where breakpoint-specific scaling
 * is applied via data-grid prop
 */
export const getRawConstraints = (widgetType: string): LayoutConstraints => {
    const metadata = getWidgetMetadata(widgetType);
    if (!metadata) return {};

    return {
        ...(metadata.minSize?.w && { minW: metadata.minSize.w }),
        ...(metadata.minSize?.h && { minH: metadata.minSize.h }),
        ...(metadata.maxSize?.w && { maxW: metadata.maxSize.w }),
        ...(metadata.maxSize?.h && { maxH: metadata.maxSize.h }),
    };
};

// =============================================================================
// Layout Item Creation
// =============================================================================

/**
 * Get default size for a widget type from metadata
 */
export const getDefaultSize = (widgetType: string): { w: number; h: number } => {
    const metadata = getWidgetMetadata(widgetType);
    return {
        w: metadata?.defaultSize?.w ?? DEFAULT_WIDGET_WIDTH,
        h: metadata?.defaultSize?.h ?? DEFAULT_WIDGET_HEIGHT,
    };
};

/**
 * Create a desktop (lg) layout item for a widget
 */
export const createDesktopLayoutItem = (widget: FramerrWidget): LayoutItem => {
    const { w: defaultW, h: defaultH } = getDefaultSize(widget.type);
    return {
        i: widget.id,
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w ?? defaultW,
        h: widget.layout.h ?? defaultH,
        ...getRawConstraints(widget.type)
    };
};

/**
 * Create a mobile (sm) layout item for a widget
 */
export const createMobileLayoutItem = (widget: FramerrWidget): LayoutItem => {
    const { h: defaultH } = getDefaultSize(widget.type);
    const mobileLayout = widget.mobileLayout || widget.layout;
    return {
        i: widget.id,
        x: mobileLayout.x,
        y: mobileLayout.y,
        w: mobileLayout.w ?? GRID_COLS.sm, // Full width default on mobile
        h: mobileLayout.h ?? defaultH,
        ...getRawConstraints(widget.type)
    };
};

/**
 * Create layout item for specified breakpoint
 */
export const createLayoutItem = (widget: FramerrWidget, breakpoint: Breakpoint): LayoutItem => {
    return breakpoint === MOBILE_BREAKPOINT
        ? createMobileLayoutItem(widget)
        : createDesktopLayoutItem(widget);
};

// =============================================================================
// New Widget Layout Creation
// =============================================================================

/**
 * Create layout for a newly added widget (placed at top, full width)
 */
export const createNewWidgetLayout = (
    widgetType: string,
    breakpoint: Breakpoint
): WidgetLayout => {
    const { h: defaultH } = getDefaultSize(widgetType);

    if (breakpoint === MOBILE_BREAKPOINT) {
        return {
            x: 0,
            y: 0,
            w: GRID_COLS.sm,
            h: defaultH
        };
    }

    return {
        x: 0,
        y: 0,
        w: GRID_COLS.lg, // Full width on desktop too for new widgets
        h: defaultH
    };
};

/**
 * Create both lg and sm layouts for a new widget
 */
export const createNewWidgetLayouts = (widgetType: string): {
    lg: WidgetLayout;
    sm: WidgetLayout;
} => {
    const { h: defaultH } = getDefaultSize(widgetType);

    return {
        lg: { x: 0, y: 0, w: GRID_COLS.lg, h: defaultH },
        sm: { x: 0, y: 0, w: GRID_COLS.sm, h: defaultH }
    };
};

// =============================================================================
// Widget Sorting
// =============================================================================

/**
 * Sort widgets by their Y position in the specified breakpoint layout
 * Used for consistent DOM ordering that matches grid's internal state
 */
export const sortWidgetsByY = (
    widgets: FramerrWidget[],
    breakpoint: Breakpoint
): FramerrWidget[] => {
    return [...widgets].sort((a, b) => {
        const aLayout = breakpoint === MOBILE_BREAKPOINT
            ? (a.mobileLayout || a.layout)
            : a.layout;
        const bLayout = breakpoint === MOBILE_BREAKPOINT
            ? (b.mobileLayout || b.layout)
            : b.layout;
        return aLayout.y - bLayout.y;
    });
};

// =============================================================================
// Template Widget Conversion
// =============================================================================

/**
 * Convert a template widget layout to proper dashboard Widget layouts
 * Template widgets have a single `layout` object, not `layouts.lg/sm`
 */
export interface TemplateWidgetLayout {
    type: string;
    layout: { x: number; y: number; w: number; h: number };
    config?: Record<string, unknown>;
}

export const templateLayoutToWidgetLayouts = (
    templateLayout: { x: number; y: number; w: number; h: number },
    widgetType: string
): { lg: WidgetLayout; sm: WidgetLayout } => {
    const { h: defaultH } = getDefaultSize(widgetType);

    return {
        lg: {
            x: templateLayout.x,
            y: templateLayout.y,
            w: templateLayout.w,
            h: templateLayout.h
        },
        sm: {
            x: 0,
            y: 0, // Will be calculated by band detection
            w: GRID_COLS.sm,
            h: templateLayout.h ?? defaultH
        }
    };
};
