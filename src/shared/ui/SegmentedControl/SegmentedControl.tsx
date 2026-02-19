/**
 * SegmentedControl
 *
 * Compact inline tab switcher with a sliding pill indicator.
 * Uses Framer Motion `layoutId` for buttery smooth transitions.
 *
 * Features:
 * - Animated sliding pill (accent-colored background slides between options)
 * - Three sizes: xs (widget-compact), sm (widget), md (settings)
 * - Optional icons alongside labels
 * - Full theme compliance, no hardcoded colors
 * - Accessible: uses button role with aria-pressed
 *
 * @example
 * <SegmentedControl
 *   options={[
 *     { value: 'movies', label: 'Top Movies' },
 *     { value: 'tv', label: 'Top TV' },
 *     { value: 'users', label: 'Top Users' },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 *   size="sm"
 * />
 *
 * @example With icons
 * <SegmentedControl
 *   options={[
 *     { value: 'grid', label: 'Grid', icon: Grid },
 *     { value: 'list', label: 'List', icon: List },
 *   ]}
 *   value={viewMode}
 *   onChange={setViewMode}
 * />
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface SegmentOption {
    /** Unique value for this option */
    value: string;
    /** Display label */
    label: string;
    /** Short label for narrow containers (shown via CSS container query) */
    shortLabel?: string;
    /** Optional Lucide icon component */
    icon?: LucideIcon;
}

export type SegmentedControlSize = 'xs' | 'sm' | 'md';

export interface SegmentedControlProps {
    /** Array of options to display */
    options: SegmentOption[];
    /** Currently selected value */
    value: string;
    /** Called when selection changes */
    onChange: (value: string) => void;
    /** Size variant */
    size?: SegmentedControlSize;
    /** Whether the control fills its container */
    fullWidth?: boolean;
    /** Additional CSS class for the container */
    className?: string;
    /** Unique ID prefix for layoutId (needed if multiple controls animate simultaneously) */
    id?: string;
}

// ============================================================================
// SIZE CONFIGURATION
// ============================================================================

const sizeConfig = {
    xs: {
        container: 'p-0.5 gap-0.5 rounded-full',
        button: 'px-2.5 py-0.5 rounded-full text-[0.65rem]',
        pill: 'rounded-full',
        iconSize: 10,
    },
    sm: {
        container: 'p-[3px] gap-0.5 rounded-full',
        button: 'px-3.5 py-1.5 rounded-full text-[0.8rem]',
        pill: 'rounded-full',
        iconSize: 13,
    },
    md: {
        container: 'p-1 gap-0.5 rounded-full',
        button: 'px-4 py-1.5 rounded-full text-sm',
        pill: 'rounded-full',
        iconSize: 14,
    },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
    options,
    value,
    onChange,
    size = 'sm',
    fullWidth = false,
    className = '',
    id,
}) => {
    // Generate unique layoutId so multiple SegmentedControls don't interfere
    const autoId = useId();
    const layoutId = `segmented-pill-${id || autoId}`;
    const config = sizeConfig[size];

    return (
        <div
            className={`
                segmented-control
                inline-flex items-center
                ${config.container}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            role="radiogroup"
        >
            {options.map((option) => {
                const isActive = value === option.value;
                const Icon = option.icon;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(option.value)}
                        className={`
                            segmented-control-button
                            relative z-10
                            ${config.button}
                            font-medium
                            transition-colors duration-150
                            ${fullWidth ? 'flex-1' : ''}
                            ${isActive
                                ? 'text-white'
                                : 'text-theme-secondary hover:text-theme-primary'
                            }
                        `}
                    >
                        {/* Sliding pill indicator */}
                        {isActive && (
                            <motion.div
                                layoutId={layoutId}
                                className={`
                                    segmented-control-pill
                                    absolute inset-0
                                    ${config.pill}
                                `}
                                transition={{
                                    type: 'spring',
                                    stiffness: 400,
                                    damping: 30,
                                }}
                            />
                        )}

                        {/* Content */}
                        <span className="relative z-10 flex items-center justify-center gap-1 whitespace-nowrap">
                            {Icon && <Icon size={config.iconSize} />}
                            {option.shortLabel ? (
                                <>
                                    <span className="segmented-label-long">{option.label}</span>
                                    <span className="segmented-label-short">{option.shortLabel}</span>
                                </>
                            ) : (
                                option.label
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

SegmentedControl.displayName = 'SegmentedControl';

export default SegmentedControl;
