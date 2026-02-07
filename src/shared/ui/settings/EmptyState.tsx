/**
 * EmptyState
 * 
 * Standardized empty state placeholder for lists and sections.
 * Use when there's no data to display (e.g., no tabs, no integrations).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { fadeUp } from '../animations';

export interface EmptyStateProps {
    /** Icon to display */
    icon: LucideIcon;
    /** Message to display */
    message: string;
    /** Optional action button */
    action?: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animation */
    noAnimation?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    message,
    action,
    className = '',
    noAnimation = false,
}) => {
    const Container = noAnimation ? 'div' : motion.div;
    const containerProps = noAnimation ? {} : {
        variants: fadeUp,
        initial: 'hidden',
        animate: 'visible',
    };

    return (
        <Container
            className={`rounded-lg p-12 text-center border border-theme-light bg-theme-tertiary ${className}`}
            {...containerProps}
        >
            <Icon size={48} className="mx-auto mb-4 opacity-50 text-theme-tertiary" />
            <p className="text-theme-secondary">{message}</p>
            {action && (
                <div className="mt-4">
                    {action}
                </div>
            )}
        </Container>
    );
};
