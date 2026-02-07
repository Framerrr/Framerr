/**
 * Checkbox - Radix-based checkbox with checked, unchecked, and indeterminate states
 * 
 * Standard component for use system-wide wherever checkboxes are needed.
 */

import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
}

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

const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    onCheckedChange,
    disabled = false,
    className = '',
    size = 'md',
    id
}) => {
    const isIndeterminate = checked === 'indeterminate';
    const isChecked = checked === true;

    return (
        <CheckboxPrimitive.Root
            id={id}
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
                        : 'border-theme-light bg-theme-tertiary hover:border-accent/50'
                }
                focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-1 focus:ring-offset-transparent
                ${className}
            `}
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

export default Checkbox;
