/**
 * Select Primitive
 * 
 * Dropdown component for selecting from a list of options.
 * Uses Radix Select for accessibility and proper scroll handling.
 * 
 * Features:
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Scroll lock when open (blocks page scroll)
 * - Focus management
 * - Compound component API
 * - Only one Select open at a time (global tracking)
 * 
 * @example
 * <Select value={theme} onValueChange={setTheme}>
 *   <Select.Trigger>
 *     <Select.Value placeholder="Choose theme..." />
 *   </Select.Trigger>
 *   <Select.Content>
 *     <Select.Item value="dark">Dark Pro</Select.Item>
 *     <Select.Item value="light">Light</Select.Item>
 *   </Select.Content>
 * </Select>
 */

import React, { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { popIn } from '../animations';
import { formSizeClasses, type FormSize } from '../formSizeClasses';
import { useCloseOnScroll } from '../../../hooks/useCloseOnScroll';
import { useOverlayScrollLock } from '../../../hooks/useOverlayScrollLock';

// Global tracker - when a select opens, it closes any previously open one
let currentlyOpenSelect: { close: () => void } | null = null;

// Backwards compatibility - no longer needed but keep the export
export function SelectProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

// ===========================
// Select Root
// ===========================

export interface SelectProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
    name?: string;
    required?: boolean;
    /** Close when main scroll container is scrolled. Default false (settings context). */
    closeOnScroll?: boolean;
    children: React.ReactNode;
}

export function Select({
    children,
    open: controlledOpen,
    onOpenChange: externalOnOpenChange,
    closeOnScroll = false,
    ...props
}: SelectProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    // Keep a ref to the close function so we can call it from global tracker
    const closeRef = useRef<() => void>(() => { });

    const doClose = useCallback(() => {
        if (isControlled) {
            externalOnOpenChange?.(false);
        } else {
            setInternalOpen(false);
        }
    }, [isControlled, externalOnOpenChange]);

    // Update ref when doClose changes
    useEffect(() => {
        closeRef.current = doClose;
    }, [doClose]);

    const handleOpenChange = useCallback((open: boolean) => {
        if (open) {
            // Close any other open select first
            if (currentlyOpenSelect && currentlyOpenSelect.close !== closeRef.current) {
                currentlyOpenSelect.close();
            }
            // Register this one
            currentlyOpenSelect = { close: () => closeRef.current() };
        } else {
            // Clear if this was the open one
            if (currentlyOpenSelect?.close === closeRef.current) {
                currentlyOpenSelect = null;
            }
        }

        if (isControlled) {
            externalOnOpenChange?.(open);
        } else {
            setInternalOpen(open);
        }
    }, [isControlled, externalOnOpenChange]);

    // Close on scroll when enabled
    useCloseOnScroll(
        closeOnScroll && isOpen,
        () => handleOpenChange(false)
    );

    return (
        <RadixSelect.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            {...props}
        >
            {children}
        </RadixSelect.Root>
    );
}

// ===========================
// Select.Trigger
// ===========================

export interface SelectTriggerProps {
    children: React.ReactNode;
    className?: string;
    /** Size preset — matches Button and Input sizing */
    size?: FormSize;
    'aria-label'?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
    ({ children, className = '', size = 'md', ...props }, ref) => {
        const sizeStyles = formSizeClasses[size];
        return (
            <RadixSelect.Trigger
                ref={ref}
                className={`
          inline-flex items-center justify-between gap-2
          ${sizeStyles.height}
          ${sizeStyles.padding}
          bg-theme-tertiary border border-theme rounded-lg
          ${sizeStyles.text} text-theme-primary
          hover:bg-theme-hover transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-theme-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
                {...props}
            >
                {children}
                <RadixSelect.Icon>
                    <ChevronDown size={sizeStyles.iconSize} className="text-theme-secondary" />
                </RadixSelect.Icon>
            </RadixSelect.Trigger>
        );
    }
);

SelectTrigger.displayName = 'Select.Trigger';

// ===========================
// Select.Value
// ===========================

export interface SelectValueProps {
    placeholder?: string;
    className?: string;
}

const SelectValue = forwardRef<HTMLSpanElement, SelectValueProps>(
    ({ placeholder, className = '' }, ref) => {
        return (
            <RadixSelect.Value
                ref={ref}
                placeholder={placeholder}
                className={`data-[placeholder]:text-theme-secondary ${className}`}
            />
        );
    }
);

SelectValue.displayName = 'Select.Value';

// ===========================
// Select.Content
// ===========================

export interface SelectContentProps {
    children: React.ReactNode;
    className?: string;
    position?: 'popper' | 'item-aligned';
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
    ({
        children,
        className = '',
        position = 'popper',
        side = 'bottom',
        sideOffset = 4,
        align = 'start',
        ...props
    }, ref) => {
        const contentRef = useRef<HTMLDivElement>(null);

        // Prevent touch scroll from bleeding through to the page behind
        useOverlayScrollLock(true, contentRef);

        return (
            <RadixSelect.Portal>
                <RadixSelect.Content
                    ref={ref}
                    position={position}
                    side={side}
                    sideOffset={sideOffset}
                    align={align}
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
              min-w-[8rem]
              bg-theme-primary border border-theme rounded-xl
              shadow-xl
              p-4
              ${className}
            `}
                    >
                        <RadixSelect.Viewport
                            className="max-h-[300px] overflow-y-auto"
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            {children}
                        </RadixSelect.Viewport>
                    </motion.div>
                </RadixSelect.Content>
            </RadixSelect.Portal>
        );
    }
);

SelectContent.displayName = 'Select.Content';

// ===========================
// Select.Item
// ===========================

export interface SelectItemProps {
    value: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
    ({ value, children, className = '', disabled, ...props }, ref) => {
        return (
            <RadixSelect.Item
                ref={ref}
                value={value}
                disabled={disabled}
                className={`
          relative flex items-center gap-3
          px-3 py-2 pr-8 rounded-md
          text-sm text-theme-primary
          cursor-pointer
          hover:bg-theme-hover
          focus:bg-theme-hover focus:outline-none
          data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
          ${className}
        `}
                {...props}
            >
                <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2">
                    <Check size={16} className="text-accent" />
                </RadixSelect.ItemIndicator>
            </RadixSelect.Item>
        );
    }
);

SelectItem.displayName = 'Select.Item';

// ===========================
// Select.Separator
// ===========================

export interface SelectSeparatorProps {
    className?: string;
}

const SelectSeparator = forwardRef<HTMLDivElement, SelectSeparatorProps>(
    ({ className = '' }, ref) => {
        return (
            <RadixSelect.Separator
                ref={ref}
                className={`h-px my-1 bg-theme-hover ${className}`}
            />
        );
    }
);

SelectSeparator.displayName = 'Select.Separator';

// ===========================
// Select.Group & Label
// ===========================

export interface SelectGroupProps {
    children: React.ReactNode;
}

const SelectGroup = ({ children }: SelectGroupProps) => {
    return <RadixSelect.Group>{children}</RadixSelect.Group>;
};

SelectGroup.displayName = 'Select.Group';

export interface SelectLabelProps {
    children: React.ReactNode;
    className?: string;
}

const SelectLabel = forwardRef<HTMLDivElement, SelectLabelProps>(
    ({ children, className = '' }, ref) => {
        return (
            <RadixSelect.Label
                ref={ref}
                className={`px-3 py-2 text-xs font-medium text-theme-tertiary uppercase ${className}`}
            >
                {children}
            </RadixSelect.Label>
        );
    }
);

SelectLabel.displayName = 'Select.Label';

// ===========================
// Attach compound components
// ===========================

Select.Trigger = SelectTrigger;
Select.Value = SelectValue;
Select.Content = SelectContent;
Select.Item = SelectItem;
Select.Separator = SelectSeparator;
Select.Group = SelectGroup;
Select.Label = SelectLabel;

export {
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectGroup,
    SelectLabel,
};
