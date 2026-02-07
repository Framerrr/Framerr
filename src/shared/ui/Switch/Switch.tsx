/**
 * Switch Primitive
 * 
 * Toggle component for on/off states.
 * Uses Radix Switch for accessibility with CSS transitions.
 * 
 * @example
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 */

import React, { forwardRef, useState } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

// ===========================
// Switch Component
// ===========================

export interface SwitchProps {
    /** Controlled checked state */
    checked?: boolean;
    /** Default checked state (uncontrolled) */
    defaultChecked?: boolean;
    /** Called when checked state changes */
    onCheckedChange?: (checked: boolean) => void;
    /** Disable the switch */
    disabled?: boolean;
    /** Additional class for track */
    className?: string;
    /** Accessible name */
    'aria-label'?: string;
    /** ID for form association */
    id?: string;
    /** Name for form submission */
    name?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
    (
        {
            checked: controlledChecked,
            defaultChecked = false,
            onCheckedChange,
            disabled = false,
            className = '',
            ...props
        },
        ref
    ) => {
        // Track internal state for uncontrolled usage
        const [internalChecked, setInternalChecked] = useState(defaultChecked);
        const isControlled = controlledChecked !== undefined;
        const isChecked = isControlled ? controlledChecked : internalChecked;

        const handleCheckedChange = (checked: boolean) => {
            if (!isControlled) {
                setInternalChecked(checked);
            }
            onCheckedChange?.(checked);
        };

        return (
            <RadixSwitch.Root
                ref={ref}
                checked={isChecked}
                onCheckedChange={handleCheckedChange}
                disabled={disabled}
                className={`
                    w-11 h-6 flex-shrink-0
                    relative rounded-full
                    transition-colors duration-200
                    focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isChecked ? 'bg-accent border-accent' : 'bg-theme-tertiary border border-theme'}
                    ${className}
                `}
                {...props}
            >
                <RadixSwitch.Thumb
                    className={`
                        block w-5 h-5 rounded-full
                        bg-white shadow-sm
                        transition-transform duration-200
                        ${isChecked ? 'translate-x-[22px] border-white' : 'translate-x-[2px] border-theme'}
                    `}
                />
            </RadixSwitch.Root>
        );
    }
);

Switch.displayName = 'Switch';

export type SwitchSize = 'sm' | 'md' | 'lg';

export default Switch;

