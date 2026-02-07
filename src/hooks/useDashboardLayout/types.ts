/**
 * useDashboardLayout - Shared Layout Engine Types
 * 
 * This file contains all TypeScript interfaces used by the layout hook.
 * These types are shared between Dashboard and Template Builder.
 * 
 * ARCHITECTURE NOTE:
 * - All Core types are imported from shared/grid/core/types
 * - FramerrWidget: Library-agnostic widget type (layout + mobileLayout)
 * - LayoutItem uses `id` (not RGL's `i`) — adapter converts at boundary
 * - RGL-specific conversion happens only in the adapter layer
 */

import type { WidgetLayout, FramerrWidget } from '../../../shared/types/widget';
import type {
    LayoutItem,
    Breakpoint as CoreBreakpoint,
    MobileLayoutMode as CoreMobileLayoutMode,
} from '../../shared/grid/core/types';

// Re-export types for consumers
export type { WidgetLayout, FramerrWidget };

// Re-export Core types with same names for compatibility
export type { LayoutItem };

/**
 * Mobile layout mode - determines whether mobile layout is synchronized with desktop
 * Re-exported from Core for backward compatibility.
 */
export type MobileLayoutMode = CoreMobileLayoutMode;

/**
 * Breakpoint identifiers for responsive grid.
 * Re-exported from Core for backward compatibility.
 */
export type Breakpoint = CoreBreakpoint;

/**
 * Abstracted layout commit event - emitted by Core/Wrapper
 * This is the library-agnostic callback format for layout changes.
 * ARCHITECTURE: docs/grid-rework/ARCHITECTURE.md Lines 320-335
 */
export interface LayoutCommitEvent {
    /** Updated widget state (pre-computed by Core) */
    widgets: FramerrWidget[];
    /** Reason for the layout change (matches Core's LayoutEvent.reason) */
    reason: 'drag' | 'resize' | 'programmatic' | 'add' | 'remove';
    /** ID of the widget that was affected */
    affectedId?: string;
    /** Explicit state to push to undo stack (used for external drops where closure state may be stale) */
    undoState?: FramerrWidget[];
}

/**
 * Layout state containing layouts for all breakpoints.
 * Uses Core's LayoutItem (with `id` field, not RGL's `i`).
 */
export interface LayoutState {
    lg: LayoutItem[];
    sm: LayoutItem[];
    [key: string]: LayoutItem[];
}

/**
 * Options for initializing the useDashboardLayout hook
 */
export interface UseDashboardLayoutOptions {
    /**
     * Initial widget array (desktop/main widgets)
     */
    initialWidgets: FramerrWidget[];

    /**
     * Initial mobile widgets (for independent mode)
     */
    initialMobileWidgets?: FramerrWidget[];

    /**
     * Initial mobile layout mode
     */
    initialMobileLayoutMode?: MobileLayoutMode;

    /**
     * Whether the viewport is currently mobile-sized
     * This is passed from parent (useLayout context or viewMode state)
     */
    isMobile: boolean;

    /**
     * Callback when widgets array changes (for syncing with parent state)
     */
    onWidgetsChange?: (widgets: FramerrWidget[]) => void;

    /**
     * Callback when mobileWidgets array changes
     */
    onMobileWidgetsChange?: (widgets: FramerrWidget[]) => void;

    /**
     * Callback when mobileLayoutMode changes
     */
    onMobileLayoutModeChange?: (mode: MobileLayoutMode) => void;

    /**
     * Callback when any layout-related data changes (for auto-save/draft)
     */
    onLayoutChange?: () => void;
}

/**
 * Grid props bundle - can be spread directly to ResponsiveGridLayout
 * Also includes abstracted onLayoutCommit for wrapper consumption.
 */
export interface GridPropsBundle {
    layouts: LayoutState;
    cols: { [key: string]: number };
    breakpoints: { [key: string]: number };
    rowHeight: number;
    margin: [number, number];
    containerPadding: [number, number];
    compactType: 'vertical';
    onLayoutChange: (currentLayout: LayoutItem[], allLayouts: LayoutState) => void;
    onDragStart: () => void;
    onDragStop: (layout: LayoutItem[], oldItem: LayoutItem, newItem: LayoutItem, placeholder: LayoutItem, e: MouseEvent, element: HTMLElement) => void;
    onResizeStart: () => void;
    onResizeStop: (layout: LayoutItem[], oldItem: LayoutItem, newItem: LayoutItem, placeholder: LayoutItem, e: MouseEvent, element: HTMLElement) => void;
    onBreakpointChange: (newBreakpoint: string) => void;
    /** Abstracted callback for wrapper consumption (Phase 4b+) */
    onLayoutCommit: (event: LayoutCommitEvent) => void;
}

/**
 * Return type for the useDashboardLayout hook
 */
export interface UseDashboardLayoutReturn {
    // ========== STATE ==========

    /** Desktop widgets array */
    widgets: FramerrWidget[];

    /** Mobile-specific widgets (for independent mode) */
    mobileWidgets: FramerrWidget[];

    /** Current layout positions for grid */
    layouts: LayoutState;

    /** Whether mobile layout is linked to desktop or independent */
    mobileLayoutMode: MobileLayoutMode;

    /** Whether there are pending mobile changes waiting for save */
    pendingUnlink: boolean;

    /** Whether edit mode is active */
    editMode: boolean;

    /** Whether there are unsaved changes */
    hasUnsavedChanges: boolean;

    /** Current active breakpoint */
    currentBreakpoint: Breakpoint;

    /** Whether user is actively dragging/resizing */
    isUserDragging: boolean;

    // ========== COMPUTED ==========

    /** 
     * Widgets to render, correctly sorted and filtered
     * Uses band detection for auto mode, stored positions for independent mode
     */
    displayWidgets: FramerrWidget[];

    /** Effective breakpoint considering isMobile override */
    effectiveBreakpoint: Breakpoint;

    /** Grid column counts for each breakpoint */
    gridCols: { [key: string]: number };

    /** Grid breakpoint thresholds */
    gridBreakpoints: { [key: string]: number };

    /** Bundle of props to spread to ResponsiveGridLayout */
    gridProps: GridPropsBundle;

    // ========== ACTIONS ==========

    /** Toggle edit mode on/off */
    setEditMode: (mode: boolean) => void;

    /** Add a new widget */
    addWidget: (widget: FramerrWidget) => void;

    /** Delete a widget by ID */
    deleteWidget: (widgetId: string) => void;

    /** 
     * Get current state for saving
     * Returns all data needed to persist to API/storage
     */
    getSavePayload: () => {
        widgets: FramerrWidget[];
        mobileWidgets: FramerrWidget[];
        mobileLayoutMode: MobileLayoutMode;
    };

    /** Cancel edit mode and revert changes */
    cancelEditing: () => void;

    /** Toggle between linked and independent mobile mode */
    toggleMobileLayoutMode: () => void;

    /** Reset mobile layout back to linked (synced from desktop) */
    resetMobileLayout: () => void;

    /** 
     * Manually set breakpoint (for Template Builder view switching)
     * Dashboard uses actual viewport breakpoints instead
     */
    setViewBreakpoint: (bp: Breakpoint) => void;

    /** Update widget config (flatten, showHeader, etc.) */
    updateWidgetConfig: (widgetId: string, config: Partial<FramerrWidget['config']>) => void;

    /** Programmatically resize/reposition a widget (for manual resize modal) */
    resizeWidget: (widgetId: string, layout: { x?: number; y?: number; w?: number; h?: number }) => void;

    // ========== INTERNAL (for grid callbacks) ==========

    /** Called when edit mode saves successfully */
    commitChanges: () => void;

    /** 
     * Direct widget setter for dnd-kit tentative widget injection.
     * Use this for external drag-to-grid operations.
     */
    setWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;

    /**
     * Unified widget setter for dnd-kit that auto-selects correct array.
     * Uses widgets on desktop, mobileWidgets on mobile (in independent mode).
     * This is the preferred setter for external drag operations.
     */
    setDisplayWidgetsUnified: (widgets: FramerrWidget[]) => void;

    // ========== UNDO/REDO ==========

    /** Whether there are actions to undo */
    canUndo: boolean;

    /** Whether there are actions to redo */
    canRedo: boolean;

    /** Undo the last action */
    undo: () => void;

    /** Redo the last undone action */
    redo: () => void;

    /** Clear undo/redo history (called on save/cancel) */
    clearHistory: () => void;

    /**
     * Reinitialize hook with fresh data (for async loading)
     * Call this after fetching widgets from API
     */
    setInitialData: (data: {
        widgets: FramerrWidget[];
        mobileWidgets?: FramerrWidget[];
        mobileLayoutMode?: MobileLayoutMode;
        preserveCache?: boolean; // If true, don't reset the cached manual layout
    }) => void;
}

/**
 * Result of change detection check
 */
export interface ChangeDetectionResult {
    /** Whether any changes exist compared to original */
    hasChanges: boolean;
    /** Whether the changes warrant unlinking mobile layout */
    shouldUnlink: boolean;
}

/**
 * Widget info used for band detection algorithm
 */
export interface WidgetBandInfo {
    index: number;
    id: string;
    x: number;
    y: number;
    h: number;
    yStart: number;
    yEnd: number;
    widget: FramerrWidget;
}

