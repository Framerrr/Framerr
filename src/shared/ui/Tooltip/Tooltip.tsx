/**
 * Tooltip Primitive
 * 
 * Hover hints with delay and close-on-scroll behavior.
 * Uses Radix Tooltip for accessibility.
 * 
 * @example
 * <Tooltip content="This is a helpful tip">
 *   <button>Hover me</button>
 * </Tooltip>
 * 
 * // Or with compound components for more control:
 * <Tooltip.Provider>
 *   <Tooltip>
 *     <Tooltip.Trigger asChild>
 *       <button>Hover me</button>
 *     </Tooltip.Trigger>
 *     <Tooltip.Content>This is a tip</Tooltip.Content>
 *   </Tooltip>
 * </Tooltip.Provider>
 */

import React, { forwardRef } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { fade } from '../animations';

// ===========================
// Tooltip Provider (wrap app once)
// ===========================

export interface TooltipProviderProps {
    children: React.ReactNode;
    delayDuration?: number;
    skipDelayDuration?: number;
}

export function TooltipProvider({
    children,
    delayDuration = 300,
    skipDelayDuration = 0,
}: TooltipProviderProps) {
    return (
        <RadixTooltip.Provider
            delayDuration={delayDuration}
            skipDelayDuration={skipDelayDuration}
        >
            {children}
        </RadixTooltip.Provider>
    );
}

// ===========================
// Tooltip Root
// ===========================

export interface TooltipProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    /** Simple API: just provide content string */
    content?: string;
}

export function Tooltip({
    children,
    content,
    ...props
}: TooltipProps) {
    // Simple API: if content prop provided, wrap children automatically
    if (content) {
        return (
            <RadixTooltip.Root {...props}>
                <RadixTooltip.Trigger asChild>
                    {children}
                </RadixTooltip.Trigger>
                <TooltipContent>{content}</TooltipContent>
            </RadixTooltip.Root>
        );
    }

    // Compound API: children include Trigger and Content
    return (
        <RadixTooltip.Root {...props}>
            {children}
        </RadixTooltip.Root>
    );
}

// ===========================
// Tooltip.Trigger
// ===========================

export interface TooltipTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
}

const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
    ({ children, asChild = false, className = '' }, ref) => {
        return (
            <RadixTooltip.Trigger ref={ref} asChild={asChild} className={className}>
                {children}
            </RadixTooltip.Trigger>
        );
    }
);

TooltipTrigger.displayName = 'Tooltip.Trigger';

// ===========================
// Tooltip.Content
// ===========================

export interface TooltipContentProps {
    children: React.ReactNode;
    className?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
    ({
        children,
        className = '',
        side = 'top',
        sideOffset = 4,
        align = 'center',
        ...props
    }, ref) => {
        return (
            <RadixTooltip.Portal>
                <RadixTooltip.Content
                    ref={ref}
                    side={side}
                    sideOffset={sideOffset}
                    align={align}
                    asChild
                    {...props}
                >
                    <motion.div
                        variants={fade}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`
              z-[200]
              px-3 py-1.5
              bg-theme-primary border border-theme rounded-lg
              text-sm text-theme-primary
              shadow-lg
              ${className}
            `}
                    >
                        {children}
                        <RadixTooltip.Arrow className="fill-theme-primary" />
                    </motion.div>
                </RadixTooltip.Content>
            </RadixTooltip.Portal>
        );
    }
);

TooltipContent.displayName = 'Tooltip.Content';

// ===========================
// Attach compound components
// ===========================

Tooltip.Provider = TooltipProvider;
Tooltip.Trigger = TooltipTrigger;
Tooltip.Content = TooltipContent;

export { TooltipTrigger, TooltipContent };
