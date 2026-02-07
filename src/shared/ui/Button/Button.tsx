/**
 * Button Primitive
 * 
 * A versatile button component with multiple variants, sizes, loading state,
 * and icon support. Part of the Framerr Design System.
 * 
 * @example
 * // Primary button with icon
 * <Button variant="primary" icon={Save}>Save Changes</Button>
 * 
 * @example
 * // Loading state
 * <Button loading>Saving...</Button>
 * 
 * @example
 * // Icon on right
 * <Button icon={ArrowRight} iconPosition="right">Next</Button>
 * 
 * @example
 * // Danger button, small size
 * <Button variant="danger" size="sm">Delete</Button>
 */

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

// ===========================
// Types
// ===========================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type IconPosition = 'left' | 'right';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button content */
    children?: React.ReactNode;
    /** Visual variant */
    variant?: ButtonVariant;
    /** Size preset (controls height, padding, icon size, and gap) */
    size?: ButtonSize;
    /** Text size - if not specified, scales with button size */
    textSize?: 'sm' | 'base' | 'lg';
    /** Custom background color (overrides variant) - e.g. for brand colors */
    customColor?: {
        background: string;
        text?: string;  // defaults to #000
    };
    /** Lucide icon component */
    icon?: LucideIcon;
    /** Icon position relative to text */
    iconPosition?: IconPosition;
    /** Show loading spinner and disable button */
    loading?: boolean;
    /** Expand to full width of container */
    fullWidth?: boolean;
}

// ===========================
// Shared Size Classes
// Used by both Button and ConfirmButton primitives
// ===========================

export const buttonSizeClasses = {
    sm: {
        height: 'h-7',
        padding: 'px-3 py-1.5',
        text: 'text-sm',
        gap: 'gap-1',
        iconSize: 14,
    },
    md: {
        height: 'h-9',
        padding: 'px-4 py-2',
        text: 'text-base',
        gap: 'gap-2',
        iconSize: 16,
    },
    lg: {
        height: 'h-11',
        padding: 'px-6 py-3',
        text: 'text-lg',
        gap: 'gap-2',
        iconSize: 20,
    },
} as const;

// ===========================
// Variant Classes
// ===========================

const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover border-none',
    secondary: 'bg-theme-tertiary text-theme-primary border border-theme hover:bg-theme-hover',
    danger: 'bg-error text-white border-none hover:bg-red-600',
    ghost: 'bg-transparent text-theme-primary border-transparent hover:bg-theme-hover',
    outline: 'bg-transparent text-accent border border-accent hover:bg-accent/10',
};

// ===========================
// Component
// ===========================

export const Button = ({
    children,
    variant = 'primary',
    size = 'sm',
    textSize,
    customColor,
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    fullWidth = false,
    disabled = false,
    type = 'button',
    className = '',
    style,
    ...props
}: ButtonProps): React.JSX.Element => {
    const sizeStyles = buttonSizeClasses[size];
    // Use explicit textSize if provided, otherwise scale with button size
    const textClass = textSize ? `text-${textSize}` : sizeStyles.text;
    const isDisabled = disabled || loading;

    // Build custom style for customColor
    const customColorStyle: React.CSSProperties = customColor ? {
        backgroundColor: customColor.background,
        color: customColor.text || '#000',
        border: 'none',
        ...style
    } : style || {};

    const iconElement = loading ? (
        <Loader2 size={sizeStyles.iconSize} className="animate-spin" />
    ) : Icon ? (
        <Icon size={sizeStyles.iconSize} />
    ) : null;

    return (
        <button
            type={type}
            disabled={isDisabled}
            className={`
                inline-flex items-center justify-center
                font-medium transition-all rounded-lg
                ${customColor ? '' : variantClasses[variant]}
                ${sizeStyles.height}
                ${sizeStyles.padding}
                ${textClass}
                ${sizeStyles.gap}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
                ${fullWidth ? 'w-full' : 'w-auto'}
                ${className}
            `}
            style={customColorStyle}
            {...props}
        >
            {iconPosition === 'left' && iconElement}
            {children}
            {iconPosition === 'right' && iconElement}
        </button>
    );
};

export default Button;
