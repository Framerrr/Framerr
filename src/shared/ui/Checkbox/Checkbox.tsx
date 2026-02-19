/**
 * Checkbox Primitive
 * 
 * Radix-based checkbox with checked, unchecked, and indeterminate states.
 * Uses Framer Motion for smooth icon animations.
 * 
 * @example
 * <Checkbox checked={selected} onCheckedChange={setSelected} />
 * <Checkbox checked="indeterminate" />
 */

import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================
// Types
// ===========================

export interface CheckboxProps {
    /** Controlled checked state */
    checked?: boolean | 'indeterminate';
    /** Callback when checked state changes */
    onCheckedChange?: (checked: boolean | 'indeterminate') => void;
    /** Disable the checkbox */
    disabled?: boolean;
    /** Additional class names */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** ID for label association */
    id?: string;
    /** Name for form submission */
    name?: string;
    /** Accessible label */
    'aria-label'?: string;
}

// ===========================
// Size Configuration
// ===========================

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
};

const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18
};

// ===========================
// Component
// ===========================

export const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    onCheckedChange,
    disabled = false,
    className = '',
    size = 'md',
    id,
    name,
    ...props
}) => {
    const isIndeterminate = checked === 'indeterminate';
    const isChecked = checked === true;

    return (
        <CheckboxPrimitive.Root
            id={id}
            name={name}
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            className={`
                ${sizeClasses[size]}
                flex items-center justify-center
                rounded border-2 transition-all duration-150
                ${disabled
                    ? 'opacity-50 cursor-not-allowed border-theme bg-theme-tertiary'
                    : isChecked || isIndeterminate
                        ? 'border-accent bg-accent'
                        : 'border-transparent bg-theme-hover hover:border-accent/50'
                }
                focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
                ${className}
            `}
            {...props}
        >
            <AnimatePresence mode="wait">
                {isChecked && (
                    <CheckboxPrimitive.Indicator asChild forceMount>
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="flex items-center justify-center text-white"
                        >
                            <Check size={iconSizes[size]} strokeWidth={3} />
                        </motion.div>
                    </CheckboxPrimitive.Indicator>
                )}
                {isIndeterminate && (
                    <CheckboxPrimitive.Indicator asChild forceMount>
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="flex items-center justify-center text-white"
                        >
                            <Minus size={iconSizes[size]} strokeWidth={3} />
                        </motion.div>
                    </CheckboxPrimitive.Indicator>
                )}
            </AnimatePresence>
        </CheckboxPrimitive.Root>
    );
};

Checkbox.displayName = 'Checkbox';

export default Checkbox;
