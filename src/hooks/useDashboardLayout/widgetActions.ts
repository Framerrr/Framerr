/**
 * Widget Actions Module
 * 
 * Handles widget manipulation actions:
 * - setEditMode
 * - updateWidgetConfig
 * - resizeWidget
 * - getSavePayload
 * - cancelEditing
 * - toggleMobileLayoutMode
 * - resetMobileLayout
 * - setViewBreakpoint
 * - commitChanges
 * - setInitialData
 * 
 * Add/Delete operations are in widgetCrud.ts for size management.
 * 
 * Uses FramerrWidget type with .layout and .mobileLayout throughout.
 */

import { useCallback, Dispatch, SetStateAction } from 'react';

import type {
    FramerrWidget,
    MobileLayoutMode,
    Breakpoint,
    LayoutState,
} from './types';

import { createLgLayoutItem, createSmLayoutItem, createLayoutsFromWidgets } from './layoutCreators';
import { applyBandDetection } from './mobileLayout';
import { useWidgetCrud, type WidgetCrudDeps } from './widgetCrud';
import { generateAllMobileLayouts } from './widgetConversion';
import type { HistoryStackName } from '../../shared/grid/core/types';
import { updateWidgetConfig as coreUpdateWidgetConfig, resizeWidget as coreResizeWidget } from '../../shared/grid/core/ops';

// ========== TYPES ==========

export interface WidgetActionDeps extends WidgetCrudDeps {
    // Additional state values
    editMode: boolean;
    cachedManualLayout: FramerrWidget[] | null;

    // Additional setters
    setWidgetsInternal: Dispatch<SetStateAction<FramerrWidget[]>>;
    setMobileWidgetsInternal: Dispatch<SetStateAction<FramerrWidget[]>>;
    setMobileLayoutMode: (mode: MobileLayoutMode) => void;
    setMobileLayoutModeInternal: Dispatch<SetStateAction<MobileLayoutMode>>;
    setEditModeInternal: Dispatch<SetStateAction<boolean>>;
    setOriginalLayout: Dispatch<SetStateAction<FramerrWidget[]>>;
    setMobileOriginalLayout: Dispatch<SetStateAction<FramerrWidget[]>>;
    setCurrentBreakpoint: (bp: Breakpoint) => void;
    setCachedManualLayout: Dispatch<SetStateAction<FramerrWidget[] | null>>;
}

export interface WidgetActionReturn {
    setEditMode: (mode: boolean) => void;
    addWidget: (widget: FramerrWidget) => void;
    deleteWidget: (widgetId: string) => void;
    updateWidgetConfig: (widgetId: string, config: Partial<FramerrWidget['config']>) => void;
    resizeWidget: (widgetId: string, layout: { x?: number; y?: number; w?: number; h?: number }) => void;
    getSavePayload: () => { widgets: FramerrWidget[]; mobileWidgets: FramerrWidget[]; mobileLayoutMode: MobileLayoutMode };
    cancelEditing: () => void;
    toggleMobileLayoutMode: () => void;
    resetMobileLayout: () => void;
    setViewBreakpoint: (bp: Breakpoint) => void;
    commitChanges: () => void;
    setInitialData: (data: {
        widgets: FramerrWidget[];
        mobileWidgets?: FramerrWidget[];
        mobileLayoutMode?: MobileLayoutMode;
        preserveCache?: boolean;
    }) => void;
}

// ========== HOOK ==========


export function useWidgetActions(deps: WidgetActionDeps): WidgetActionReturn {
    const {
        isMobile,
        editMode,
        widgets,
        mobileWidgets,
        mobileLayoutMode,
        pendingUnlink,
        originalLayout,
        mobileOriginalLayout,
        cachedManualLayout,
        isUndoRedoRef,
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
        pushToStack,
        clearStack,
    } = deps;

    // ========== COMPOSE WIDGET CRUD ==========

    const { addWidget, deleteWidget } = useWidgetCrud({
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
    });

    // ========== EDIT MODE ==========

    const setEditMode = useCallback((mode: boolean): void => {
        if (mode && !editMode) {
            // Entering edit mode - snapshot current state
            setOriginalLayout(JSON.parse(JSON.stringify(widgets)));
            if (mobileLayoutMode === 'independent') {
                setMobileOriginalLayout(JSON.parse(JSON.stringify(mobileWidgets)));
            }
        }
        setEditModeInternal(mode);

        if (!mode) {
            // Exiting edit mode - reset changes flag
            setHasUnsavedChanges(false);
            setPendingUnlink(false);
        }
    }, [editMode, widgets, mobileWidgets, mobileLayoutMode, setOriginalLayout, setMobileOriginalLayout, setEditModeInternal, setHasUnsavedChanges, setPendingUnlink]);

    // ========== UPDATE CONFIG ==========

    const updateWidgetConfig = useCallback((widgetId: string, config: Partial<FramerrWidget['config']>): void => {
        const updateFn = (ws: FramerrWidget[]) => coreUpdateWidgetConfig(ws, widgetId, config);

        if (isMobile && (mobileLayoutMode === 'independent' || pendingUnlink)) {
            setMobileWidgets(updateFn);
        } else {
            setWidgets(updateFn);
        }
        setHasUnsavedChanges(true);
    }, [isMobile, mobileLayoutMode, pendingUnlink, setWidgets, setMobileWidgets, setHasUnsavedChanges]);

    // ========== RESIZE WIDGET ==========

    /**
     * Programmatically resize/reposition a widget.
     * Used by the manual resize modal. Updates in-memory state only (dirty state).
     */
    const resizeWidget = useCallback((
        widgetId: string,
        layout: { x?: number; y?: number; w?: number; h?: number }
    ): void => {
        const breakpoint = isMobile ? 'sm' : 'lg';

        // Use Core's resizeWidget for the transformation
        const updateFn = (ws: FramerrWidget[]): FramerrWidget[] =>
            coreResizeWidget(ws, widgetId, layout, breakpoint);

        // Update the correct widget array based on current mode
        if (isMobile && (mobileLayoutMode === 'independent' || pendingUnlink)) {
            setMobileWidgets(prev => {
                const updated = updateFn(prev);
                // Also sync layouts state
                setLayouts(prevLayouts => ({
                    ...prevLayouts,
                    sm: updated.map(w => ({
                        id: w.id,
                        x: w.mobileLayout?.x ?? w.layout.x,
                        y: w.mobileLayout?.y ?? w.layout.y,
                        w: w.mobileLayout?.w ?? 4,
                        h: w.mobileLayout?.h ?? w.layout.h,
                    }))
                }));
                return updated;
            });
        } else {
            setWidgets(prev => {
                const updated = updateFn(prev);
                // Also sync layouts state
                setLayouts(prevLayouts => ({
                    ...prevLayouts,
                    lg: updated.map(w => ({
                        id: w.id,
                        x: w.layout.x,
                        y: w.layout.y,
                        w: w.layout.w,
                        h: w.layout.h,
                    }))
                }));
                return updated;
            });
        }

        setHasUnsavedChanges(true);
    }, [isMobile, mobileLayoutMode, pendingUnlink, setWidgets, setMobileWidgets, setLayouts, setHasUnsavedChanges]);

    // ========== SAVE/CANCEL ==========

    /**
     * Get payload for saving - returns FramerrWidget[] directly
     */
    const getSavePayload = useCallback(() => ({
        widgets: widgets,
        mobileWidgets: (pendingUnlink || mobileLayoutMode === 'independent')
            ? mobileWidgets
            : [],
        mobileLayoutMode: pendingUnlink ? 'independent' as MobileLayoutMode : mobileLayoutMode
    }), [widgets, mobileWidgets, mobileLayoutMode, pendingUnlink]);

    const cancelEditing = useCallback((): void => {
        setWidgets(originalLayout);
        if (mobileLayoutMode === 'independent') {
            setMobileWidgets(mobileOriginalLayout);
        }
        setLayouts(createLayoutsFromWidgets(originalLayout, mobileOriginalLayout.length > 0 ? mobileOriginalLayout : undefined));
        setPendingUnlink(false);
        setHasUnsavedChanges(false);
        setEditModeInternal(false);
    }, [originalLayout, mobileOriginalLayout, mobileLayoutMode, setWidgets, setMobileWidgets, setLayouts, setPendingUnlink, setHasUnsavedChanges, setEditModeInternal]);

    // ========== MOBILE LAYOUT MODE ==========

    const toggleMobileLayoutMode = useCallback((): void => {
        if (mobileLayoutMode === 'linked') {
            // Switch to MANUAL/independent mode
            // Restore from cache if available, otherwise create snapshot from desktop
            let manualLayout: FramerrWidget[];

            if (cachedManualLayout && cachedManualLayout.length > 0) {
                // Restore previously cached manual layout
                manualLayout = cachedManualLayout;
            } else if (mobileWidgets.length > 0) {
                // Use existing mobileWidgets if available
                manualLayout = mobileWidgets;
            } else {
                // Create new snapshot from desktop with band detection
                manualLayout = applyBandDetection(widgets);
            }

            setMobileWidgets(manualLayout);
            setLayouts(prev => ({
                ...prev,
                sm: manualLayout.map(w => createSmLayoutItem(w))
            }));
            setMobileLayoutMode('independent');
        } else {
            // Switch to AUTO/linked mode
            // Cache current manual layout before switching (so user can toggle back)
            if (mobileWidgets.length > 0) {
                setCachedManualLayout([...mobileWidgets]);
            }

            // Regenerate auto layout from desktop
            const autoLayout = generateAllMobileLayouts(widgets);
            setMobileWidgets(autoLayout);  // Update mobileWidgets so display updates
            setLayouts(prev => ({
                ...prev,
                sm: autoLayout.map(w => createSmLayoutItem(w))
            }));
            setMobileLayoutMode('linked');
        }
        setHasUnsavedChanges(true);
    }, [mobileLayoutMode, widgets, mobileWidgets, cachedManualLayout, setMobileWidgets, setMobileLayoutMode, setLayouts, setCachedManualLayout, setHasUnsavedChanges]);

    const resetMobileLayout = useCallback((): void => {
        const regenerated = generateAllMobileLayouts(widgets);
        setWidgets(regenerated);
        setMobileWidgets([]);
        setMobileLayoutMode('linked');
        setPendingUnlink(false);
        setLayouts({
            lg: regenerated.map(w => createLgLayoutItem(w)),
            sm: regenerated.map(w => createSmLayoutItem(w))
        });
        setHasUnsavedChanges(true);
    }, [widgets, setWidgets, setMobileWidgets, setMobileLayoutMode, setPendingUnlink, setLayouts, setHasUnsavedChanges]);

    const setViewBreakpoint = useCallback((bp: Breakpoint): void => {
        console.log('[setViewBreakpoint] Called:', {
            bp,
            mobileLayoutMode,
            mobileWidgetsCount: mobileWidgets.length,
            widgetsCount: widgets.length,
            widgetPositions: widgets.map(w => ({ id: w.id, x: w.layout.x, y: w.layout.y })),
        });
        setCurrentBreakpoint(bp);
        // Restore layouts for the new breakpoint from widget data
        // This ensures positions are fresh from source of truth, not stale GridStack state
        if (bp === 'sm' && mobileLayoutMode === 'independent' && mobileWidgets.length > 0) {
            // Switching to mobile: restore mobile layouts
            console.log('[setViewBreakpoint] Restoring mobile layouts');
            setLayouts(prev => ({
                ...prev,
                sm: mobileWidgets.map(w => createSmLayoutItem(w))
            }));
        } else if (bp === 'lg') {
            // Switching to desktop: restore desktop layouts
            // This ensures we pick up any changes made while on mobile view
            console.log('[setViewBreakpoint] Restoring desktop layouts:', widgets.map(w => ({ id: w.id, y: w.layout.y })));
            setLayouts(prev => ({
                ...prev,
                lg: widgets.map(w => createLgLayoutItem(w))
            }));
        }
    }, [mobileLayoutMode, mobileWidgets, widgets, setCurrentBreakpoint, setLayouts]);

    // ========== COMMIT & INITIALIZE ==========

    const commitChanges = useCallback((): void => {
        // Called after successful save - update originals and finalize mode transition
        setOriginalLayout(JSON.parse(JSON.stringify(widgets)));

        // If pendingUnlink was true, transition to independent mode
        if (pendingUnlink) {
            setMobileLayoutModeInternal('independent');
            // Also update mobileOriginalLayout since we're now independent
            setMobileOriginalLayout(JSON.parse(JSON.stringify(mobileWidgets)));
        } else if (mobileLayoutMode === 'independent') {
            setMobileOriginalLayout(JSON.parse(JSON.stringify(mobileWidgets)));
        }

        // Clear the cached manual layout - user has committed to their choice
        setCachedManualLayout(null);

        setPendingUnlink(false);
        setHasUnsavedChanges(false);
    }, [widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, setOriginalLayout, setMobileOriginalLayout, setMobileLayoutModeInternal, setCachedManualLayout, setPendingUnlink, setHasUnsavedChanges]);

    /**
     * Reinitialize hook state with fresh data (for async loading)
     * Call this after fetching widgets from API
     * Now accepts FramerrWidget[] directly
     */
    const setInitialData = useCallback((data: {
        widgets: FramerrWidget[];
        mobileWidgets?: FramerrWidget[];
        mobileLayoutMode?: MobileLayoutMode;
        preserveCache?: boolean; // If true, don't reset the cached manual layout
        editMode?: boolean; // If provided, set editMode to this value instead of false
    }): void => {
        const fetchedWidgets = data.widgets;
        const fetchedMobileWidgets = data.mobileWidgets || [];
        const fetchedMode = data.mobileLayoutMode || 'linked';

        setWidgetsInternal(fetchedWidgets);
        setMobileWidgetsInternal(fetchedMobileWidgets);
        setMobileLayoutModeInternal(fetchedMode);
        setOriginalLayout(JSON.parse(JSON.stringify(fetchedWidgets)));
        setMobileOriginalLayout(JSON.parse(JSON.stringify(fetchedMobileWidgets)));
        setLayouts(createLayoutsFromWidgets(
            fetchedWidgets,
            fetchedMobileWidgets.length > 0 ? fetchedMobileWidgets : undefined
        ));

        // Set cached layout for independent mode (if not preserving existing cache)
        if (!data.preserveCache) {
            if (fetchedMode === 'independent' && fetchedMobileWidgets.length > 0) {
                setCachedManualLayout(fetchedMobileWidgets);
            } else {
                setCachedManualLayout(null);
            }
        }

        setPendingUnlink(false);
        setHasUnsavedChanges(false);
        // Allow callers to preserve edit mode (e.g., template builder is always editing)
        setEditModeInternal(data.editMode ?? false);
    }, [setWidgetsInternal, setMobileWidgetsInternal, setMobileLayoutModeInternal, setOriginalLayout, setMobileOriginalLayout, setLayouts, setCachedManualLayout, setPendingUnlink, setHasUnsavedChanges, setEditModeInternal]);

    return {
        setEditMode,
        addWidget,
        deleteWidget,
        updateWidgetConfig,
        resizeWidget,
        getSavePayload,
        cancelEditing,
        toggleMobileLayoutMode,
        resetMobileLayout,
        setViewBreakpoint,
        commitChanges,
        setInitialData,
    };
}
