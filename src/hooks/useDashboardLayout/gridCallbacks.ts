/**
 * Grid Callbacks Module
 * 
 * Handles grid event callbacks for the GridStack adapter:
 * - handleDragStart / handleResizeStart
 * - handleBreakpointChange
 * - handleLayoutCommitFromGrid (main handler for position/size changes)
 * 
 * Uses FramerrWidget type with .layout (desktop) and .mobileLayout (mobile).
 */

import { useCallback, MutableRefObject } from 'react';
import { getWidgetMetadata } from '../../widgets/registry';
import { deriveLinkedMobileLayout, snapshotToMobileLayout } from '../../shared/grid/core/ops';

import type {
    FramerrWidget,
    MobileLayoutMode,
    Breakpoint,
    LayoutState,
    LayoutItem,
    LayoutCommitEvent,
} from './types';

import { createSmLayoutItem } from './layoutCreators';
import { checkForActualChanges } from './changeDetection';
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
    handleDragStart: () => void;
    handleResizeStart: () => void;
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
                        const preEditMobileSnapshot = snapshotToMobileLayout(widgets, { getMinHeight: (type: string) => getWidgetMetadata(type)?.minSize?.h });
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
                ? deriveLinkedMobileLayout(updatedWidgets, { getMinHeight: (type: string) => getWidgetMetadata(type)?.minSize?.h })
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
        handleDragStart,
        handleResizeStart,
        handleBreakpointChange,
        handleLayoutCommitFromGrid,
    };
}
