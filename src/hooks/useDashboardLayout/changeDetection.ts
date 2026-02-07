/**
 * Change Detection Functions
 * 
 * Smart detection of actual changes vs original state.
 * Used for determining save button state and pendingUnlink triggers.
 * 
 * Uses FramerrWidget type with .layout and .mobileLayout properties.
 */

import type { FramerrWidget, Breakpoint, ChangeDetectionResult, MobileLayoutMode } from './types';

/**
 * Get the layout for a specific breakpoint from a FramerrWidget
 */
const getLayoutForBreakpoint = (widget: FramerrWidget, breakpoint: Breakpoint) => {
    return breakpoint === 'sm' ? (widget.mobileLayout || widget.layout) : widget.layout;
};

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
    // Determine which original to compare against
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

    // Track layout and config changes separately
    let hasLayoutChanges = false;
    let hasConfigChanges = false;

    // Compare each widget's layout AND config at the relevant breakpoint
    updatedWidgets.forEach(widget => {
        const original = originalToCompare.find(w => w.id === widget.id);
        if (!original) {
            hasLayoutChanges = true; // Widget doesn't exist in original
            return;
        }

        // Check layout changes
        const curr = getLayoutForBreakpoint(widget, breakpoint);
        const orig = getLayoutForBreakpoint(original, breakpoint);

        if (curr.x !== orig.x ||
            curr.y !== orig.y ||
            curr.w !== orig.w ||
            curr.h !== orig.h) {
            hasLayoutChanges = true;
        }

        // Check config changes (for widgets like LinkGrid)
        const currConfig = JSON.stringify(widget.config || {});
        const origConfig = JSON.stringify(original.config || {});
        if (currConfig !== origConfig) {
            hasConfigChanges = true;
        }
    });

    const hasChanges = hasLayoutChanges || hasConfigChanges;

    return {
        hasChanges,
        // Only trigger unlink for LAYOUT changes, not config-only changes
        shouldUnlink: hasLayoutChanges && breakpoint === 'sm' && mobileLayoutMode === 'linked'
    };
};
