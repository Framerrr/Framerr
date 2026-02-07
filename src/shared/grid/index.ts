/**
 * Grid module exports
 * 
 * This module provides the library-agnostic grid abstraction.
 * GridStack is used as the underlying grid library.
 * 
 * ARCHITECTURE: Only high-level wrappers and canonical types are exported.
 */
// ============================================================================
// HIGH-LEVEL WRAPPERS (Primary API)
// ============================================================================

// Dashboard-specific wrapper
export { FramerrDashboardGrid } from './wrappers/FramerrDashboardGrid';
export type { FramerrDashboardGridProps } from './wrappers/FramerrDashboardGrid';

// Template Builder-specific wrapper
export { FramerrTemplateGrid } from './wrappers/FramerrTemplateGrid';
export type { FramerrTemplateGridProps } from './wrappers/FramerrTemplateGrid';

// ============================================================================
// CANONICAL TYPES (Library-Agnostic)
// ============================================================================

export type {
    FramerrWidget,
    GridPolicy,
    LayoutEvent,
    Breakpoint,
    WidgetConstraints,
} from './core/types';

// Utility for generating widget IDs
export { generateWidgetId } from './adapter';
