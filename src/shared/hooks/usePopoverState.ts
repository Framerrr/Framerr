/**
 * usePopoverState - Reusable popover state management with edit-mode blocking
 * 
 * Used by: CalendarWidget (EventPopover), SonarrWidget (EpisodePopover), 
 *          RadarrWidget (MoviePopover), ServiceStatusWidget (MonitorPopover)
 * 
 * Features:
 * - Blocks popover from opening when dashboard is in edit mode
 * - Integrates with useCloseOnScroll for scroll dismissal
 * - Provides Radix UI-compatible onOpenChange handler
 * 
 * @example
 * const { isOpen, onOpenChange } = usePopoverState();
 * <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
 *     <Popover.Trigger>...</Popover.Trigger>
 *     <Popover.Content>...</Popover.Content>
 * </Popover.Root>
 */

import { useState, useCallback } from 'react';
import { useEditModeAware } from './useEditModeAware';
import { useCloseOnScroll } from './useCloseOnScroll';

// ============================================================================
// SECTION: Types
// ============================================================================

export interface UsePopoverStateOptions {
    /** Whether to close the popover on scroll (default: true) */
    closeOnScroll?: boolean;
    /** Initial open state (default: false) */
    defaultOpen?: boolean;
}

export interface UsePopoverStateResult {
    /** Current open state of the popover */
    isOpen: boolean;
    /** Handler for Radix UI Popover onOpenChange - blocks opening in edit mode */
    onOpenChange: (open: boolean) => void;
    /** Manually close the popover */
    close: () => void;
    /** Manually open the popover (respects edit mode) */
    open: () => void;
}

// ============================================================================
// SECTION: Hook Implementation
// ============================================================================

export function usePopoverState(
    options: UsePopoverStateOptions = {}
): UsePopoverStateResult {
    const { closeOnScroll = true, defaultOpen = false } = options;

    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
    const { editMode } = useEditModeAware();

    // Close on scroll (if enabled)
    useCloseOnScroll(closeOnScroll && isOpen, () => setIsOpen(false));

    // Handler that blocks opening when in edit mode
    const onOpenChange = useCallback((open: boolean): void => {
        // Block opening in edit mode, but always allow closing
        if (editMode && open) return;
        setIsOpen(open);
    }, [editMode]);

    // Manual close function
    const close = useCallback((): void => {
        setIsOpen(false);
    }, []);

    // Manual open function (respects edit mode)
    const open = useCallback((): void => {
        if (!editMode) {
            setIsOpen(true);
        }
    }, [editMode]);

    return { isOpen, onOpenChange, close, open };
}

export default usePopoverState;
