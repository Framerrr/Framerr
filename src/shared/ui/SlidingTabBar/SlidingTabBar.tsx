/**
 * SlidingTabBar — full-width equal tabs with a unified sliding selection indicator.
 *
 * Same indicator for hover and selected (sidebar Highlight-style), with a calmer spring.
 * Adaptive labels via container queries on the parent (needs `container-type: inline-size`):
 * - Wide: full labels
 * - Mid: icon + short labels
 * - Narrow: icon-only
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import './styles.css';

export interface SlidingTabBarItem {
    id: string;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
}

export interface SlidingTabBarProps {
    tabs: SlidingTabBarItem[];
    activeId: string;
    onChange: (id: string) => void;
    'aria-label'?: string;
}

/** Calmer than the old 500/35 tab spring — less bounce, still snappy */
const indicatorTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 38,
};

const HOVER_LEAVE_DELAY_MS = 400;

/** Unified selection indicator — hover and selected share one look */
const INDICATOR_CLASS =
    'absolute inset-y-1 inset-x-1.5 rounded-xl pointer-events-none bg-accent/20 shadow-lg';

export function SlidingTabBar({
    tabs,
    activeId,
    onChange,
    'aria-label': ariaLabel,
}: SlidingTabBarProps): React.JSX.Element {
    const layoutId = useId();
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLeaveTimeout = () => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    };

    useEffect(() => () => clearLeaveTimeout(), []);

    const handleEnter = (id: string) => {
        clearLeaveTimeout();
        setHoveredId(id);
    };

    const handleLeave = () => {
        clearLeaveTimeout();
        leaveTimeoutRef.current = setTimeout(() => {
            setHoveredId(null);
            leaveTimeoutRef.current = null;
        }, HOVER_LEAVE_DELAY_MS);
    };

    return (
        <div
            className="sliding-tab-bar"
            role="tablist"
            aria-label={ariaLabel}
            onMouseLeave={handleLeave}
        >
            {tabs.map((tab) => {
                const isSelected = activeId === tab.id;
                const isHovered = hoveredId === tab.id;
                // One indicator item: follows hover when present, else selected
                const showIndicator = isHovered || (!hoveredId && isSelected);
                const Icon = tab.icon;
                const labelClass = isSelected ? 'text-theme-primary' : 'text-theme-secondary';

                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-label={tab.label}
                        title={tab.label}
                        className="sliding-tab-bar__tab"
                        onClick={() => onChange(tab.id)}
                        onMouseEnter={() => handleEnter(tab.id)}
                    >
                        {showIndicator && (
                            <motion.div
                                layoutId={`sliding-tab-bar-indicator-${layoutId}`}
                                className={INDICATOR_CLASS}
                                initial={false}
                                transition={indicatorTransition}
                                style={{ zIndex: 0 }}
                            />
                        )}
                        <span className={`relative z-10 sliding-tab-bar__inner ${labelClass}`}>
                            <Icon className="sliding-tab-bar__icon" aria-hidden />
                            <span className="sliding-tab-bar__label sliding-tab-bar__label--full">
                                {tab.label}
                            </span>
                            <span className="sliding-tab-bar__label sliding-tab-bar__label--short">
                                {tab.shortLabel}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default SlidingTabBar;
