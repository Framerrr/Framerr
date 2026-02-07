/**
 * Mobile Layout Functions
 * 
 * Functions for generating mobile layouts and ordering widgets for display.
 * Includes band detection algorithm for auto-generating mobile layout order.
 * 
 * Uses FramerrWidget type with .layout (desktop) and .mobileLayout (mobile).
 */

import { getWidgetMetadata } from '../../widgets/registry';
import { GRID_COLS } from '../../constants/gridConfig';
import type { FramerrWidget, LayoutItem, LayoutState, MobileLayoutMode, WidgetBandInfo } from './types';

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

/**
 * Band detection algorithm for auto-generating mobile layout order
 * 
 * Groups widgets that vertically overlap into "bands", then within each band
 * sorts by X position (left to right). This preserves intended reading order
 * when converting a multi-column desktop layout to single-column mobile.
 */
export const applyBandDetection = (widgets: FramerrWidget[]): FramerrWidget[] => {
    if (widgets.length === 0) return [];

    // Extract desktop layout info with Y range
    const widgetInfos: WidgetBandInfo[] = widgets.map((w, index) => ({
        index,
        id: w.id,
        x: w.layout.x,
        y: w.layout.y,
        h: w.layout.h,
        yStart: w.layout.y,
        yEnd: w.layout.y + w.layout.h,
        widget: w
    }));

    // Sort by Y, then X, then ID for deterministic ordering
    const ySorted = [...widgetInfos].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return (a.id || '').localeCompare(b.id || '');
    });

    // Sweep line: Separate into horizontal bands
    const bands: WidgetBandInfo[][] = [];
    let currentBand: WidgetBandInfo[] = [];
    let currentBandMaxY = -1;

    ySorted.forEach((widget) => {
        if (currentBand.length === 0) {
            currentBand.push(widget);
            currentBandMaxY = widget.yEnd;
            return;
        }

        // Hard cut: widget starts at or after current band's bottom
        if (widget.y >= currentBandMaxY) {
            bands.push(currentBand);
            currentBand = [widget];
            currentBandMaxY = widget.yEnd;
        } else {
            // Widget overlaps with current band
            currentBand.push(widget);
            currentBandMaxY = Math.max(currentBandMaxY, widget.yEnd);
        }
    });

    // Push final band
    if (currentBand.length > 0) {
        bands.push(currentBand);
    }

    // Sort each band by X (column), then Y, then ID
    const sortedInfos = bands.flatMap(band =>
        [...band].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            if (a.y !== b.y) return a.y - b.y;
            return (a.id || '').localeCompare(b.id || '');
        })
    );

    // Create stacked mobile layout
    let currentY = 0;
    return sortedInfos.map(info => {
        const metadata = getWidgetMetadata(info.widget.type);
        const mobileHeight = info.widget.layout.h ?? metadata?.defaultSize?.h ?? 2;
        const newMobileLayout = {
            x: 0,
            y: currentY,
            w: GRID_COLS.sm,
            h: mobileHeight
        };
        currentY += mobileHeight;
        return {
            ...info.widget,
            mobileLayout: newMobileLayout
        };
    });
};

/**
 * Create a snapshot of widgets for mobile editing
 * 
 * When first editing on mobile while linked, we snapshot the desktop layout
 * to mobileWidgets so changes can be tracked independently.
 */
export const createMobileSnapshot = (widgets: FramerrWidget[]): FramerrWidget[] => {
    return widgets.map(w => {
        const metadata = getWidgetMetadata(w.type);
        const defaultH = metadata?.defaultSize?.h ?? 2;
        return {
            ...w,
            mobileLayout: w.mobileLayout || {
                x: 0,
                y: 0,
                w: GRID_COLS.sm,
                h: w.layout.h ?? defaultH
            }
        };
    });
};
