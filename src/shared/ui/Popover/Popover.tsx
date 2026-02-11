/**
 * Popover Primitive
 * 
 * Contextual information display triggered by click.
 * Uses Radix Popover for accessibility.
 * 
 * Key difference from Select/DropdownMenu:
 * - Does NOT block scroll (closes on scroll instead)
 * - Used for informational content, not selection
 * 
 * @example
 * <Popover>
 *   <Popover.Trigger asChild>
 *     <button>Show Details</button>
 *   </Popover.Trigger>
 *   <Popover.Content>
 *     <h3>Monitor Status</h3>
 *     <p>Response: 142ms</p>
 *   </Popover.Content>
 * </Popover>
 */

import React, { forwardRef, useEffect, useState, useRef } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { popIn } from '../animations';
import { useCloseOnScroll } from '../../../hooks/useCloseOnScroll';
import { useOverlayScrollLock } from '../../../hooks/useOverlayScrollLock';

// ===========================
// Popover Root
// ===========================

export interface PopoverProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
    /** When true, prevents the popover from opening (e.g., during edit mode) */
    disabled?: boolean;
    /** When false, disables the close-on-scroll behavior (for popovers with scrollable content) */
    closeOnScroll?: boolean;
    children: React.ReactNode;
}

export function Popover({
    children,
    onOpenChange,
    disabled = false,
    closeOnScroll = true,
    ...props
}: PopoverProps) {
    const [isOpen, setIsOpen] = useState(props.open ?? props.defaultOpen ?? false);

    // Sync internal state with controlled prop
    useEffect(() => {
        if (props.open !== undefined) {
            setIsOpen(props.open);
        }
    }, [props.open]);

    const handleOpenChange = (open: boolean) => {
        // Block opening when disabled
        if (disabled && open) return;

        setIsOpen(open);
        onOpenChange?.(open);
    };

    // Close on scroll via shared hook
    useCloseOnScroll(
        closeOnScroll && isOpen,
        () => handleOpenChange(false)
    );

    return (
        <RadixPopover.Root
            {...props}
            open={isOpen}
            onOpenChange={handleOpenChange}
        >
            {children}
        </RadixPopover.Root>
    );
}

// ===========================
// Popover.Trigger
// ===========================

export interface PopoverTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
}

const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
    ({ children, asChild = false, className = '' }, ref) => {
        return (
            <RadixPopover.Trigger ref={ref} asChild={asChild} className={className}>
                {children}
            </RadixPopover.Trigger>
        );
    }
);

PopoverTrigger.displayName = 'Popover.Trigger';

// ===========================
// Popover.Content
// ===========================

export interface PopoverContentProps {
    children: React.ReactNode;
    className?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    alignOffset?: number;
    showArrow?: boolean;
    showClose?: boolean;
    /** When set, content will scroll after exceeding this height (e.g. '300px', '50vh') */
    maxHeight?: string;
    /** When set, limits content width (e.g. '320px', '80vw') */
    maxWidth?: string;
    /** Called when a pointer down event occurs outside the content. Call e.preventDefault() to prevent dismiss. */
    onPointerDownOutside?: (e: Event) => void;
    /** Called when an interaction (pointer or focus) happens outside the content. Call e.preventDefault() to prevent dismiss. */
    onInteractOutside?: (e: Event) => void;
    /** Called when focus moves outside the content. Call e.preventDefault() to prevent dismiss. */
    onFocusOutside?: (e: Event) => void;
}

const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
    ({
        children,
        className = '',
        side = 'bottom',
        sideOffset = 8,
        align = 'center',
        alignOffset = 0,
        showArrow = false,
        showClose = false,
        maxHeight,
        maxWidth,
        ...props
    }, ref) => {
        const contentRef = useRef<HTMLDivElement>(null);

        // Prevent touch scroll from bleeding through to the page behind
        useOverlayScrollLock(true, contentRef);

        return (
            <RadixPopover.Portal>
                <RadixPopover.Content
                    ref={ref}
                    side={side}
                    sideOffset={sideOffset}
                    align={align}
                    alignOffset={alignOffset}
                    asChild
                    {...props}
                >
                    <motion.div
                        ref={contentRef}
                        variants={popIn}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={maxHeight || maxWidth ? {
                            ...(maxHeight ? { maxHeight, overflowY: 'auto' as const, overscrollBehavior: 'contain' as const } : {}),
                            ...(maxWidth ? { maxWidth } : {})
                        } : undefined}
                        className={`
              z-[150]
              bg-theme-primary border border-theme rounded-xl
              shadow-xl
              p-4
              ${className}
            `}
                    >
                        {showClose && (
                            <RadixPopover.Close
                                className="absolute top-2 right-2 p-1 rounded-md text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </RadixPopover.Close>
                        )}

                        {children}

                        {showArrow && (
                            <RadixPopover.Arrow className="fill-theme-primary" />
                        )}
                    </motion.div>
                </RadixPopover.Content>
            </RadixPopover.Portal>
        );
    }
);

PopoverContent.displayName = 'Popover.Content';

// ===========================
// Popover.Close
// ===========================

export interface PopoverCloseProps {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
}

const PopoverClose = forwardRef<HTMLButtonElement, PopoverCloseProps>(
    ({ children, asChild = false, className = '' }, ref) => {
        return (
            <RadixPopover.Close ref={ref} asChild={asChild} className={className}>
                {children}
            </RadixPopover.Close>
        );
    }
);

PopoverClose.displayName = 'Popover.Close';

// ===========================
// Attach compound components
// ===========================

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
Popover.Close = PopoverClose;

export { PopoverTrigger, PopoverContent, PopoverClose };
