/**
 * ViewModeToggle - Shared desktop/mobile toggle
 *
 * Uses SlidingTabBar (same control as Tautulli/DNS/Prowlarr) with a left-hugging
 * max width so labels adapt via container queries as space shrinks.
 *
 * Width uses a definite flex-basis (not % of a shrink-wrapped parent) so toolbar
 * layouts don't collapse the bar to zero.
 *
 * Used by TemplateBuilder (incl. preview), TemplateBuilderStep3, ActiveWidgetsPage.
 */

import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { SlidingTabBar, type SlidingTabBarItem } from '../SlidingTabBar';

export type ViewMode = 'desktop' | 'mobile';

interface ViewModeToggleProps {
    /** Current view mode */
    viewMode: ViewMode;
    /** Callback when view mode changes */
    onViewModeChange: (mode: ViewMode) => void;
    /** @deprecated Adaptive labels come from SlidingTabBar container queries */
    showLabels?: boolean;
    /** Additional class name for the container */
    className?: string;
    /** Suffix text after the toggle (e.g., "widgets" → "Editing desktop widgets") */
    suffix?: string;
    /** Disable both buttons (e.g. while a view switch is settling) */
    disabled?: boolean;
}

const VIEW_TABS: SlidingTabBarItem[] = [
    { id: 'desktop', label: 'Desktop', shortLabel: 'Desktop', icon: Monitor },
    { id: 'mobile', label: 'Mobile', shortLabel: 'Mobile', icon: Smartphone },
];

/**
 * Toggle for switching between desktop and mobile views.
 */
export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
    viewMode,
    onViewModeChange,
    className = '',
    suffix,
    disabled = false,
}) => {
    return (
        <div
            className={`flex flex-col gap-2 min-w-0 w-80 max-w-full shrink ${disabled ? 'opacity-60 pointer-events-none' : ''} ${className}`}
            style={{ containerType: 'inline-size' }}
            aria-disabled={disabled || undefined}
        >
            <SlidingTabBar
                tabs={VIEW_TABS}
                activeId={viewMode}
                onChange={(id) => {
                    if (disabled) return;
                    onViewModeChange(id as ViewMode);
                }}
                aria-label="Desktop or mobile view"
            />
            {suffix && (
                <span className="text-xs text-theme-tertiary">
                    Editing {viewMode} {suffix}
                </span>
            )}
        </div>
    );
};

export default ViewModeToggle;
