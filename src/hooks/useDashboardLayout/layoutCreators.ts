/**
 * Layout Creator Functions
 * 
 * Pure functions to create LayoutItems from FramerrWidget data.
 * Used by both Dashboard and Template Builder.
 * 
 * These functions work with the library-agnostic FramerrWidget type:
 * - widget.layout (desktop)
 * - widget.mobileLayout (mobile, optional)
 * 
 * NOTE: Uses Core's LayoutItem with `id` field (not RGL's `i`).
 */

import { getWidgetMetadata } from '../../widgets/registry';
import type { FramerrWidget, LayoutItem } from './types';

/**
 * Get layout constraints (min/max sizes) from widget metadata
 */
export const getLayoutConstraints = (widget: FramerrWidget): Partial<LayoutItem> => {
    const metadata = getWidgetMetadata(widget.type);
    if (!metadata) return {};

    const constraints: Partial<LayoutItem> = {};
    if (metadata.minSize?.w) constraints.minW = metadata.minSize.w;
    if (metadata.minSize?.h) {
        // Service-status widget: 1 (50px) when header off, 2 (100px) when header on
        if (widget.type === 'service-status') {
            constraints.minH = widget.config?.showHeader === false ? 1 : 2;
        } else {
            constraints.minH = metadata.minSize.h;
        }
    }
    if (metadata.maxSize?.w) constraints.maxW = metadata.maxSize.w;
    if (metadata.maxSize?.h) constraints.maxH = metadata.maxSize.h;
    return constraints;
};

/**
 * Create a desktop (lg breakpoint) layout item from a widget
 * Handles both new format (widget.layout) and legacy format (root-level x/y/w/h)
 */
export const createLgLayoutItem = (widget: FramerrWidget): LayoutItem => {
    const metadata = getWidgetMetadata(widget.type);
    const defaultH = metadata?.defaultSize?.h ?? 4;
    const defaultW = metadata?.defaultSize?.w ?? 4;

    // Support both new format (widget.layout) and legacy format (root-level x/y/w/h)
    const layout = widget.layout || (widget as unknown as { x: number; y: number; w: number; h: number });

    return {
        id: widget.id,
        x: layout.x ?? 0,
        y: layout.y ?? 0,
        w: layout.w ?? defaultW,
        h: layout.h ?? defaultH,
        ...getLayoutConstraints(widget)
    };
};

/**
 * Create a mobile (sm breakpoint) layout item from a widget
 * Handles both new format (widget.mobileLayout/layout) and legacy format (root-level x/y/w/h)
 */
export const createSmLayoutItem = (widget: FramerrWidget): LayoutItem => {
    const metadata = getWidgetMetadata(widget.type);
    const defaultH = metadata?.defaultSize?.h ?? 4;

    // Support priority: mobileLayout > layout > root-level x/y/w/h (legacy)
    const layout = widget.mobileLayout
        || widget.layout
        || (widget as unknown as { x: number; y: number; w: number; h: number });

    return {
        id: widget.id,
        x: layout.x ?? 0,
        y: layout.y ?? 0,
        w: layout.w ?? 4, // Mobile is always 4 columns wide by default
        h: layout.h ?? defaultH,
        ...getLayoutConstraints(widget)
    };
};

/**
 * Create layout items for both breakpoints from a widget array
 */
export const createLayoutsFromWidgets = (
    widgets: FramerrWidget[],
    mobileWidgets?: FramerrWidget[]
): { lg: LayoutItem[]; sm: LayoutItem[] } => {
    return {
        lg: widgets.map(createLgLayoutItem),
        sm: (mobileWidgets || widgets).map(createSmLayoutItem)
    };
};
