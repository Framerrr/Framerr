/**
 * Shared Form Size Classes
 * 
 * Single source of truth for sizing across form components
 * (Button, Select, Input). Matches buttonSizeClasses in Button.tsx.
 * 
 * Use this to keep heights, padding, and text sizes consistent
 * when mixing Buttons, Selects, and Inputs in the same row.
 */

export type FormSize = 'sm' | 'md' | 'lg';

export const formSizeClasses = {
    sm: {
        height: 'h-7',
        padding: 'px-3 py-1.5',
        text: 'text-sm',
        iconSize: 14,
    },
    md: {
        height: 'h-9',
        padding: 'px-3 py-2',
        text: 'text-sm',
        iconSize: 16,
    },
    lg: {
        height: 'h-11',
        padding: 'px-4 py-3',
        text: 'text-base',
        iconSize: 20,
    },
} as const;
