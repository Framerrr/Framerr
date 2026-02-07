/**
 * useDashboardLayout - Shared Layout Engine Hook (Orchestrator)
 * 
 * This hook encapsulates ALL layout-related state and logic for both
 * Dashboard and Template Builder. It provides:
 * 
 * - Widget state management (desktop + mobile)
 * - Layout state management (lg + sm breakpoints)
 * - Mobile independence (linked/independent modes)
 * - Pending unlink (tentative state before save)
 * - Edit mode with change detection
 * - All grid callback handlers
 * 
 * ARCHITECTURE: 
 * - Internal state uses FramerrWidget (library-agnostic, .layout/.mobileLayout)
 * - External API now returns FramerrWidget directly
 * - RGL conversion happens at render time in consumers
 * 
 * This orchestrator composes specialized sub-hooks:
 * - useUndoRedo: History stacks and undo/redo operations
 * - useGridCallbacks: RGL event handlers
 * - useWidgetActions: Widget manipulation (add/delete/update)
 * 
 * Usage:
 * ```tsx
 * const { displayWidgets, gridProps, addWidget, deleteWidget } = useDashboardLayout({
 *   initialWidgets: widgetsFromAPI,
 *   isMobile: useLayout().isMobile,
 *   onWidgetsChange: (widgets) => saveToAPI(widgets),
 * });
 * 
 * return (
 *   <ResponsiveGridLayout {...gridProps}>
 *     {displayWidgets.map(widget => <Widget key={widget.id} {...widget} />)}
 *   </ResponsiveGridLayout>
 * );
 * ```
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { GRID_COLS, GRID_BREAKPOINTS, ROW_HEIGHT, GRID_MARGIN, COMPACT_TYPE } from '../../constants/gridConfig';

import type {
    FramerrWidget,
    MobileLayoutMode,
    Breakpoint,
    LayoutState,
    UseDashboardLayoutOptions,
    UseDashboardLayoutReturn,
    GridPropsBundle,
} from './types';

import { createLayoutsFromWidgets } from './layoutCreators';
import { getDisplayWidgets } from './mobileLayout';

// Import sub-hooks
import { useUndoRedo } from './undoRedo';
import { useGridCallbacks } from './gridCallbacks';
import { useWidgetActions } from './widgetActions';

/**
 * useDashboardLayout - The shared layout engine hook
 */
export const useDashboardLayout = (options: UseDashboardLayoutOptions): UseDashboardLayoutReturn => {
    const {
        initialWidgets,
        initialMobileWidgets = [],
        initialMobileLayoutMode = 'linked',
        isMobile,
        onWidgetsChange,
        onMobileWidgetsChange,
        onMobileLayoutModeChange,
        onLayoutChange,
    } = options;

    // ========== CORE STATE (Internal: FramerrWidget) ==========

    // Convert incoming FramerrWidget[] if needed (they may already be FramerrWidget)
    const initialFramerrWidgets = useMemo(() => initialWidgets, []);
    const initialFramerrMobileWidgets = useMemo(() => initialMobileWidgets, []);

    // Widget arrays (internal: FramerrWidget)
    const [widgets, setWidgetsInternal] = useState<FramerrWidget[]>(initialFramerrWidgets);
    const [mobileWidgets, setMobileWidgetsInternal] = useState<FramerrWidget[]>(initialFramerrMobileWidgets);

    // Mobile independence
    const [mobileLayoutMode, setMobileLayoutModeInternal] = useState<MobileLayoutMode>(initialMobileLayoutMode);
    const [pendingUnlink, setPendingUnlink] = useState<boolean>(false);

    // Layout state (NOT useMemo - persists across renders)
    const [layouts, setLayouts] = useState<LayoutState>(() =>
        createLayoutsFromWidgets(initialFramerrWidgets, initialFramerrMobileWidgets.length > 0 ? initialFramerrMobileWidgets : undefined)
    );

    // Edit mode
    const [editMode, setEditModeInternal] = useState<boolean>(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

    // Original layouts for change detection and cancel/revert
    const [originalLayout, setOriginalLayout] = useState<FramerrWidget[]>(initialFramerrWidgets);
    const [mobileOriginalLayout, setMobileOriginalLayout] = useState<FramerrWidget[]>(initialFramerrMobileWidgets);

    // Breakpoint tracking
    const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(isMobile ? 'sm' : 'lg');
    const [isUserDragging, setIsUserDragging] = useState<boolean>(false);

    // Sync currentBreakpoint with isMobile changes
    // This ensures the grid uses the correct breakpoint when viewport changes
    useEffect(() => {
        const expectedBreakpoint = isMobile ? 'sm' : 'lg';
        if (currentBreakpoint !== expectedBreakpoint) {
            setCurrentBreakpoint(expectedBreakpoint);
        }
    }, [isMobile, currentBreakpoint]);

    // Cached manual layout - preserved when switching to auto, restored when switching back to manual
    // This is cleared only on save
    const [cachedManualLayout, setCachedManualLayout] = useState<FramerrWidget[] | null>(
        // If we have mobile widgets from parent, they represent the cached manual layout
        // This persists across step navigation even when mode is 'linked'
        initialFramerrMobileWidgets.length > 0 ? initialFramerrMobileWidgets : null
    );

    // ========== SYNC WITH PARENT (Convert to Widget for external callbacks) ==========

    // Wrap setters to sync with parent callbacks
    const setWidgets = useCallback((widgetsOrUpdater: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => {
        setWidgetsInternal(prev => {
            const newWidgets = typeof widgetsOrUpdater === 'function' ? widgetsOrUpdater(prev) : widgetsOrUpdater;
            // Pass FramerrWidget directly to external callback
            onWidgetsChange?.(newWidgets);
            onLayoutChange?.();
            return newWidgets;
        });
    }, [onWidgetsChange, onLayoutChange]);

    const setMobileWidgets = useCallback((widgetsOrUpdater: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => {
        setMobileWidgetsInternal(prev => {
            const newWidgets = typeof widgetsOrUpdater === 'function' ? widgetsOrUpdater(prev) : widgetsOrUpdater;
            // Pass FramerrWidget directly to external callback
            onMobileWidgetsChange?.(newWidgets);
            onLayoutChange?.();
            return newWidgets;
        });
    }, [onMobileWidgetsChange, onLayoutChange]);

    const setMobileLayoutMode = useCallback((mode: MobileLayoutMode) => {
        setMobileLayoutModeInternal(mode);
        onMobileLayoutModeChange?.(mode);
        onLayoutChange?.();
    }, [onMobileLayoutModeChange, onLayoutChange]);

    // Unified setter for dnd-kit: updates the correct widget array based on current mode
    // This is needed because displayWidgets may come from widgets OR mobileWidgets
    // depending on mobileLayoutMode and isMobile state
    // IMPORTANT: Also syncs layouts to prevent ghost widgets when tentative changes
    const setDisplayWidgetsUnified = useCallback((newWidgets: FramerrWidget[]) => {
        const usesMobileWidgets = (mobileLayoutMode === 'independent' || pendingUnlink) && isMobile;
        if (usesMobileWidgets) {
            setMobileWidgetsInternal(newWidgets);
            // Sync mobile layouts
            setLayouts(prev => ({
                ...prev,
                sm: newWidgets.map(w => ({
                    id: w.id,
                    x: w.mobileLayout?.x ?? w.layout.x,
                    y: w.mobileLayout?.y ?? w.layout.y,
                    w: w.mobileLayout?.w ?? w.layout.w,
                    h: w.mobileLayout?.h ?? w.layout.h,
                }))
            }));
        } else {
            setWidgetsInternal(newWidgets);
            // Sync BOTH desktop and mobile layouts (for linked mode where mobile mirrors desktop)
            // Mobile grid uses sm layouts even in linked mode
            setLayouts(() => ({
                lg: newWidgets.map(w => ({
                    id: w.id,
                    x: w.layout.x,
                    y: w.layout.y,
                    w: w.layout.w,
                    h: w.layout.h,
                })),
                sm: newWidgets.map(w => ({
                    id: w.id,
                    x: w.mobileLayout?.x ?? 0,
                    y: w.mobileLayout?.y ?? w.layout.y,
                    w: w.mobileLayout?.w ?? w.layout.w,
                    h: w.mobileLayout?.h ?? w.layout.h,
                }))
            }));
        }
    }, [mobileLayoutMode, pendingUnlink, isMobile, setLayouts]);

    // ========== UNDO/REDO HOOK ==========

    const undoRedo = useUndoRedo({
        isMobile,
        mobileLayoutMode,
        pendingUnlink,
        widgets,
        mobileWidgets,
        originalLayout,
        mobileOriginalLayout,
        layouts,
        setWidgets,
        setMobileWidgets,
        setLayouts,
        setPendingUnlink,
        setHasUnsavedChanges,
    });

    // ========== GRID CALLBACKS HOOK ==========

    const gridCallbacks = useGridCallbacks({
        editMode,
        isMobile,
        mobileLayoutMode,
        pendingUnlink,
        widgets,
        mobileWidgets,
        originalLayout,
        mobileOriginalLayout,
        isUndoRedoRef: undoRedo.isUndoRedoRef,
        dragStartStateRef: undoRedo.dragStartStateRef,
        mobileDragStartStateRef: undoRedo.mobileDragStartStateRef,
        setIsUserDragging,
        setLayouts,
        setWidgets,
        setMobileWidgets,
        setPendingUnlink,
        setHasUnsavedChanges,
        setCurrentBreakpoint,
        pushToStack: undoRedo.pushToStack,
        clearStack: undoRedo.clearStack,
    });

    // ========== WIDGET ACTIONS HOOK ==========

    const widgetActions = useWidgetActions({
        isMobile,
        editMode,
        widgets,
        mobileWidgets,
        mobileLayoutMode,
        pendingUnlink,
        originalLayout,
        mobileOriginalLayout,
        cachedManualLayout,
        isUndoRedoRef: undoRedo.isUndoRedoRef,
        setWidgets,
        setMobileWidgets,
        setWidgetsInternal,
        setMobileWidgetsInternal,
        setMobileLayoutMode,
        setMobileLayoutModeInternal,
        setPendingUnlink,
        setLayouts,
        setEditModeInternal,
        setHasUnsavedChanges,
        setOriginalLayout,
        setMobileOriginalLayout,
        setCurrentBreakpoint,
        setCachedManualLayout,
        pushToStack: undoRedo.pushToStack,
        clearStack: undoRedo.clearStack,
    });

    // ========== COMPUTED VALUES ==========

    const effectiveBreakpoint = useMemo((): Breakpoint =>
        isMobile ? 'sm' : currentBreakpoint,
        [isMobile, currentBreakpoint]);

    const gridCols = useMemo((): { [key: string]: number } =>
        isMobile ? { sm: GRID_COLS.sm } : { lg: GRID_COLS.lg, sm: GRID_COLS.sm },
        [isMobile]);

    const gridBreakpoints = useMemo((): { [key: string]: number } =>
        isMobile ? { sm: GRID_BREAKPOINTS.sm } : { lg: GRID_BREAKPOINTS.lg, sm: GRID_BREAKPOINTS.sm },
        [isMobile]);

    // displayWidgets returns FramerrWidget[] directly for external API
    const displayWidgets = useMemo((): FramerrWidget[] =>
        getDisplayWidgets(
            widgets,
            mobileWidgets,
            layouts,
            mobileLayoutMode,
            pendingUnlink,
            editMode,
            isMobile,
            currentBreakpoint
        ),
        [widgets, mobileWidgets, layouts, mobileLayoutMode, pendingUnlink, editMode, isMobile, currentBreakpoint]);

    // ========== GRID PROPS BUNDLE ==========

    const gridProps: GridPropsBundle = useMemo(() => ({
        layouts,
        cols: gridCols,
        breakpoints: gridBreakpoints,
        rowHeight: ROW_HEIGHT,
        margin: GRID_MARGIN,
        containerPadding: [0, 0] as [number, number],
        compactType: COMPACT_TYPE,
        onLayoutChange: gridCallbacks.handleLayoutChange,
        onDragStart: gridCallbacks.handleDragStart,
        onDragStop: gridCallbacks.handleDragResizeStop,
        onResizeStart: gridCallbacks.handleResizeStart,
        onResizeStop: gridCallbacks.handleDragResizeStop,
        onBreakpointChange: gridCallbacks.handleBreakpointChange,
        // Abstracted callback for wrapper consumption (Phase 4b+)
        onLayoutCommit: gridCallbacks.handleLayoutCommitFromGrid,
    }), [layouts, gridCols, gridBreakpoints, gridCallbacks]);

    // ========== RETURN (External API: FramerrWidget) ==========

    // Return FramerrWidget directly - no more conversion
    return {
        // State (FramerrWidget directly)
        widgets,
        mobileWidgets,
        layouts,
        mobileLayoutMode,
        pendingUnlink,
        editMode,
        hasUnsavedChanges,
        currentBreakpoint,
        isUserDragging,

        // Computed
        displayWidgets,
        effectiveBreakpoint,
        gridCols,
        gridBreakpoints,
        gridProps,

        // Actions (from widgetActions)
        setEditMode: widgetActions.setEditMode,
        addWidget: widgetActions.addWidget,
        deleteWidget: widgetActions.deleteWidget,
        getSavePayload: widgetActions.getSavePayload,
        cancelEditing: widgetActions.cancelEditing,
        toggleMobileLayoutMode: widgetActions.toggleMobileLayoutMode,
        resetMobileLayout: widgetActions.resetMobileLayout,
        setViewBreakpoint: widgetActions.setViewBreakpoint,
        updateWidgetConfig: widgetActions.updateWidgetConfig,
        resizeWidget: widgetActions.resizeWidget,
        commitChanges: widgetActions.commitChanges,
        setInitialData: widgetActions.setInitialData,

        // Direct widget setter (for dnd-kit tentative injection)
        setWidgets,
        // Unified setter for dnd-kit (auto-selects widgets vs mobileWidgets based on mode)
        setDisplayWidgetsUnified,

        // Undo/Redo (from undoRedo)
        canUndo: undoRedo.canUndo,
        canRedo: undoRedo.canRedo,
        undo: undoRedo.undo,
        redo: undoRedo.redo,
        clearHistory: undoRedo.clearHistory,
    };
};
