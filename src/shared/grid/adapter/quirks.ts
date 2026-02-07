/**
 * RGL Quirks - Workarounds and Edge Cases
 *
 * This file contains:
 * - Legacy widget format conversion (backward compatibility)
 * - RGL-specific workarounds
 * - Edge case handling
 */

import type { FramerrWidget, WidgetLayout } from '../../../../shared/types/widget';

// ============================================================================
// Legacy Widget Format Support
// ============================================================================

/**
 * Legacy Widget format (for backward compatibility during migration).
 * Used when importing old widget data that uses i/x/y/w/h and layouts.lg/sm.
 */
interface LegacyWidget {
    i?: string;
    id?: string;
    type: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    config?: Record<string, unknown>;
    layouts?: {
        lg?: WidgetLayout;
        sm?: WidgetLayout;
    };
}

/**
 * Convert legacy Widget to FramerrWidget.
 * Used during migration from old format.
 */
export function fromLegacyWidget(widget: LegacyWidget): FramerrWidget {
    return {
        id: widget.id || widget.i || '',
        type: widget.type,
        layout: widget.layouts?.lg || {
            x: widget.x ?? 0,
            y: widget.y ?? 0,
            w: widget.w ?? 4,
            h: widget.h ?? 2,
        },
        mobileLayout: widget.layouts?.sm,
        config: widget.config,
    };
}

/**
 * Convert FramerrWidget to legacy Widget format.
 * Used for backward compatibility with existing code.
 */
export function toLegacyWidget(widget: FramerrWidget): LegacyWidget {
    return {
        i: widget.id,
        id: widget.id,
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w,
        h: widget.layout.h,
        type: widget.type,
        config: widget.config,
        layouts: {
            lg: widget.layout,
            sm: widget.mobileLayout,
        },
    };
}

// ============================================================================
// Widget ID Generation
// ============================================================================

/**
 * Generate a unique widget ID.
 * Used when creating new widgets.
 */
export function generateWidgetId(): string {
    return `widget-${Date.now()}`;
}
