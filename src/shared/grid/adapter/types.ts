/**
 * Adapter Types - RGL Isolation Layer
 *
 * This file contains:
 * - RGL-specific types (internal to adapter)
 * - Public adapter contracts (exported to rest of app)
 *
 * ⚠️ RGL types are INTERNAL. Never re-export them outside adapter/
 */

import type { Layout } from 'react-grid-layout';
import type { FramerrWidget } from '../core/types';
import type { GridPolicy, GridEventHandlers, LayoutModel } from '../core/types';

// ============================================================================
// RGL TYPES (Re-exported for backward compatibility during transition)
// ============================================================================

/** Re-export RGL Layout type for consumers that need RGL-compatible signatures */
export type { Layout };

/** RGL Layout with all required fields */
export interface RglLayoutItem extends Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Layouts for both breakpoints (compatible with RGL's Layouts type) */
export interface RglLayouts {
    lg: RglLayoutItem[];
    sm: RglLayoutItem[];
    [key: string]: RglLayoutItem[] | undefined;
}

// ============================================================================
// ADAPTER CONTRACTS (Public API)
// ============================================================================

/**
 * Input to the grid adapter.
 * Wrappers provide this, adapter translates to library-specific format.
 */
export interface AdapterConfig {
    /** Grid behavior policy */
    policy: GridPolicy;
    /** Widgets to render */
    widgets: FramerrWidget[];
    /** Event handlers */
    handlers: GridEventHandlers;
}

/**
 * Output from the grid adapter.
 * Core receives this and renders the grid.
 */
export interface AdapterOutput {
    /** The grid component to render (already configured) */
    GridComponent: React.ComponentType<{ children: React.ReactNode }>;
    /** Props to spread on grid (opaque to consumers) */
    gridProps: Record<string, unknown>;
    /** Layouts in Framerr format */
    layouts: LayoutModel;
}

/**
 * Adapter interface contract.
 * Any library adapter (RGL, GridStack, future) must implement this.
 */
export interface GridAdapterContract {
    build(config: AdapterConfig): AdapterOutput;
}

// ============================================================================
// GRID RENDER CONFIG (Core → Adapter boundary)
// ============================================================================

import type { ReactNode } from 'react';
import type { Breakpoint } from '../core/types';

/**
 * Configuration passed from FramerrGridCore to AdapterGridRenderer.
 * This is the boundary contract - Core produces this, Adapter consumes it.
 * 
 * CRITICAL: The adapter must not need to know about Framerr business logic.
 * All decisions are made by Core, adapter just renders.
 */
export interface GridRenderConfig {
    // ========== Layout Data ==========

    /** Layouts for both breakpoints (already converted to RGL format by Core) */
    layouts: RglLayouts;
    /** Single layout for fixed-width mode */
    fixedLayout: RglLayoutItem[];
    /** Current breakpoint */
    breakpoint: Breakpoint;
    /** Whether to use fixed-width mode (Template Builder) vs responsive (Dashboard) */
    isFixedWidth: boolean;
    /** Fixed width in pixels (only for fixed-width mode) */
    fixedWidth?: number;
    /** Transform scale for fixed-width mode (zoom level) */
    transformScale?: number;

    // ========== Grid Configuration ==========

    /** Column configuration per breakpoint */
    cols: { lg: number; sm: number };
    /** Breakpoints for responsive mode */
    breakpoints: { lg: number; sm: number };
    /** Row height in pixels */
    rowHeight: number | 'auto';
    /** Margin between widgets [horizontal, vertical] */
    margin: [number, number];
    /** Padding around container [horizontal, vertical] */
    containerPadding: [number, number];
    /** Compaction type */
    compactType: 'vertical' | 'horizontal' | null;
    /** Maximum number of rows */
    maxRows: number;
    /** Prevent widget collision */
    preventCollision?: boolean;

    // ========== Interaction Settings ==========

    /** Whether widgets can be dragged */
    isDraggable: boolean;
    /** Whether widgets can be resized */
    isResizable: boolean;
    /** Resize handle positions */
    resizeHandles: string[];
    /** Whether widgets are bounded within container */
    isBounded?: boolean;
    /** CSS selector for elements that cancel drag */
    draggableCancel?: string;

    // ========== Callbacks ==========
    // RGL callback signatures - Core provides these, adapter passes through
    // Using 'any' for RGL-specific handler params since they're opaque to this contract

    /** Called on any layout change */
    onLayoutChange: (currentLayout: RglLayoutItem[], allLayouts?: RglLayouts) => void;

    /** Called when drag starts - receives RGL callback params */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDragStart: (...args: any[]) => void;

    /** Called when drag stops - receives RGL callback params */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDragStop: (...args: any[]) => void;

    /** Called when resize starts - receives RGL callback params */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResizeStart: (...args: any[]) => void;

    /** Called when resize stops - receives RGL callback params */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResizeStop: (...args: any[]) => void;

    // ========== Content ==========

    /** Widget children to render (already wrapped by Core) */
    children: ReactNode;
    /** CSS class name for the grid container */
    className?: string;
}
