/**
 * Badge Primitive
 * 
 * Status indicator badges with semantic colors.
 * Simple, non-interactive component.
 * 
 * @example
 * <Badge variant="success">Online</Badge>
 * <Badge variant="error">Error</Badge>
 * <Badge variant="warning" size="sm">Pending</Badge>
 */

import React, { forwardRef } from 'react';

// ===========================
// Variants
// ===========================

const variants = {
    default: 'bg-theme-tertiary text-theme-primary',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-error/20 text-error',
    info: 'bg-info/20 text-info',
    accent: 'bg-accent/20 text-accent',
} as const;

const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
} as const;

export type BadgeVariant = keyof typeof variants;
export type BadgeSize = keyof typeof sizes;

// ===========================
// Badge Component
// ===========================

export interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    className?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ children, variant = 'default', size = 'md', className = '' }, ref) => {
        return (
            <span
                ref={ref}
                className={`
          inline-flex items-center
          font-medium rounded-full
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';

export default Badge;
