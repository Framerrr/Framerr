/**
 * Grid Callbacks Module
 * 
 * Handles all react-grid-layout event callbacks:
 * - handleLayoutChange (no-op, change detection in stop handlers)
 * - handleDragStart / handleResizeStart 
 * - handleDragResizeStop (main handler for position/size changes)
 * - handleBreakpointChange
 * 
 * Uses FramerrWidget type with .layout (desktop) and .mobileLayout (mobile).
 * RGL-specific logic is isolated here for future abstraction.
 */

import { useCallback, MutableRefObject } from 'react';
import { getWidgetConfigConstraints } from '../../widgets/registry';
import { generateAllMobileLayouts } from './widgetConversion';

import type {
    FramerrWidget,
    MobileLayoutMode,
    Breakpoint,
    LayoutState,
    LayoutItem,
    LayoutCommitEvent,
} from './types';

import { createLgLayoutItem, createSmLayoutItem } from './layoutCreators';
import { checkForActualChanges } from './changeDetection';
import { createMobileSnapshot } from './mobileLayout';
import type { HistoryStackName } from '../../shared/grid/core/types';

// ========== TYPES ==========

export interface GridCallbackDeps {
    // State values
    editMode: boolean;
    isMobile: boolean;
    mobileLayoutMode: MobileLayoutMode;
    pendingUnlink: boolean;
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    originalLayout: FramerrWidget[];
    mobileOriginalLayout: FramerrWidget[];

    // Refs
    isUndoRedoRef: MutableRefObject<boolean>;
    dragStartStateRef: MutableRefObject<FramerrWidget[] | null>;
    mobileDragStartStateRef: MutableRefObject<FramerrWidget[] | null>;

    // Setters
    setIsUserDragging: (v: boolean) => void;
    setLayouts: (fn: (prev: LayoutState) => LayoutState) => void;
    setWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setMobileWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setPendingUnlink: (v: boolean) => void;
    setHasUnsavedChanges: (v: boolean) => void;
    setCurrentBreakpoint: (bp: Breakpoint) => void;

    // History functions (from undoRedo)
    pushToStack: (stack: HistoryStackName, widgets: FramerrWidget[]) => void;
    clearStack: (stack: HistoryStackName) => void;
}

export interface GridCallbackReturn {
    handleLayoutChange: (currentLayout: LayoutItem[], allLayouts: LayoutState) => void;
    handleDragStart: () => void;
    handleResizeStart: () => void;
    handleDragResizeStop: (
        layout: LayoutItem[],
        oldItem: LayoutItem,
        newItem: LayoutItem,
        placeholder: LayoutItem,
        e: MouseEvent,
        element: HTMLElement
    ) => void;
    handleBreakpointChange: (newBreakpoint: string) => void;
    /** Abstracted callback for wrapper consumption (Phase 4b+) */
    handleLayoutCommitFromGrid: (event: LayoutCommitEvent) => void;
}

// ========== HOOK ==========

export function useGridCallbacks(deps: GridCallbackDeps): GridCallbackReturn {
    const {
        editMode,
        isMobile,
        mobileLayoutMode,
        pendingUnlink,
        widgets,
        mobileWidgets,
        originalLayout,
        mobileOriginalLayout,
        isUndoRedoRef,
        dragStartStateRef,
        mobileDragStartStateRef,
        setIsUserDragging,
        setLayouts,
        setWidgets,
        setMobileWidgets,
        setPendingUnlink,
        setHasUnsavedChanges,
        setCurrentBreakpoint,
        pushToStack,
        clearStack,
    } = deps;

    // No-op: change detection happens in handleDragResizeStop
    const handleLayoutChange = useCallback((currentLayout: LayoutItem[], allLayouts: LayoutState): void => {
        // Intentionally empty - smart change detection happens after drag/resize completes
    }, []);

    const handleDragStart = useCallback((): void => {
        setIsUserDragging(true);

        // Capture state for undo before drag starts
        if (!isUndoRedoRef.current && editMode) {
            const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);
            if (isUsingMobileStack) {
                mobileDragStartStateRef.current = JSON.parse(JSON.stringify(mobileWidgets));
            } else {
                dragStartStateRef.current = JSON.parse(JSON.stringify(widgets));
            }
        }
    }, [editMode, isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets, setIsUserDragging, isUndoRedoRef, dragStartStateRef, mobileDragStartStateRef]);

    const handleResizeStart = useCallback((): void => {
        setIsUserDragging(true);

        // Capture state for undo before resize starts
        if (!isUndoRedoRef.current && editMode) {
            const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);
            if (isUsingMobileStack) {
                mobileDragStartStateRef.current = JSON.parse(JSON.stringify(mobileWidgets));
            } else {
                dragStartStateRef.current = JSON.parse(JSON.stringify(widgets));
            }
        }
    }, [editMode, isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets, setIsUserDragging, isUndoRedoRef, dragStartStateRef, mobileDragStartStateRef]);

    // The main handler - processes all drag/resize completions
    const handleDragResizeStop = useCallback((
        layout: LayoutItem[],
        oldItem: LayoutItem,
        newItem: LayoutItem,
        placeholder: LayoutItem,
        e: MouseEvent,
        element: HTMLElement
    ): void => {
        if (!editMode) return;

        // Check if there was an actual change in position/size
        const hasActualChange = oldItem.x !== newItem.x ||
            oldItem.y !== newItem.y ||
            oldItem.w !== newItem.w ||
            oldItem.h !== newItem.h;

        // Push captured state to undo stack if there was an actual change
        // Note: Skip the generic push for first mobile edit in linked mode - that case is handled
        // when we trigger pendingUnlink (to use the mobile stack instead)
        const willTriggerPendingUnlink = isMobile && mobileLayoutMode === 'linked' && !pendingUnlink;

        if (hasActualChange && !isUndoRedoRef.current && !willTriggerPendingUnlink) {
            const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);
            if (isUsingMobileStack && mobileDragStartStateRef.current) {
                pushToStack('mobile', mobileDragStartStateRef.current);
            } else if (dragStartStateRef.current) {
                pushToStack('desktop', dragStartStateRef.current);
            }
        }

        // Clear the drag start state refs
        dragStartStateRef.current = null;
        mobileDragStartStateRef.current = null;

        const activeBreakpoint = isMobile ? 'sm' : 'lg';

        // Mobile editing path
        if (activeBreakpoint === 'sm') {
            // Update layouts state with final positions
            setLayouts(prev => ({
                ...prev,
                sm: layout.map(item => ({
                    id: item.id,
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h
                }))
            }));

            // Determine which widget array to update based on mode
            // When pendingUnlink is true, we're in "virtual independent" mode
            const isVirtuallyIndependent = mobileLayoutMode === 'independent' || pendingUnlink;
            const widgetsToUpdate = isVirtuallyIndependent ? mobileWidgets : widgets;

            const updatedWidgets = widgetsToUpdate.map(widget => {
                const layoutItem = layout.find(l => l.id === widget.id);
                if (layoutItem) {
                    // Check for hard mode header-height sync (only hard mode syncs config on resize)
                    const constraints = getWidgetConfigConstraints(widget.type);
                    const oldH = widget.mobileLayout?.h ?? widget.layout.h;
                    const newH = layoutItem.h;
                    let configUpdate = {};
                    if (constraints.headerHeightMode === 'hard' && oldH !== newH) {
                        const threshold = constraints.minHeightForHeader ?? 2;
                        configUpdate = { showHeader: newH >= threshold };
                    }

                    return {
                        ...widget,
                        mobileLayout: {
                            x: layoutItem.x,
                            y: layoutItem.y,
                            w: layoutItem.w,
                            h: layoutItem.h
                        },
                        config: {
                            ...widget.config,
                            ...configUpdate
                        }
                    };
                }
                return widget;
            });

            if (mobileLayoutMode === 'independent') {
                // Already independent - just update mobileWidgets
                setMobileWidgets(updatedWidgets);
                const { hasChanges } = checkForActualChanges(
                    updatedWidgets, 'sm', originalLayout, mobileOriginalLayout,
                    mobileLayoutMode, pendingUnlink, widgets
                );
                setHasUnsavedChanges(hasChanges);
            } else if (pendingUnlink) {
                // Already triggered pendingUnlink - update mobileWidgets
                setMobileWidgets(updatedWidgets);
                const { hasChanges } = checkForActualChanges(
                    updatedWidgets, 'sm', originalLayout, mobileOriginalLayout,
                    mobileLayoutMode, pendingUnlink, widgets
                );
                setHasUnsavedChanges(hasChanges);
            } else {
                // Still linked - check if this edit triggers unlink
                const { hasChanges, shouldUnlink } = checkForActualChanges(
                    updatedWidgets, 'sm', originalLayout, mobileOriginalLayout,
                    mobileLayoutMode, false, widgets
                );
                setHasUnsavedChanges(hasChanges);

                // First mobile edit while linked - create snapshot and trigger pendingUnlink
                if (hasChanges && shouldUnlink) {
                    // IMPORTANT: Push the PRE-EDIT mobile state (generated from desktop) to undo stack
                    // This allows the user to undo back to the original linked state
                    const preEditMobileSnapshot = createMobileSnapshot(widgets);
                    pushToStack('mobile', preEditMobileSnapshot);

                    // Now apply the edited state
                    setMobileWidgets(updatedWidgets);
                    setPendingUnlink(true);
                }

                // Also update widgets array for linked mode
                setWidgets(updatedWidgets);
            }

            setIsUserDragging(false);
            return;
        }

        // Desktop editing path (lg breakpoint)
        if (activeBreakpoint === 'lg') {
            const updatedWidgets = widgets.map(widget => {
                const layoutItem = layout.find(l => l.id === widget.id);
                if (layoutItem) {
                    // Check for hard mode header-height sync (only hard mode syncs config on resize)
                    const constraints = getWidgetConfigConstraints(widget.type);
                    const oldH = widget.layout.h;
                    const newH = layoutItem.h;
                    let configUpdate = {};
                    if (constraints.headerHeightMode === 'hard' && oldH !== newH) {
                        const threshold = constraints.minHeightForHeader ?? 2;
                        configUpdate = { showHeader: newH >= threshold };
                    }

                    return {
                        ...widget,
                        layout: {
                            x: layoutItem.x,
                            y: layoutItem.y,
                            w: layoutItem.w,
                            h: layoutItem.h
                        },
                        config: {
                            ...widget.config,
                            ...configUpdate
                        }
                    };
                }
                return widget;
            });

            // Regenerate mobile layouts from updated desktop (if linked)
            const withMobileLayouts = mobileLayoutMode === 'linked'
                ? generateAllMobileLayouts(updatedWidgets)
                : updatedWidgets;

            setWidgets(withMobileLayouts);

            setLayouts(prev => ({
                lg: layout.map(item => ({
                    id: item.id,
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h
                })),
                sm: withMobileLayouts.map(w => createSmLayoutItem(w))
            }));

            const { hasChanges } = checkForActualChanges(
                withMobileLayouts, 'lg', originalLayout, mobileOriginalLayout,
                mobileLayoutMode, pendingUnlink, widgets
            );
            setHasUnsavedChanges(hasChanges);
        }

        setIsUserDragging(false);
    }, [editMode, isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets, originalLayout, mobileOriginalLayout,
        setWidgets, setMobileWidgets, setLayouts, setIsUserDragging, setPendingUnlink, setHasUnsavedChanges,
        isUndoRedoRef, dragStartStateRef, mobileDragStartStateRef, pushToStack]);

    // Handle breakpoint change - restore independent layouts
    const handleBreakpointChange = useCallback((newBreakpoint: string): void => {
        setCurrentBreakpoint(newBreakpoint as Breakpoint);

        // When switching to mobile (sm) and in independent mode, use mobileWidgets layouts
        if (newBreakpoint === 'sm' && mobileLayoutMode === 'independent' && mobileWidgets.length > 0) {
            setLayouts(prev => ({
                ...prev,
                sm: mobileWidgets.map(w => createSmLayoutItem(w))
            }));
        }
    }, [mobileLayoutMode, mobileWidgets, setCurrentBreakpoint, setLayouts]);

    // Abstracted handler for wrapper consumption (Phase 4b)
    // Receives pre-computed widgets from Core - no RGL-to-widget conversion needed
    const handleLayoutCommitFromGrid = useCallback((event: LayoutCommitEvent): void => {
        if (!editMode) return;

        const { widgets: updatedWidgets } = event;

        // Determine which stack we're using
        const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);

        // Push to undo stack if not from undo/redo operation
        if (!isUndoRedoRef.current) {
            const willTriggerPendingUnlink = isMobile && mobileLayoutMode === 'linked' && !pendingUnlink;

            // For explicit undoState (external drops), ALWAYS push regardless of pendingUnlink
            // This ensures external drops always have correct undo state (without tentative)
            if (event.undoState) {
                // Explicit undo state provided (external drop with clean pre-add state)
                // For mobile that will trigger pendingUnlink, push to mobile stack
                const stack = (isMobile || isUsingMobileStack) ? 'mobile' : 'desktop';
                pushToStack(stack, event.undoState);
            } else if (!willTriggerPendingUnlink) {
                // Internal drags - use captured drag start state ONLY
                // No fallback to current widgets - prevents intermediate swap states from being pushed
                if (isUsingMobileStack && mobileDragStartStateRef.current) {
                    pushToStack('mobile', mobileDragStartStateRef.current);
                } else if (!isUsingMobileStack && dragStartStateRef.current) {
                    pushToStack('desktop', dragStartStateRef.current);
                }
            }
            // When willTriggerPendingUnlink for internal drags, skip - handled later in mobile linked path
        }

        // Clear drag start refs
        dragStartStateRef.current = null;
        mobileDragStartStateRef.current = null;

        const activeBreakpoint = isMobile ? 'sm' : 'lg';

        // Mobile editing path
        if (activeBreakpoint === 'sm') {
            // Update layouts state from widget positions
            setLayouts(prev => ({
                ...prev,
                sm: updatedWidgets.map(w => ({
                    id: w.id,
                    x: w.mobileLayout?.x ?? w.layout.x,
                    y: w.mobileLayout?.y ?? w.layout.y,
                    w: w.mobileLayout?.w ?? w.layout.w,
                    h: w.mobileLayout?.h ?? w.layout.h,
                }))
            }));

            if (mobileLayoutMode === 'independent' || pendingUnlink) {
                setMobileWidgets(updatedWidgets);
                const { hasChanges } = checkForActualChanges(
                    updatedWidgets, 'sm', originalLayout, mobileOriginalLayout,
                    mobileLayoutMode, pendingUnlink, widgets
                );
                setHasUnsavedChanges(hasChanges);
            } else {
                // Still linked - check if this edit triggers unlink
                const { hasChanges, shouldUnlink } = checkForActualChanges(
                    updatedWidgets, 'sm', originalLayout, mobileOriginalLayout,
                    mobileLayoutMode, false, widgets
                );

                setHasUnsavedChanges(hasChanges);

                if (hasChanges && shouldUnlink) {
                    // Push pre-edit mobile state to undo stack
                    // BUT only for internal drags - external drops already pushed undoState earlier
                    if (!event.undoState) {
                        const preEditMobileSnapshot = createMobileSnapshot(widgets);
                        pushToStack('mobile', preEditMobileSnapshot);
                    }

                    // ONLY update mobileWidgets - don't touch desktop widgets!
                    // This allows undo to properly restore the pre-edit state
                    setMobileWidgets(updatedWidgets);
                    setPendingUnlink(true);
                } else {
                    // No unlink triggered - update widgets for linked mode (sm changes sync to desktop)
                    setWidgets(updatedWidgets);
                }
            }

            setIsUserDragging(false);
            return;
        }

        // Desktop editing path (lg breakpoint)
        if (activeBreakpoint === 'lg') {
            // Regenerate mobile layouts if linked
            const withMobileLayouts = mobileLayoutMode === 'linked'
                ? generateAllMobileLayouts(updatedWidgets)
                : updatedWidgets;

            setWidgets(withMobileLayouts);

            // Update layouts state
            setLayouts(prev => ({
                lg: withMobileLayouts.map(w => ({
                    id: w.id,
                    x: w.layout.x,
                    y: w.layout.y,
                    w: w.layout.w,
                    h: w.layout.h,
                })),
                sm: withMobileLayouts.map(w => createSmLayoutItem(w))
            }));

            const { hasChanges } = checkForActualChanges(
                withMobileLayouts, 'lg', originalLayout, mobileOriginalLayout,
                mobileLayoutMode, pendingUnlink, widgets
            );
            setHasUnsavedChanges(hasChanges);
        }

        setIsUserDragging(false);
    }, [editMode, isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets, originalLayout, mobileOriginalLayout,
        setWidgets, setMobileWidgets, setLayouts, setIsUserDragging, setPendingUnlink, setHasUnsavedChanges,
        isUndoRedoRef, dragStartStateRef, mobileDragStartStateRef, pushToStack]);

    return {
        handleLayoutChange,
        handleDragStart,
        handleResizeStart,
        handleDragResizeStop,
        handleBreakpointChange,
        handleLayoutCommitFromGrid,
    };
}
