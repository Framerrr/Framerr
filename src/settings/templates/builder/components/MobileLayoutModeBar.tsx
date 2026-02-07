/**
 * MobileLayoutModeBar - Second toolbar row with view mode and mobile layout controls
 * 
 * Contains: Desktop/Mobile toggle, layout mode status, and customize/auto-layout toggle.
 * Moved Desktop/Mobile toggle here to give row 1 more space for integration dropdowns.
 */

import React from 'react';
import { Link, Unlink, ToggleLeft, ToggleRight } from 'lucide-react';
import { ViewModeToggle } from '../../../../shared/ui';
import type { ViewMode } from '../types';

export type MobileLayoutMode = 'linked' | 'independent';

interface MobileLayoutModeBarProps {
    /** Current view mode (desktop/mobile) */
    viewMode: ViewMode;
    /** Callback to change view mode */
    onViewModeChange: (mode: ViewMode) => void;
    /** Current mobile layout mode */
    mobileLayoutMode: MobileLayoutMode;
    /** Callback to toggle mode - when undefined, toggle button is hidden (preview mode) */
    onToggle?: () => void;
}

export const MobileLayoutModeBar: React.FC<MobileLayoutModeBarProps> = ({
    viewMode,
    onViewModeChange,
    mobileLayoutMode,
    onToggle,
}) => {
    const isLinked = mobileLayoutMode === 'linked';

    return (
        <div className="flex-shrink-0 h-12 px-4 border-b border-theme bg-theme-secondary flex items-center justify-between gap-4">
            {/* Left: View mode toggle + status text */}
            <div className="flex items-center gap-4">
                {/* Desktop/Mobile Toggle */}
                <ViewModeToggle
                    viewMode={viewMode}
                    onViewModeChange={onViewModeChange}
                />

                {/* Divider */}
                <div className="h-6 w-px bg-theme" />

                {/* Layout mode status */}
                <div className="flex items-center gap-2 text-sm">
                    {isLinked ? (
                        <Link size={14} className="text-info" />
                    ) : (
                        <Unlink size={14} className="text-warning" />
                    )}
                    <span className="text-theme-secondary">
                        {isLinked
                            ? 'Mobile layout auto-generated from desktop'
                            : 'Mobile layout customized independently'}
                    </span>
                </div>
            </div>

            {/* Right: Toggle button - hidden in preview mode */}
            {onToggle && (
                <button
                    onClick={onToggle}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${!isLinked
                        ? 'bg-warning/20 text-warning hover:bg-warning/30'
                        : 'bg-info/20 text-info hover:bg-info/30'
                        }`}
                >
                    {isLinked ? (
                        <>
                            <ToggleLeft size={14} />
                            Customize Mobile
                        </>
                    ) : (
                        <>
                            <ToggleRight size={14} />
                            Use Auto Layout
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default MobileLayoutModeBar;
