/**
 * Tabs Primitive
 * 
 * Tab navigation component with animated indicator.
 * Uses Radix Tabs for accessibility.
 * 
 * @example
 * <Tabs defaultValue="general">
 *   <Tabs.List>
 *     <Tabs.Trigger value="general">General</Tabs.Trigger>
 *     <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
 *   </Tabs.List>
 *   <Tabs.Content value="general">General settings...</Tabs.Content>
 *   <Tabs.Content value="advanced">Advanced settings...</Tabs.Content>
 * </Tabs>
 */

import React, { forwardRef } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';

// ===========================
// Tabs Root
// ===========================

export interface TabsProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    orientation?: 'horizontal' | 'vertical';
    children: React.ReactNode;
    className?: string;
}

export function Tabs({
    children,
    className = '',
    ...props
}: TabsProps) {
    return (
        <RadixTabs.Root className={className} {...props}>
            {children}
        </RadixTabs.Root>
    );
}

// ===========================
// Tabs.List
// ===========================

export interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
    ({ children, className = '' }, ref) => {
        return (
            <RadixTabs.List
                ref={ref}
                className={`
          flex items-center gap-1
          border-b border-theme
          ${className}
        `}
            >
                {children}
            </RadixTabs.List>
        );
    }
);

TabsList.displayName = 'Tabs.List';

// ===========================
// Tabs.Trigger
// ===========================

export interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
    ({ value, children, className = '', disabled, ...props }, ref) => {
        return (
            <RadixTabs.Trigger
                ref={ref}
                value={value}
                disabled={disabled}
                className={`
          relative px-4 py-2
          text-sm font-medium
          text-theme-secondary
          hover:text-theme-primary
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          data-[state=active]:text-accent
          data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
          ${className}
        `}
                {...props}
            >
                {children}
                {/* Animated underline indicator */}
                <RadixTabs.Trigger value={value} asChild>
                    <motion.span
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                        initial={false}
                        animate={{ opacity: 1 }}
                        layoutId="tabIndicator"
                    />
                </RadixTabs.Trigger>
            </RadixTabs.Trigger>
        );
    }
);

TabsTrigger.displayName = 'Tabs.Trigger';

// ===========================
// Tabs.Content
// ===========================

export interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
    forceMount?: true;
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
    ({ value, children, className = '', forceMount, ...props }, ref) => {
        return (
            <RadixTabs.Content
                ref={ref}
                value={value}
                forceMount={forceMount}
                className={`
          pt-4
          focus:outline-none
          data-[state=inactive]:hidden
          ${className}
        `}
                {...props}
            >
                {children}
            </RadixTabs.Content>
        );
    }
);

TabsContent.displayName = 'Tabs.Content';

// ===========================
// Attach compound components
// ===========================

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { TabsList, TabsTrigger, TabsContent };
