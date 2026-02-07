/**
 * Grid Configuration Constants
 * 
 * Single source of truth for all grid layout configuration.
 * Used by Dashboard, Template Builder, and layout utilities.
 * 
 * IMPORTANT: Changes here affect both Dashboard and Template Builder.
 */

// =============================================================================
// Breakpoints
// =============================================================================

/** Breakpoint widths in pixels */
export const GRID_BREAKPOINTS = {
    lg: 768,   // Desktop: >= 768px
    sm: 0      // Mobile: < 768px
} as const;

/** Desktop breakpoint key */
export const DESKTOP_BREAKPOINT = 'lg' as const;

/** Mobile breakpoint key */
export const MOBILE_BREAKPOINT = 'sm' as const;

// =============================================================================
// Column Configuration
// =============================================================================

/** Column counts per breakpoint */
export const GRID_COLS = {
    lg: 24,    // Desktop: 24-column grid
    sm: 4      // Mobile: 4-column grid (full width stacking)
} as const;

// =============================================================================
// Sizing
// =============================================================================

/** Row height in pixels (halved to enable finer-grained sizing) */
export const ROW_HEIGHT = 50;

/** Gap/margin between widgets [horizontal, vertical] in pixels
 * GridStack applies this as insets on each widget, so adjacent widgets have 2× this gap.
 * Value of 5 means 10px visual gap between adjacent widgets.
 */
export const GRID_MARGIN: [number, number] = [5, 5];

/** Container padding [horizontal, vertical] in pixels */
export const GRID_CONTAINER_PADDING: [number, number] = [0, 0];

// =============================================================================
// Behavior
// =============================================================================

/** Compaction type - always vertical for consistent stacking */
export const COMPACT_TYPE = 'vertical' as const;

/** Whether to prevent widget collision */
export const PREVENT_COLLISION = false;

// =============================================================================
// Default Fallbacks
// =============================================================================

/** Default widget width when metadata unavailable */
export const DEFAULT_WIDGET_WIDTH = 4;

/** Default widget height when metadata unavailable (doubled for new row height) */
export const DEFAULT_WIDGET_HEIGHT = 4;

/** Default minimum height (doubled for new row height) */
export const DEFAULT_MIN_HEIGHT = 2;

/** Default maximum height (doubled for new row height) */
export const DEFAULT_MAX_HEIGHT = 20;

// =============================================================================
// Type Exports
// =============================================================================

export type Breakpoint = typeof DESKTOP_BREAKPOINT | typeof MOBILE_BREAKPOINT;
export type GridBreakpoints = typeof GRID_BREAKPOINTS;
export type GridCols = typeof GRID_COLS;
