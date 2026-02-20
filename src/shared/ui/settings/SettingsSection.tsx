/**
 * SettingsSection
 * 
 * Level 3 container for grouping related settings.
 * Provides glassy container with standardized header pattern and animations.
 * 
 * Animation respects keep-alive: only animates on first render,
 * not when page is revealed after returning from Dashboard.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { settingsSection } from '../animations';
import { useSettingsAnimation } from '../../../context/SettingsAnimationContext';

export interface SettingsSectionProps {
    /** Section title displayed in header */
    title: string;
    /** Optional icon displayed before title */
    icon?: LucideIcon;
    /** Optional description below title */
    description?: string;
    /** Content to display on the right side of header (toggle, button, etc.) */
    headerRight?: React.ReactNode;
    /** Section content (Level 4 items) */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animation */
    noAnimation?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    icon: Icon,
    description,
    headerRight,
    children,
    className = '',
    noAnimation = false,
}) => {
    // Use context to determine if we should skip animation (keep-alive reveal)
    const { hasRendered, markRendered } = useSettingsAnimation();
    const sectionKey = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
    const isFirstRender = React.useRef(!hasRendered(sectionKey));

    React.useEffect(() => {
        markRendered(sectionKey);
    }, [sectionKey, markRendered]);

    // Skip animation if explicitly disabled OR if this is a keep-alive reveal
    const shouldSkipAnimation = noAnimation || !isFirstRender.current;

    const Container = shouldSkipAnimation ? 'div' : motion.div;
    // Add initial/animate props so section animates even when parent is not motion
    const containerProps = shouldSkipAnimation ? {} : {
        variants: settingsSection,
        initial: 'hidden',
        animate: 'visible',
    };

    return (
        <Container
            className={`glass-subtle rounded-xl p-6 border border-theme-light ${className}`}
            {...containerProps}
        >
            {/* Header */}
            <div className={`flex items-center justify-between ${description ? 'mb-2' : 'mb-4'}`}>
                <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                    {Icon && <Icon size={20} />}
                    {title}
                </h3>
                {headerRight && (
                    <div className="flex items-center gap-3">
                        {headerRight}
                    </div>
                )}
            </div>

            {/* Description */}
            {description && (
                <p className="text-sm text-theme-secondary mb-6">
                    {description}
                </p>
            )}

            {/* Content */}
            <div className="space-y-4">
                {children}
            </div>
        </Container>
    );
};
