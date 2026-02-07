/**
 * SettingsPage
 * 
 * Container component for settings pages.
 * Provides consistent layout and staggered animation for sections.
 * 
 * Animation respects keep-alive: only animates on first render,
 * not when page is revealed after returning from Dashboard.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { settingsPageContainer } from '../animations';
import { useSettingsAnimation } from '../../../context/SettingsAnimationContext';

export interface SettingsPageProps {
    /** Page title */
    title: string;
    /** Page description */
    description: string;
    /** Page sections */
    children: React.ReactNode;
    /** Optional action element in header (button, dropdown, etc.) */
    headerAction?: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animations */
    noAnimation?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
    title,
    description,
    children,
    headerAction,
    className = '',
    noAnimation = false,
}) => {
    // Use context to determine if we should skip animation (keep-alive reveal)
    const { hasRendered, markRendered } = useSettingsAnimation();
    const categoryKey = `page-${title.toLowerCase().replace(/\s+/g, '-')}`;
    const isFirstRender = React.useRef(!hasRendered(categoryKey));

    React.useEffect(() => {
        markRendered(categoryKey);
    }, [categoryKey, markRendered]);

    // Skip animation if explicitly disabled OR if this is a keep-alive reveal
    const shouldSkipAnimation = noAnimation || !isFirstRender.current;

    const Container = shouldSkipAnimation ? 'div' : motion.div;
    const containerProps = shouldSkipAnimation ? {} : {
        variants: settingsPageContainer,
        initial: 'hidden',
        animate: 'visible',
    };

    return (
        <Container
            className={`space-y-6 ${className}`}
            {...containerProps}
        >
            {/* Page Header */}
            <div className="pl-4 md:pl-2 flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-theme-primary mb-1">{title}</h3>
                    <p className="text-theme-secondary text-sm">{description}</p>
                </div>
                {headerAction && (
                    <div className="flex-shrink-0">
                        {headerAction}
                    </div>
                )}
            </div>

            {/* Sections */}
            {children}
        </Container>
    );
};
