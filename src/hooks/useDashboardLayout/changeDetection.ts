/**
 * Change Detection Functions
 * 
 * Smart detection of actual changes vs original state.
 * Used for determining save button state and pendingUnlink triggers.
 * 
 * Delegates structural comparison to ops.isDifferent (canonical core).
 * This module owns the hook-specific baseline selection and unlink decision.
 */

import { isDifferent } from '../../shared/grid/core/ops';
import type { FramerrWidget, Breakpoint, ChangeDetectionResult, MobileLayoutMode } from './types';

/**
 * Check if current layouts OR configs differ from original state.
 * 
 * Key behaviors:
 * - For mobile (sm) edits in linked mode: triggers shouldUnlink if layout changes
 * - For mobile (sm) in independent mode: compares against mobileOriginalLayout
 * - Config-only changes don't trigger unlink (only layout changes do)
 * 
 * @param updatedWidgets - Current widgets to compare
 * @param breakpoint - Which breakpoint we're checking ('lg' or 'sm')
 * @param originalLayout - Original desktop layout (for comparison)
 * @param mobileOriginalLayout - Original mobile layout (for independent mode)
 * @param mobileLayoutMode - Current mobile layout mode
 * @param pendingUnlink - Whether unlink is already pending
 * @param widgets - Current desktop widgets (for pendingUnlink comparison)
 */
export const checkForActualChanges = (
    updatedWidgets: FramerrWidget[],
    breakpoint: Breakpoint,
    originalLayout: FramerrWidget[],
    mobileOriginalLayout: FramerrWidget[],
    mobileLayoutMode: MobileLayoutMode,
    pendingUnlink: boolean,
    widgets: FramerrWidget[]
): ChangeDetectionResult => {
    // Determine which original to compare against (hook-specific logic)
    // For mobile (sm) edits:
    // - If independent mode: compare against mobileOriginalLayout
    // - If pendingUnlink: compare against widgets (the desktop layout that was snapshotted)
    // - Otherwise: compare against originalLayout
    let originalToCompare: FramerrWidget[];
    if (breakpoint === 'sm') {
        if (mobileLayoutMode === 'independent') {
            originalToCompare = mobileOriginalLayout;
        } else if (pendingUnlink) {
            // pendingUnlink means we made a snapshot from widgets, so compare against widgets
            originalToCompare = widgets;
        } else {
            originalToCompare = originalLayout;
        }
    } else {
        originalToCompare = originalLayout;
    }

    // Different widget count = definitely changed (handled by add/delete, not here)
    if (updatedWidgets.length !== originalToCompare.length) {
        return {
            hasChanges: true,
            shouldUnlink: breakpoint === 'sm' && mobileLayoutMode === 'linked'
        };
    }

    // Delegate structural comparison to canonical core ops
    const hasLayoutChanges = isDifferent(updatedWidgets, originalToCompare, {
        breakpoint,
        compareConfig: false,
    });
    const hasConfigChanges = isDifferent(updatedWidgets, originalToCompare, {
        breakpoint,
        compareLayout: false,
    });
    const hasChanges = hasLayoutChanges || hasConfigChanges;

    return {
        hasChanges,
        // Only trigger unlink for LAYOUT changes, not config-only changes
        shouldUnlink: hasLayoutChanges && breakpoint === 'sm' && mobileLayoutMode === 'linked'
    };
};
