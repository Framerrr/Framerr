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
    /** Disable desktop/mobile toggle while a switch is settling (iOS crash guard) */
    viewSwitchDisabled?: boolean;
}

export const MobileLayoutModeBar: React.FC<MobileLayoutModeBarProps> = ({
    viewMode,
    onViewModeChange,
    mobileLayoutMode,
    onToggle,
    viewSwitchDisabled = false,
}) => {
    const isLinked = mobileLayoutMode === 'linked';

    return (
        <div className="@container flex-shrink-0 min-h-12 px-4 py-1 border-b border-theme bg-theme-secondary flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: View mode toggle + status text */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                {/* Desktop/Mobile Toggle (SlidingTabBar via ViewModeToggle) */}
                <ViewModeToggle
                    viewMode={viewMode}
                    onViewModeChange={onViewModeChange}
                    disabled={viewSwitchDisabled}
                />

                {/* Divider */}
                <div className="h-6 w-px bg-theme flex-shrink-0" />

                {/* Layout mode status — shortens by container width (not viewport) */}
                <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                    {isLinked ? (
                        <Link size={14} className="text-info flex-shrink-0" />
                    ) : (
                        <Unlink size={14} className="text-warning flex-shrink-0" />
                    )}
                    <span className="text-theme-secondary truncate">
                        {isLinked ? (
                            <>
                                <span className="@[520px]:hidden">Auto-generated</span>
                                <span className="hidden @[520px]:inline @[720px]:hidden">Auto from desktop</span>
                                <span className="hidden @[720px]:inline">Mobile layout auto-generated from desktop</span>
                            </>
                        ) : (
                            <>
                                <span className="@[520px]:hidden">Independent</span>
                                <span className="hidden @[520px]:inline @[720px]:hidden">Customized independently</span>
                                <span className="hidden @[720px]:inline">Mobile layout customized independently</span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Right: Toggle button - hidden in preview mode */}
            {onToggle && (
                <button
                    onClick={onToggle}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${!isLinked
                        ? 'bg-warning/20 text-warning hover:bg-warning/30'
                        : 'bg-info/20 text-info hover:bg-info/30'
                        }`}
                >
                    {isLinked ? (
                        <>
                            <ToggleLeft size={14} />
                            <span className="@[520px]:hidden">Customize</span>
                            <span className="hidden @[520px]:inline">Customize Mobile</span>
                        </>
                    ) : (
                        <>
                            <ToggleRight size={14} />
                            <span className="@[520px]:hidden">Auto</span>
                            <span className="hidden @[520px]:inline">Use Auto Layout</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default MobileLayoutModeBar;
