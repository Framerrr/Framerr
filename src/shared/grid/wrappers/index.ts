/**
 * Grid Wrappers - Surface-Specific Grid Implementations
 *
 * Each wrapper combines Core + Policy for a specific surface:
 * - Dashboard: Responsive, edit mode, auto-scroll, visibility filtering
 * - Template Builder: Fixed-width, selection, preview mode
 *
 * Phase 4 will add:
 * - FramerrDashboardGrid.tsx  (Dashboard-specific wrapper)
 *
 * Phase 5 will add:
 * - FramerrTemplateGrid.tsx   (Template Builder wrapper - rewritten)
 */

// Dashboard wrapper (Phase 4)
export { FramerrDashboardGrid } from './FramerrDashboardGrid';
export type { FramerrDashboardGridProps } from './FramerrDashboardGrid';
