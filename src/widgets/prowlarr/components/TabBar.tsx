/**
 * TabBar — Tautulli-style full-width tabs with sliding accent highlight.
 * Responsive via container queries: text-only → icon+short → icon-only.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface TabBarItem {
    id: string;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
}

interface TabBarProps {
    tabs: TabBarItem[];
    activeId: string;
    onChange: (id: string) => void;
    'aria-label'?: string;
}

const indicatorSpring = {
    type: 'spring' as const,
    stiffness: 500,
    damping: 35,
};

const HOVER_LEAVE_DELAY_MS = 400;

const TabBar = ({ tabs, activeId, onChange, 'aria-label': ariaLabel }: TabBarProps): React.JSX.Element => {
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
            className="prwl-tabs"
            role="tablist"
            aria-label={ariaLabel}
            onMouseLeave={handleLeave}
        >
            {tabs.map((tab) => {
                const isSelected = activeId === tab.id;
                const isHovered = hoveredId === tab.id;
                const showIndicator = isHovered || (!hoveredId && isSelected);
                const indicatorClass = isHovered
                    ? 'bg-slate-800/60'
                    : 'bg-accent/20 shadow-lg';
                const Icon = tab.icon;
                const labelClass = isSelected ? 'text-accent' : 'text-theme-secondary';

                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-label={tab.label}
                        title={tab.label}
                        className="prwl-tab"
                        onClick={() => onChange(tab.id)}
                        onMouseEnter={() => handleEnter(tab.id)}
                    >
                        {showIndicator && (
                            <motion.div
                                layoutId={`prwl-tab-indicator-${layoutId}`}
                                className={`absolute inset-y-1 inset-x-1.5 rounded-xl pointer-events-none ${indicatorClass}`}
                                initial={false}
                                transition={indicatorSpring}
                                style={{ zIndex: 0 }}
                            />
                        )}
                        <span className={`relative z-10 prwl-tab-inner ${labelClass}`}>
                            <Icon className="prwl-tab-icon" aria-hidden />
                            <span className="prwl-tab-label prwl-tab-label--full">{tab.label}</span>
                            <span className="prwl-tab-label prwl-tab-label--short">{tab.shortLabel}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default TabBar;
