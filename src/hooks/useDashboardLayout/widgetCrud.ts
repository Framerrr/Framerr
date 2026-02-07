/**
 * Widget CRUD Operations Module
 * 
 * Handles widget add/delete operations with complex branching for:
 * - Linked vs independent mobile mode
 * - Desktop vs mobile viewport
 * - PendingUnlink state transitions
 * 
 * Uses FramerrWidget type with .layout and .mobileLayout.
 * Split from widgetActions.ts to keep files under 25KB.
 * 
 * REFACTORED: Uses pushToStack from undoRedo instead of raw stack setters.
 */

import { useCallback } from 'react';
import { getWidgetMetadata } from '../../widgets/registry';
import { GRID_COLS } from '../../constants/gridConfig';

import type {
    FramerrWidget,
    MobileLayoutMode,
    LayoutState,
} from './types';

import { createLgLayoutItem, createSmLayoutItem } from './layoutCreators';
import { checkForActualChanges } from './changeDetection';
import { widgetSetsMatch } from '../../shared/grid/core/ops';
import { createMobileSnapshot } from './mobileLayout';
import { generateAllMobileLayouts } from './widgetConversion';
import type { HistoryStackName } from '../../shared/grid/core/types';

// ========== TYPES ==========

export interface WidgetCrudDeps {
    // State values
    isMobile: boolean;
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    mobileLayoutMode: MobileLayoutMode;
    pendingUnlink: boolean;
    originalLayout: FramerrWidget[];
    mobileOriginalLayout: FramerrWidget[];

    // Refs
    isUndoRedoRef: React.MutableRefObject<boolean>;

    // Setters
    setWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setMobileWidgets: (widgets: FramerrWidget[] | ((prev: FramerrWidget[]) => FramerrWidget[])) => void;
    setPendingUnlink: (v: boolean) => void;
    setLayouts: (fn: LayoutState | ((prev: LayoutState) => LayoutState)) => void;
    setHasUnsavedChanges: (v: boolean) => void;

    // History functions (from undoRedo)
    pushToStack: (stack: HistoryStackName, widgets: FramerrWidget[]) => void;
    clearStack: (stack: HistoryStackName) => void;
}

export interface WidgetCrudReturn {
    addWidget: (widget: FramerrWidget) => void;
    deleteWidget: (widgetId: string) => void;
}

// ========== HOOK ==========

export function useWidgetCrud(deps: WidgetCrudDeps): WidgetCrudReturn {
    const {
        isMobile,
        widgets,
        mobileWidgets,
        mobileLayoutMode,
        pendingUnlink,
        originalLayout,
        mobileOriginalLayout,
        isUndoRedoRef,
        setWidgets,
        setMobileWidgets,
        setPendingUnlink,
        setLayouts,
        setHasUnsavedChanges,
        pushToStack,
        clearStack,
    } = deps;

    // ========== ADD WIDGET ==========

    const addWidget = useCallback((widget: FramerrWidget): void => {
        // Widget is already FramerrWidget, use directly
        const framerWidget = widget;

        // Push current state to undo stack before making changes
        // Note: Skip for first mobile edit in linked mode - handled when triggering pendingUnlink
        const willTriggerPendingUnlink = isMobile && mobileLayoutMode === 'linked' && !pendingUnlink;

        if (!isUndoRedoRef.current && !willTriggerPendingUnlink) {
            // Only push to mobile stack if already in independent mode
            if (mobileLayoutMode === 'independent' && isMobile) {
                pushToStack('mobile', mobileWidgets);
            } else if (!isMobile) {
                // Desktop edits - push to desktop stack
                pushToStack('desktop', widgets);
            }
        }

        const metadata = getWidgetMetadata(widget.type);
        const newHeight = metadata?.defaultSize?.h ?? 2;

        // INDEPENDENT MODE: Mobile and desktop are fully separate
        if (mobileLayoutMode === 'independent') {
            if (isMobile) {
                // Add to mobile ONLY (desktop unaffected)
                // Preserve existing mobileLayout if present (from external drop event),
                // otherwise default to top (y:0) for button-added widgets
                const newMobileWidget: FramerrWidget = {
                    ...framerWidget,
                    mobileLayout: framerWidget.mobileLayout ?? { x: 0, y: 0, w: GRID_COLS.sm, h: newHeight }
                };

                // Only shift existing widgets down if widget is being added at the top (y:0)
                // When dropped at a specific position (y > 0), GridStack handles collision
                const isDroppedAtPosition = (framerWidget.mobileLayout?.y ?? 0) > 0;
                const updatedMobileWidgets: FramerrWidget[] = isDroppedAtPosition
                    ? [...mobileWidgets, newMobileWidget]
                    : [
                        newMobileWidget,
                        ...mobileWidgets.map(w => ({
                            ...w,
                            mobileLayout: {
                                x: w.mobileLayout?.x ?? 0,
                                y: (w.mobileLayout?.y ?? 0) + newHeight,
                                w: w.mobileLayout?.w ?? GRID_COLS.sm,
                                h: w.mobileLayout?.h ?? 2
                            }
                        }))
                    ];

                setMobileWidgets(updatedMobileWidgets);
                setLayouts(prev => ({
                    ...prev,
                    sm: updatedMobileWidgets.map(w => createSmLayoutItem(w))
                }));
            } else {
                // Add to desktop ONLY (mobile unaffected)
                // Preserve existing layout if widget has one, otherwise use defaults at (0,0)
                const defaultW = metadata?.defaultSize?.w ?? 4;
                const newWidget: FramerrWidget = {
                    ...framerWidget,
                    layout: framerWidget.layout ?? { x: 0, y: 0, w: defaultW, h: newHeight }
                };

                // Shift existing desktop widgets down
                const shiftedWidgets: FramerrWidget[] = widgets.map(w => ({
                    ...w,
                    layout: {
                        x: w.layout.x,
                        y: w.layout.y + newHeight,
                        w: w.layout.w,
                        h: w.layout.h
                    }
                }));

                const updatedWidgets = [newWidget, ...shiftedWidgets];
                setWidgets(updatedWidgets);
                setLayouts(prev => ({
                    lg: updatedWidgets.map(w => createLgLayoutItem(w)),
                    sm: prev.sm  // Keep mobile layouts unchanged
                }));
            }
            setHasUnsavedChanges(true);
            return;
        }

        // LINKED MODE: Desktop changes sync to mobile
        if (isMobile) {
            // Mobile add in linked mode triggers pending unlink
            let workingMobileWidgets: FramerrWidget[];
            let shouldTriggerPendingUnlink = false;

            if (pendingUnlink) {
                workingMobileWidgets = [...mobileWidgets];
            } else {
                if (widgets.length > 0) {
                    workingMobileWidgets = createMobileSnapshot(widgets);
                    shouldTriggerPendingUnlink = true;
                } else {
                    workingMobileWidgets = [];
                }
            }

            // Preserve existing mobileLayout if present (from external drop event),
            // otherwise default to top (y:0) for button-added widgets
            const newMobileWidget: FramerrWidget = {
                ...framerWidget,
                layout: framerWidget.layout ?? { x: 0, y: 0, w: 24, h: newHeight },
                mobileLayout: framerWidget.mobileLayout ?? { x: 0, y: 0, w: GRID_COLS.sm, h: newHeight }
            };

            // Only shift existing widgets down if widget is being added at the top (y:0)
            // When dropped at a specific position (y > 0), GridStack handles collision
            const isDroppedAtPosition = (framerWidget.mobileLayout?.y ?? 0) > 0;
            const updatedMobileWidgets: FramerrWidget[] = isDroppedAtPosition
                ? [...workingMobileWidgets, newMobileWidget]
                : [
                    newMobileWidget,
                    ...workingMobileWidgets.map(w => ({
                        ...w,
                        mobileLayout: {
                            x: w.mobileLayout?.x ?? 0,
                            y: (w.mobileLayout?.y ?? 0) + newHeight,
                            w: w.mobileLayout?.w ?? GRID_COLS.sm,
                            h: w.mobileLayout?.h ?? 2
                        }
                    }))
                ];

            setMobileWidgets(updatedMobileWidgets);
            setLayouts(prev => ({
                ...prev,
                sm: updatedMobileWidgets.map(w => createSmLayoutItem(w))
            }));

            if (shouldTriggerPendingUnlink) {
                // IMPORTANT: Push the PRE-EDIT mobile state to undo stack before triggering pendingUnlink
                // This is the state BEFORE the widget was added (workingMobileWidgets was just created from desktop)
                pushToStack('mobile', workingMobileWidgets);
                setPendingUnlink(true);
            }

            // Also add to desktop if empty or not yet pending unlink
            if (widgets.length === 0 || (!shouldTriggerPendingUnlink && !pendingUnlink)) {
                const desktopWidget: FramerrWidget = {
                    ...framerWidget,
                    layout: framerWidget.layout ?? { x: 0, y: 0, w: 24, h: newHeight },
                    mobileLayout: framerWidget.mobileLayout ?? { x: 0, y: 0, w: GRID_COLS.sm, h: newHeight }
                };
                setWidgets([desktopWidget, ...widgets]);
                setLayouts(prev => ({
                    lg: [createLgLayoutItem(desktopWidget), ...prev.lg],
                    sm: prev.sm
                }));
            }
        } else {
            // Desktop add in linked mode - sync to mobile
            // Preserve existing layout if widget has one, otherwise use defaults at (0,0)
            const defaultW = metadata?.defaultSize?.w ?? 4;
            const newWidget: FramerrWidget = {
                ...framerWidget,
                layout: framerWidget.layout ?? { x: 0, y: 0, w: defaultW, h: newHeight }
            };

            // Shift existing widgets down
            // NOTE: Commented out - this was RGL legacy. GridStack handles collision automatically.
            // When adding a widget at y=0 (or any position), GridStack will push other widgets down.
            // This manual shift-down was interfering with GridStack's collision handling.
            // const shiftedWidgets: FramerrWidget[] = widgets.map(w => ({
            //     ...w,
            //     layout: {
            //         x: w.layout.x,
            //         y: w.layout.y + newHeight,
            //         w: w.layout.w,
            //         h: w.layout.h
            //     }
            // }));
            // const updatedWidgets = [newWidget, ...shiftedWidgets];

            // Just add the new widget - GridStack handles collision/pushing automatically
            const updatedWidgets = [newWidget, ...widgets];
            const withMobileLayouts = generateAllMobileLayouts(updatedWidgets);

            setWidgets(withMobileLayouts);
            setLayouts({
                lg: withMobileLayouts.map(w => createLgLayoutItem(w)),
                sm: withMobileLayouts.map(w => createSmLayoutItem(w))
            });
        }

        setHasUnsavedChanges(true);
    }, [isMobile, widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, setWidgets, setMobileWidgets,
        setLayouts, setHasUnsavedChanges, setPendingUnlink, isUndoRedoRef, pushToStack]);

    // ========== DELETE WIDGET ==========

    const deleteWidget = useCallback((widgetId: string): void => {
        // Push current state to undo stack before making changes
        // Note: Skip for first mobile edit in linked mode - handled when triggering pendingUnlink
        const willTriggerPendingUnlink = isMobile && mobileLayoutMode === 'linked' && !pendingUnlink;

        if (!isUndoRedoRef.current && !willTriggerPendingUnlink) {
            // Only push to mobile stack if already in independent/pendingUnlink mode
            if ((mobileLayoutMode === 'independent' || pendingUnlink) && isMobile) {
                pushToStack('mobile', mobileWidgets);
            } else if (!isMobile) {
                // Desktop edits - push to desktop stack
                pushToStack('desktop', widgets);
            }
        }

        // INDEPENDENT MODE: Mobile and desktop are fully separate
        if (mobileLayoutMode === 'independent') {
            if (isMobile) {
                // Delete from mobile ONLY (desktop unaffected)
                const updatedMobileWidgets = mobileWidgets.filter(w => w.id !== widgetId);
                setMobileWidgets(updatedMobileWidgets);
                setLayouts(prev => ({
                    ...prev,
                    sm: updatedMobileWidgets.map(w => createSmLayoutItem(w))
                }));
            } else {
                // Delete from desktop ONLY (mobile unaffected)
                const updatedWidgets = widgets.filter(w => w.id !== widgetId);
                setWidgets(updatedWidgets);
                setLayouts(prev => ({
                    lg: updatedWidgets.map(w => createLgLayoutItem(w)),
                    sm: prev.sm  // Keep mobile layouts unchanged
                }));
            }
            setHasUnsavedChanges(true);
            return;
        }

        // LINKED MODE
        if (isMobile) {
            // Mobile delete in linked mode triggers pending unlink
            let workingMobileWidgets: FramerrWidget[];
            let shouldTriggerPendingUnlink = false;

            if (pendingUnlink) {
                workingMobileWidgets = [...mobileWidgets];
            } else {
                workingMobileWidgets = createMobileSnapshot(widgets);
                shouldTriggerPendingUnlink = true;
            }

            const updatedMobileWidgets = workingMobileWidgets.filter(w => w.id !== widgetId);

            // Check for revert (net zero changes)
            if (widgetSetsMatch(updatedMobileWidgets, widgets) && pendingUnlink) {
                const restoredMobileWidgets = createMobileSnapshot(widgets);
                setMobileWidgets(restoredMobileWidgets);
                setLayouts(prev => ({
                    ...prev,
                    sm: restoredMobileWidgets.map(w => createSmLayoutItem(w))
                }));
                setPendingUnlink(false);
                setHasUnsavedChanges(false);
                return;
            }

            setMobileWidgets(updatedMobileWidgets);
            setLayouts(prev => ({
                ...prev,
                sm: updatedMobileWidgets.map(w => createSmLayoutItem(w))
            }));

            if (shouldTriggerPendingUnlink) {
                // IMPORTANT: Push the PRE-EDIT mobile state to undo stack before triggering pendingUnlink
                // This is the state BEFORE the widget was deleted (workingMobileWidgets was just created from desktop)
                pushToStack('mobile', workingMobileWidgets);
                setPendingUnlink(true);
            }

            const { hasChanges } = checkForActualChanges(
                updatedMobileWidgets, 'sm', originalLayout, mobileOriginalLayout,
                mobileLayoutMode, pendingUnlink, widgets
            );
            setHasUnsavedChanges(hasChanges);
            if (!hasChanges) {
                setPendingUnlink(false);
            }
            return;
        }

        // Desktop deletion in linked mode - sync to mobile
        const updatedWidgets = widgets.filter(w => w.id !== widgetId);
        const withMobileLayouts = generateAllMobileLayouts(updatedWidgets);

        setWidgets(withMobileLayouts);
        setLayouts({
            lg: withMobileLayouts.map(w => createLgLayoutItem(w)),
            sm: withMobileLayouts.map(w => createSmLayoutItem(w))
        });

        const { hasChanges } = checkForActualChanges(
            withMobileLayouts, 'lg', originalLayout, mobileOriginalLayout,
            mobileLayoutMode, pendingUnlink, widgets
        );
        setHasUnsavedChanges(hasChanges);
    }, [isMobile, widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, originalLayout, mobileOriginalLayout,
        setWidgets, setMobileWidgets, setLayouts, setHasUnsavedChanges, setPendingUnlink, isUndoRedoRef, pushToStack]);

    return {
        addWidget,
        deleteWidget,
    };
}
