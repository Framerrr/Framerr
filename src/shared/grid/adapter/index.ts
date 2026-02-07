/**
 * Grid Adapter - Grid Library Isolation Layer
 *
 * This is the ONLY place where grid libraries may be imported directly.
 * All library types and behaviors are translated to Framerr types here.
 *
 * The ESLint rule `no-restricted-imports` enforces this boundary.
 * See eslint.config.js for enforcement details.
 *
 * Structure:
 * - types.ts                      - Adapter contracts and shared types
 * - GridStackAdapterV2.tsx        - React wrapper for GridStack
 * - DragPreviewPortal.tsx         - Portal bridge for drag preview widgets
 * - setupExternalDragSources.ts   - External drag source configuration
 * - layoutEngine.ts               - Layout computation utilities
 * - quirks.ts                     - Legacy format support
 */

// ============================================================================
// Types
// ============================================================================

export type {
    Layout,
    RglLayoutItem,
    RglLayouts,
} from './types';

// ============================================================================
// GridStack Adapter
// ============================================================================

export { GridStackAdapterV2 } from './GridStackAdapterV2';
export type { GridStackAdapterV2Props } from './GridStackAdapterV2';

export { DragPreviewPortal } from './DragPreviewPortal';
export type { DragPreviewPortalProps } from './DragPreviewPortal';

// ============================================================================
// External Drag Setup (GridStack)
// ============================================================================

export { setupExternalDragSources } from './setupExternalDragSources';

// ============================================================================
// Quirks & Legacy Support
// ============================================================================

export {
    fromLegacyWidget,
    toLegacyWidget,
    generateWidgetId,
} from './quirks';
