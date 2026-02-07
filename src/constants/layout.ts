/**
 * Layout Constants - Single source of truth for responsive layout values
 * 
 * All layout-related decisions should reference these constants
 * to ensure consistency between sidebar, grid, and padding behavior.
 */

export interface LayoutConstants {
    /** Viewport width below which = mobile mode (tab bar instead of sidebar) */
    MOBILE_THRESHOLD: number;
    /** Collapsed sidebar width in pixels (80px sidebar + 16px gap = 96px) */
    SIDEBAR_WIDTH: number;
    /** Expanded sidebar width in pixels (280px sidebar + 16px gap = 296px) */
    SIDEBAR_WIDTH_EXPANDED: number;
    /** Mobile tab bar bottom padding in pixels (full tab bar area) */
    TABBAR_HEIGHT: number;
    /** Page margin - matches sidebar/tabbar distance from screen edge (16px) */
    PAGE_MARGIN: number;
    /** Viewport width for wide desktop mode - settings sidebar auto-expands */
    WIDE_DESKTOP_THRESHOLD: number;
}

export const LAYOUT: LayoutConstants = {
    // Viewport width below which = mobile mode (tab bar instead of sidebar)
    MOBILE_THRESHOLD: 768,

    // Collapsed sidebar width in pixels (80px sidebar + 16px gap = 96px)
    SIDEBAR_WIDTH: 96,

    // Expanded sidebar width in pixels (280px sidebar + 16px gap = 296px)
    SIDEBAR_WIDTH_EXPANDED: 296,

    // Mobile tab bar bottom padding in pixels (full tab bar area)
    TABBAR_HEIGHT: 86,

    // Page margin - matches sidebar/tabbar distance from screen edge (16px)
    PAGE_MARGIN: 16,

    // Viewport width for wide desktop mode - settings sidebar auto-expands
    WIDE_DESKTOP_THRESHOLD: 800,
};
