/**
 * Undo/Redo Module
 * 
 * Manages all history-related state and operations:
 * - Desktop undo/redo stacks
 * - Mobile undo/redo stacks (for independent mode)
 * - Push, undo, redo, and clear operations
 * - canUndo/canRedo computed values
 * 
 * Uses FramerrWidget type with .layout and .mobileLayout.
 * 
 * The dual-stack architecture supports the linked/independent mobile mode:
 * - Desktop stack: Used when editing desktop OR when mobile is linked
 * - Mobile stack: Used when mobile is independent or pendingUnlink
 * 
 * REFACTORED: Now delegates stack mechanics to core/history.ts
 * while retaining dashboard-specific business logic.
 */

import { useCallback, useMemo, useRef, MutableRefObject } from 'react';
import { generateAllMobileLayouts } from './widgetConversion';

import type {
    FramerrWidget,
    MobileLayoutMode,
    LayoutState,
} from './types';

import { createLgLayoutItem, createSmLayoutItem } from './layoutCreators';
import { checkForActualChanges } from './changeDetection';
import { useLayoutHistory } from '../../shared/grid/core/history';
import type { HistoryStackName } from '../../shared/grid/core/types';

// ========== TYPES ==========

export interface UndoRedoRefs {
    isUndoRedoRef: MutableRefObject<boolean>;
    dragStartStateRef: MutableRefObject<FramerrWidget[] | null>;
    mobileDragStartStateRef: MutableRefObject<FramerrWidget[] | null>;
}

export interface UndoRedoDeps {
    // State values (read-only for undo/redo logic)
    isMobile: boolean;
    mobileLayoutMode: MobileLayoutMode;
    pendingUnlink: boolean;
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    originalLayout: FramerrWidget[];
    mobileOriginalLayout: FramerrWidget[];
    layouts: LayoutState;

    // Setters
    setWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setMobileWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setLayouts: (fn: LayoutState | ((prev: LayoutState) => LayoutState)) => void;
    setPendingUnlink: (v: boolean) => void;
    setHasUnsavedChanges: (v: boolean) => void;
}

export interface UndoRedoReturn {
    // Refs (exposed for grid callbacks)
    isUndoRedoRef: MutableRefObject<boolean>;
    dragStartStateRef: MutableRefObject<FramerrWidget[] | null>;
    mobileDragStartStateRef: MutableRefObject<FramerrWidget[] | null>;

    // Actions
    pushUndoState: (forMobile?: boolean) => void;
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;

    // Computed
    canUndo: boolean;
    canRedo: boolean;

    // Direct stack access for gridCallbacks (push to specific stack)
    pushToStack: (stack: HistoryStackName, widgets: FramerrWidget[]) => void;
    clearStack: (stack: HistoryStackName) => void;
}

// ========== HOOK ==========

export function useUndoRedo(deps: UndoRedoDeps): UndoRedoReturn {
    const {
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
    } = deps;

    // ========== CORE HISTORY ==========
    // Delegate stack mechanics to core's multi-stack history
    const history = useLayoutHistory();

    // ========== REFS ==========
    // Flag to prevent recursive history captures during undo/redo
    const isUndoRedoRef = useRef<boolean>(false);

    // Ref to capture state before drag/resize starts
    const dragStartStateRef = useRef<FramerrWidget[] | null>(null);
    const mobileDragStartStateRef = useRef<FramerrWidget[] | null>(null);

    // ========== HELPERS ==========

    /**
     * Determine which stack to use based on current state
     */
    const getActiveStack = useCallback((): HistoryStackName => {
        const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);
        return isUsingMobileStack ? 'mobile' : 'desktop';
    }, [isMobile, mobileLayoutMode, pendingUnlink]);

    // ========== ACTIONS ==========

    /**
     * Push current state to undo stack before making changes
     * Also clears the redo stack (new action breaks redo chain)
     */
    const pushUndoState = useCallback((forMobile: boolean = false): void => {
        if (isUndoRedoRef.current) return; // Don't capture during undo/redo operations

        if (forMobile || (isMobile && (mobileLayoutMode === 'independent' || pendingUnlink))) {
            // Push to mobile stack
            history.push('mobile', { widgets: mobileWidgets });
        } else {
            // Push to desktop stack
            history.push('desktop', { widgets });
        }
    }, [isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets, history]);

    /**
     * Direct push to a specific stack (for gridCallbacks)
     */
    const pushToStack = useCallback((stack: HistoryStackName, widgetsToSave: FramerrWidget[]): void => {
        if (isUndoRedoRef.current) return;
        history.push(stack, { widgets: widgetsToSave });
    }, [history]);

    /**
     * Clear a specific stack
     */
    const clearStack = useCallback((stack: HistoryStackName): void => {
        history.clear(stack);
    }, [history]);

    /**
     * Undo the last action
     */
    const undo = useCallback((): void => {
        const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);

        if (isUsingMobileStack) {
            if (!history.canUndo('mobile')) return;

            isUndoRedoRef.current = true;

            // Push current state to redo stack before applying undo
            history.pushToRedo('mobile', { widgets: mobileWidgets });

            // Pop from undo stack
            const previousSnapshot = history.undo('mobile');
            if (!previousSnapshot) {
                isUndoRedoRef.current = false;
                return;
            }
            const previousState = previousSnapshot.widgets;

            // Apply the previous state
            setMobileWidgets(previousState);
            setLayouts(prev => ({
                ...prev,
                sm: previousState.map(w => createSmLayoutItem(w))
            }));

            // Check if we've reverted all changes
            const { hasChanges } = checkForActualChanges(
                previousState, 'sm', originalLayout, mobileOriginalLayout,
                mobileLayoutMode, pendingUnlink, widgets
            );
            setHasUnsavedChanges(hasChanges);

            // If we've undone back to the initial state and we were in pendingUnlink,
            // clear pendingUnlink to restore linked mode - effectively undoing the "break" from desktop
            // NOTE: We check !hasChanges as a proxy for "reverted to original"
            // because checking history.canUndo() reads stale React state
            if (!hasChanges && pendingUnlink) {
                setPendingUnlink(false);
            }

            // Reset the flag after state updates
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        } else {
            if (!history.canUndo('desktop')) return;

            isUndoRedoRef.current = true;


            // Push current state to redo stack before applying undo
            history.pushToRedo('desktop', { widgets });

            // Pop from undo stack
            const previousSnapshot = history.undo('desktop');
            if (!previousSnapshot) {
                isUndoRedoRef.current = false;
                return;
            }
            const previousState = previousSnapshot.widgets;

            // Apply the previous state with mobile sync if linked
            const restoredWidgets = mobileLayoutMode === 'linked'
                ? generateAllMobileLayouts(previousState)
                : previousState;

            setWidgets(restoredWidgets);
            setLayouts({
                lg: restoredWidgets.map(w => createLgLayoutItem(w)),
                sm: mobileLayoutMode === 'linked'
                    ? restoredWidgets.map(w => createSmLayoutItem(w))
                    : layouts.sm
            });

            // Check if we've reverted all changes
            const { hasChanges } = checkForActualChanges(
                restoredWidgets, 'lg', originalLayout, mobileOriginalLayout,
                mobileLayoutMode, pendingUnlink, widgets
            );
            setHasUnsavedChanges(hasChanges);

            // Reset the flag after state updates
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        }
    }, [isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets,
        originalLayout, mobileOriginalLayout, layouts, setWidgets, setMobileWidgets,
        setLayouts, setPendingUnlink, setHasUnsavedChanges, history]);

    /**
     * Redo the last undone action
     */
    const redo = useCallback((): void => {
        const isUsingMobileStack = isMobile && (mobileLayoutMode === 'independent' || pendingUnlink);

        if (isUsingMobileStack) {
            if (!history.canRedo('mobile')) return;

            isUndoRedoRef.current = true;

            // Push current state to undo stack before applying redo
            history.pushToUndo('mobile', { widgets: mobileWidgets });

            // Pop from redo stack
            const nextSnapshot = history.redo('mobile');
            if (!nextSnapshot) {
                isUndoRedoRef.current = false;
                return;
            }
            const nextState = nextSnapshot.widgets;

            // Apply the next state
            setMobileWidgets(nextState);
            setLayouts(prev => ({
                ...prev,
                sm: nextState.map(w => createSmLayoutItem(w))
            }));

            setHasUnsavedChanges(true);

            // Reset the flag after state updates
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        } else {
            if (!history.canRedo('desktop')) return;

            isUndoRedoRef.current = true;


            // Push current state to undo stack before applying redo
            history.pushToUndo('desktop', { widgets });

            // Pop from redo stack
            const nextSnapshot = history.redo('desktop');
            if (!nextSnapshot) {
                isUndoRedoRef.current = false;
                return;
            }
            const nextState = nextSnapshot.widgets;

            // Apply the next state with mobile sync if linked
            const restoredWidgets = mobileLayoutMode === 'linked'
                ? generateAllMobileLayouts(nextState)
                : nextState;

            setWidgets(restoredWidgets);
            setLayouts({
                lg: restoredWidgets.map(w => createLgLayoutItem(w)),
                sm: mobileLayoutMode === 'linked'
                    ? restoredWidgets.map(w => createSmLayoutItem(w))
                    : layouts.sm
            });

            setHasUnsavedChanges(true);

            // Reset the flag after state updates
            setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        }
    }, [isMobile, mobileLayoutMode, pendingUnlink, widgets, mobileWidgets,
        layouts, setWidgets, setMobileWidgets, setLayouts, setHasUnsavedChanges, history]);

    /**
     * Clear all undo/redo history (called on save or cancel)
     */
    const clearHistory = useCallback((): void => {
        history.clear(); // Clears both stacks
        dragStartStateRef.current = null;
        mobileDragStartStateRef.current = null;
    }, [history]);

    // ========== COMPUTED ==========

    // Computed values for canUndo/canRedo
    const canUndo = useMemo((): boolean => {
        // When on mobile in linked mode (no pendingUnlink), disable undo
        // Mobile layout is auto-generated from desktop, there's nothing mobile-specific to undo
        if (isMobile && mobileLayoutMode === 'linked' && !pendingUnlink) {
            return false;
        }
        const stack = getActiveStack();
        return history.canUndo(stack);
    }, [isMobile, mobileLayoutMode, pendingUnlink, getActiveStack, history]);

    const canRedo = useMemo((): boolean => {
        // When on mobile in linked mode (no pendingUnlink), disable redo
        if (isMobile && mobileLayoutMode === 'linked' && !pendingUnlink) {
            return false;
        }
        const stack = getActiveStack();
        return history.canRedo(stack);
    }, [isMobile, mobileLayoutMode, pendingUnlink, getActiveStack, history]);

    return {
        // Refs
        isUndoRedoRef,
        dragStartStateRef,
        mobileDragStartStateRef,

        // Actions
        pushUndoState,
        undo,
        redo,
        clearHistory,

        // Computed
        canUndo,
        canRedo,

        // Direct stack access for gridCallbacks
        pushToStack,
        clearStack,
    };
}
