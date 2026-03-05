import React from 'react';
import { Plus, LayoutGrid } from 'lucide-react';

/**
 * DashboardEmptyState - Overlay shown when the dashboard has no widgets.
 * 
 * Extracted from Dashboard.tsx to isolate presentational empty-state UI.
 */

interface DashboardEmptyStateProps {
    onAddWidget: () => void;
}

const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({ onAddWidget }) => {
    return (
        <div className="empty-dashboard-overlay absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Card - visual only, no pointer events */}
            <div className="glass-card rounded-2xl p-10 max-w-xl w-full border border-theme text-center space-y-5">
                <div className="flex justify-center mb-2">
                    <div className="relative">
                        <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full"></div>
                        <LayoutGrid
                            size={64}
                            className="relative text-accent"
                            strokeWidth={1.5}
                        />
                    </div>
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-theme-primary">
                        Your Dashboard is Empty
                    </h2>
                    <p className="text-theme-secondary">
                        Add your first widget to get started.
                    </p>
                </div>
                {/* Placeholder space for button - actual button is positioned separately */}
                <div className="pt-2">
                    <div className="inline-flex items-center gap-2 px-6 py-3 opacity-0">
                        <Plus size={18} />
                        Add Widget
                    </div>
                </div>
                <p className="text-xs text-theme-tertiary pt-2">
                    💡 Widgets can display your media, downloads, system stats, and more.
                </p>
            </div>

            {/* Button - separate element, positioned to appear on card */}
            {/* Uses pointer-events-auto so it's clickable */}
            <button
                onClick={onAddWidget}
                className="absolute inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-theme-primary font-medium rounded-lg transition-colors pointer-events-auto z-30 whitespace-nowrap"
                style={{
                    // Position to center horizontally, offset vertically to match card button position
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 45px)', // Adjust Y to match button position on card
                }}
            >
                <Plus size={18} />
                Add Widget
            </button>
        </div>
    );
};

export default DashboardEmptyState;
