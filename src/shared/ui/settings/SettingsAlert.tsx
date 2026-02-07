/**
 * SettingsAlert
 * 
 * Status message component for success, error, warning, and info.
 * Use for inline feedback within settings pages.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, AlertTriangle, Check, Info, XCircle } from 'lucide-react';
import { fadeUp } from '../animations';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface SettingsAlertProps {
    /** Alert type determines styling */
    type: AlertType;
    /** Optional custom icon (defaults based on type) */
    icon?: LucideIcon;
    /** Alert content */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animation */
    noAnimation?: boolean;
}

const defaultIcons: Record<AlertType, LucideIcon> = {
    info: Info,
    success: Check,
    warning: AlertTriangle,
    error: XCircle,
};

const typeStyles: Record<AlertType, string> = {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
};

export const SettingsAlert: React.FC<SettingsAlertProps> = ({
    type,
    icon,
    children,
    className = '',
    noAnimation = false,
}) => {
    const Icon = icon || defaultIcons[type];
    const iconColor = typeStyles[type];

    const Container = noAnimation ? 'div' : motion.div;
    const containerProps = noAnimation ? {} : {
        variants: fadeUp,
        initial: 'hidden',
        animate: 'visible',
    };

    return (
        <Container
            className={`flex items-start gap-3 p-4 bg-theme-tertiary rounded-lg border border-theme ${className}`}
            {...containerProps}
        >
            <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="text-sm text-theme-primary">
                {children}
            </div>
        </Container>
    );
};
