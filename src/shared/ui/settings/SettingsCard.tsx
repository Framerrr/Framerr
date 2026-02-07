/**
 * SettingsCard
 * 
 * Level 4 expandable card for complex settings.
 * Provides collapsible container with header and animated content.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { expandCollapse, settingsItem } from '../animations';

export interface SettingsCardProps {
    /** Card title */
    title: string;
    /** Optional description */
    description?: string;
    /** Optional icon */
    icon?: LucideIcon;
    /** Whether card is expanded */
    expanded?: boolean;
    /** Callback when expand/collapse is toggled */
    onToggleExpand?: () => void;
    /** Content for right side of header (toggle, badge, etc.) */
    headerRight?: React.ReactNode;
    /** Card content (shown when expanded) */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Disable animation */
    noAnimation?: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
    title,
    description,
    icon: Icon,
    expanded = false,
    onToggleExpand,
    headerRight,
    children,
    className = '',
    noAnimation = false,
}) => {
    const Container = noAnimation ? 'div' : motion.div;
    const containerProps = noAnimation ? {} : { variants: settingsItem };

    return (
        <Container
            className={`bg-theme-tertiary rounded-lg overflow-hidden border border-theme shadow-sm ${className}`}
            {...containerProps}
        >
            {/* Header - Clickable */}
            <button
                onClick={onToggleExpand}
                className="w-full p-4 flex items-center justify-between hover:bg-theme-hover/30 transition-colors"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    {Icon && <Icon size={20} className="text-theme-secondary flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-theme-primary">{title}</h4>
                        {description && (
                            <p className="text-sm text-theme-secondary truncate">{description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {headerRight && (
                        <div onClick={(e) => e.stopPropagation()}>
                            {headerRight}
                        </div>
                    )}
                    <ChevronDown
                        size={20}
                        className={`text-theme-secondary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {/* Expandable Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        variants={expandCollapse}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <div className="px-4 pb-4 border-t border-theme pt-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};
