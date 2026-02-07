/**
 * ViewModeToggle - Shared desktop/mobile toggle component
 * 
 * Reusable toggle button group for switching between desktop and mobile view modes.
 * Used by TemplateBuilderStep2, TemplateBuilderStep3, TemplatePreviewModal,
 * ActiveSection, and ActiveWidgetsPage.
 */

import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export type ViewMode = 'desktop' | 'mobile';

interface ViewModeToggleProps {
    /** Current view mode */
    viewMode: ViewMode;
    /** Callback when view mode changes */
    onViewModeChange: (mode: ViewMode) => void;
    /** Show labels (Desktop/Mobile) next to icons */
    showLabels?: boolean;
    /** Additional class name for the container */
    className?: string;
    /** Suffix text after the toggle (e.g., "widgets") */
    suffix?: string;
}

/**
 * Toggle button group for switching between desktop and mobile views.
 */
export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
    viewMode,
    onViewModeChange,
    showLabels = true,
    className = '',
    suffix,
}) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex items-center gap-1 bg-theme-primary rounded-lg p-1">
                <button
                    onClick={() => onViewModeChange('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'desktop'
                            ? 'bg-accent text-white'
                            : 'text-theme-secondary hover:text-theme-primary'
                        }`}
                >
                    <Monitor size={14} />
                    {showLabels && 'Desktop'}
                </button>
                <button
                    onClick={() => onViewModeChange('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'mobile'
                            ? 'bg-accent text-white'
                            : 'text-theme-secondary hover:text-theme-primary'
                        }`}
                >
                    <Smartphone size={14} />
                    {showLabels && 'Mobile'}
                </button>
            </div>
            {suffix && (
                <span className="text-xs text-theme-tertiary">
                    Editing {viewMode} {suffix}
                </span>
            )}
        </div>
    );
};

export default ViewModeToggle;
