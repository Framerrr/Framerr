/**
 * DropdownMenu Primitive
 * 
 * Action menu triggered by click/right-click.
 * Uses Radix DropdownMenu for accessibility.
 * 
 * Key difference from Select:
 * - For action triggers (Edit, Delete, etc.), not value selection
 * - Blocks scroll when open (like Select)
 * 
 * @example
 * <DropdownMenu>
 *   <DropdownMenu.Trigger asChild>
 *     <button>Options</button>
 *   </DropdownMenu.Trigger>
 *   <DropdownMenu.Content>
 *     <DropdownMenu.Item onClick={handleEdit}>
 *       <Pencil size={16} />
 *       Edit
 *     </DropdownMenu.Item>
 *     <DropdownMenu.Separator />
 *     <DropdownMenu.Item onClick={handleDelete} destructive>
 *       <Trash size={16} />
 *       Delete
 *     </DropdownMenu.Item>
 *   </DropdownMenu.Content>
 * </DropdownMenu>
 */

import React, { forwardRef, useState, useCallback, useEffect } from 'react';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { popIn } from '../animations';
import { useCloseOnScroll } from '../../../hooks/useCloseOnScroll';
import { useOverlayScrollLock } from '../../../hooks/useOverlayScrollLock';

// ===========================
// DropdownMenu Root
// ===========================

export interface DropdownMenuProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** 
     * Modal behavior - when true, clicking outside or opening another dropdown 
     * will close this one. Defaults to true for proper UX.
     */
    modal?: boolean;
    /**
     * Close the dropdown when the main scroll container is scrolled.
     * Useful for dashboard dropdowns that float in a portal.
     */
    closeOnScroll?: boolean;
    children: React.ReactNode;
}

export function DropdownMenu({
    children,
    modal = true,
    closeOnScroll = false,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    ...props
}: DropdownMenuProps) {
    // Internal state management for close-on-scroll
    const [internalOpen, setInternalOpen] = useState(false);

    // Use controlled or internal state
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    const handleOpenChange = useCallback((open: boolean) => {
        if (!isControlled) {
            setInternalOpen(open);
        }
        controlledOnOpenChange?.(open);
    }, [isControlled, controlledOnOpenChange]);

    // Close on scroll when enabled
    useCloseOnScroll(
        closeOnScroll && isOpen,
        () => handleOpenChange(false)
    );

    return (
        <RadixDropdownMenu.Root
            modal={modal}
            open={isOpen}
            onOpenChange={handleOpenChange}
            {...props}
        >
            {children}
        </RadixDropdownMenu.Root>
    );
}

// ===========================
// DropdownMenu.Trigger
// ===========================

export interface DropdownMenuTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
}

const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
    ({ children, asChild = false, className = '' }, ref) => {
        return (
            <RadixDropdownMenu.Trigger ref={ref} asChild={asChild} className={className}>
                {children}
            </RadixDropdownMenu.Trigger>
        );
    }
);

DropdownMenuTrigger.displayName = 'DropdownMenu.Trigger';

// ===========================
// DropdownMenu.Content
// ===========================

export interface DropdownMenuContentProps {
    children: React.ReactNode;
    className?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    alignOffset?: number;
}

const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
    ({
        children,
        className = '',
        side = 'bottom',
        sideOffset = 4,
        align = 'end',
        alignOffset = 0,
        ...props
    }, ref) => {
        const contentRef = React.useRef<HTMLDivElement>(null);

        // Prevent touch scroll from bleeding through to the page behind
        useOverlayScrollLock(true, contentRef);

        return (
            <RadixDropdownMenu.Portal>
                <RadixDropdownMenu.Content
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
                        className={`
              z-[150]
              min-w-[10rem] max-h-[300px] overflow-y-auto
              bg-theme-secondary border border-theme rounded-lg
              shadow-xl
              py-1
              ${className}
            `}
                        style={{ overscrollBehavior: 'contain' }}
                    >
                        {children}
                    </motion.div>
                </RadixDropdownMenu.Content>
            </RadixDropdownMenu.Portal>
        );
    }
);

DropdownMenuContent.displayName = 'DropdownMenu.Content';

// ===========================
// DropdownMenu.Item
// ===========================

export interface DropdownMenuItemProps {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onSelect?: (event: Event) => void;
    destructive?: boolean;
}

const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
    ({ children, className = '', disabled, onSelect, destructive = false, ...props }, ref) => {
        return (
            <RadixDropdownMenu.Item
                ref={ref}
                disabled={disabled}
                onSelect={onSelect}
                className={`
          relative flex items-center gap-2
          px-3 py-2
          text-sm cursor-pointer
          focus:outline-none
          data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
          ${destructive
                        ? 'text-error hover:bg-error/10 focus:bg-error/10'
                        : 'text-theme-primary hover:bg-theme-hover focus:bg-theme-hover'
                    }
          ${className}
        `}
                {...props}
            >
                {children}
            </RadixDropdownMenu.Item>
        );
    }
);

DropdownMenuItem.displayName = 'DropdownMenu.Item';

// ===========================
// DropdownMenu.CheckboxItem
// ===========================

export interface DropdownMenuCheckboxItemProps {
    children: React.ReactNode;
    className?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
}

const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
    ({ children, className = '', checked, onCheckedChange, disabled, ...props }, ref) => {
        return (
            <RadixDropdownMenu.CheckboxItem
                ref={ref}
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className={`
          relative flex items-center gap-2
          pl-8 pr-3 py-2
          text-sm text-theme-primary cursor-pointer
          hover:bg-theme-hover focus:bg-theme-hover focus:outline-none
          data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
          ${className}
        `}
                {...props}
            >
                <RadixDropdownMenu.ItemIndicator className="absolute left-2">
                    <Check size={16} className="text-accent" />
                </RadixDropdownMenu.ItemIndicator>
                {children}
            </RadixDropdownMenu.CheckboxItem>
        );
    }
);

DropdownMenuCheckboxItem.displayName = 'DropdownMenu.CheckboxItem';

// ===========================
// DropdownMenu.Separator
// ===========================

export interface DropdownMenuSeparatorProps {
    className?: string;
}

const DropdownMenuSeparator = forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
    ({ className = '' }, ref) => {
        return (
            <RadixDropdownMenu.Separator
                ref={ref}
                className={`h-px my-1 bg-theme-hover ${className}`}
            />
        );
    }
);

DropdownMenuSeparator.displayName = 'DropdownMenu.Separator';

// ===========================
// DropdownMenu.Label
// ===========================

export interface DropdownMenuLabelProps {
    children: React.ReactNode;
    className?: string;
}

const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
    ({ children, className = '' }, ref) => {
        return (
            <RadixDropdownMenu.Label
                ref={ref}
                className={`px-3 py-2 text-xs font-medium text-theme-tertiary ${className}`}
            >
                {children}
            </RadixDropdownMenu.Label>
        );
    }
);

DropdownMenuLabel.displayName = 'DropdownMenu.Label';

// ===========================
// DropdownMenu.Group
// ===========================

export interface DropdownMenuGroupProps {
    children: React.ReactNode;
}

const DropdownMenuGroup = ({ children }: DropdownMenuGroupProps) => {
    return <RadixDropdownMenu.Group>{children}</RadixDropdownMenu.Group>;
};

DropdownMenuGroup.displayName = 'DropdownMenu.Group';

// ===========================
// Attach compound components
// ===========================

DropdownMenu.Trigger = DropdownMenuTrigger;
DropdownMenu.Content = DropdownMenuContent;
DropdownMenu.Item = DropdownMenuItem;
DropdownMenu.CheckboxItem = DropdownMenuCheckboxItem;
DropdownMenu.Separator = DropdownMenuSeparator;
DropdownMenu.Label = DropdownMenuLabel;
DropdownMenu.Group = DropdownMenuGroup;

export {
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuGroup,
};
