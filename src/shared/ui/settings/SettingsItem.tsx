/**
 * SettingsItem
 * 
 * Level 4 item row for individual settings.
 * Provides consistent layout for label + description + control.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { settingsItem } from '../animations';

export interface SettingsItemProps {
    /** Setting label */
    label: React.ReactNode;
    /** Optional description text */
    description?: string;
    /** Optional icon displayed before label */
    icon?: LucideIcon;
    /** Icon color class (e.g., 'text-accent', 'text-warning') */
    iconColor?: string;
    /** Whether the item is disabled */
    disabled?: boolean;
    /** Control element (Switch, Button, Input, etc.) */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animation */
    noAnimation?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
    label,
    description,
    icon: Icon,
    iconColor = 'text-theme-secondary',
    disabled = false,
    children,
    className = '',
    noAnimation = false,
}) => {
    const Container = noAnimation ? 'div' : motion.div;
    const containerProps = noAnimation ? {} : { variants: settingsItem };

    return (
        <Container
            className={`flex items-center justify-between p-4 bg-theme-tertiary rounded-lg border border-theme ${disabled ? 'opacity-50' : ''} ${className}`}
            {...containerProps}
        >
            <div className={`flex-1 ${Icon ? 'flex items-center gap-3' : ''}`}>
                {Icon && <Icon size={20} className={`flex-shrink-0 ${iconColor}`} />}
                <div>
                    <div className="text-sm font-medium text-theme-primary mb-1">
                        {label}
                    </div>
                    {description && (
                        <div className="text-xs text-theme-tertiary">
                            {description}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 ml-4">
                {children}
            </div>
        </Container>
    );
};
