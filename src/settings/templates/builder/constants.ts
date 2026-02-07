/**
 * Template Builder Constants
 * 
 * Shared constants for the template builder wizard.
 * Extracted from Step2 and Step3.
 */

// =============================================================================
// VIRTUAL WIDTHS FOR SCALED PREVIEW
// =============================================================================

/** Virtual desktop width for scaled grid rendering */
export const VIRTUAL_DESKTOP_WIDTH = 1200;

/** Virtual mobile width for phone-sized preview */
export const VIRTUAL_MOBILE_WIDTH = 390;

// =============================================================================
// HISTORY MANAGEMENT
// =============================================================================

/** Max undo/redo history size to prevent memory issues */
export const MAX_HISTORY_SIZE = 50;

// =============================================================================
// WIZARD STEPS
// =============================================================================

export const STEPS = [
    { id: 1, label: 'Setup' },
    { id: 2, label: 'Build' },
    { id: 3, label: 'Review' },
] as const;

export type StepId = typeof STEPS[number]['id'];
