/**
 * Mobile Layout Functions
 * 
 * Functions for generating mobile layouts and ordering widgets for display.
 * Includes band detection algorithm for auto-generating mobile layout order.
 * 
 * Uses FramerrWidget type with .layout (desktop) and .mobileLayout (mobile).
 */

import type { FramerrWidget, LayoutItem, LayoutState, MobileLayoutMode } from './types';

/**
 * Get the appropriate widget array to use for rendering
 * 
 * Uses mobileWidgets when:
 * - Already in independent mode on mobile
 * - OR pendingUnlink is true (staged mobile changes waiting to be saved)
 */
export const getWidgetsToUse = (
    widgets: FramerrWidget[],
    mobileWidgets: FramerrWidget[],
    mobileLayoutMode: MobileLayoutMode,
    pendingUnlink: boolean,
    isMobile: boolean
): FramerrWidget[] => {
    if ((mobileLayoutMode === 'independent' || pendingUnlink) && isMobile) {
        return mobileWidgets;
    }
    return widgets;
};

/**
 * Sort widgets by Y position for display
 * 
 * During edit mode: sorts by layouts.sm state to prevent snap-back
 * Outside edit mode: sorts by stored mobileLayout.y
 */
export const sortWidgetsByY = (
    widgets: FramerrWidget[],
    layouts: LayoutState,
    editMode: boolean,
    isMobile: boolean,
    currentBreakpoint: 'lg' | 'sm'
): FramerrWidget[] => {
    // During edit mode on mobile, use layouts.sm state for ordering
    // This prevents snap-back by keeping DOM order in sync with grid's internal state
    if (editMode && (isMobile || currentBreakpoint === 'sm')) {
        return [...widgets].sort((a, b) => {
            const aLayout = layouts.sm.find(l => l.id === a.id);
            const bLayout = layouts.sm.find(l => l.id === b.id);
            return (aLayout?.y ?? 0) - (bLayout?.y ?? 0);
        });
    }

    // Outside edit mode, sort by widget's mobileLayout.y (or layout.y if no mobile)
    return [...widgets].sort((a, b) =>
        (a.mobileLayout?.y ?? a.layout.y) - (b.mobileLayout?.y ?? b.layout.y)
    );
};

/**
 * Get display widgets - the main function for determining what to render
 * 
 * Combines widget selection with proper sorting.
 * For linked mode on mobile, merges auto-generated positions from layouts.sm
 * into the widgets so the grid adapter can use them.
 */
export const getDisplayWidgets = (
    widgets: FramerrWidget[],
    mobileWidgets: FramerrWidget[],
    layouts: LayoutState,
    mobileLayoutMode: MobileLayoutMode,
    pendingUnlink: boolean,
    editMode: boolean,
    isMobile: boolean,
    currentBreakpoint: 'lg' | 'sm'
): FramerrWidget[] => {
    let widgetsToUse = getWidgetsToUse(
        widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, isMobile
    );

    // For linked mode on mobile, widgets don't have mobileLayout property
    // but the auto-generated positions are in layouts.sm. Merge them so
    // the grid adapter can use them for positioning.
    if (mobileLayoutMode === 'linked' && (isMobile || currentBreakpoint === 'sm')) {
        widgetsToUse = widgetsToUse.map(widget => {
            const smLayout = layouts.sm.find(l => l.id === widget.id);
            if (smLayout && !widget.mobileLayout) {
                return {
                    ...widget,
                    mobileLayout: {
                        x: smLayout.x,
                        y: smLayout.y,
                        w: smLayout.w,
                        h: smLayout.h,
                    }
                };
            }
            return widget;
        });
    }

    return sortWidgetsByY(
        widgetsToUse, layouts, editMode, isMobile, currentBreakpoint
    );
};
