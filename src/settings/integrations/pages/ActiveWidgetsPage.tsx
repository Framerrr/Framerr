/**
 * ActiveWidgetsPage
 * 
 * Manage and customize widgets on your dashboard.
 * Shows stats, desktop/mobile toggle, and widget list.
 */

import React from 'react';
import { Info, Layers } from 'lucide-react';
import { useActiveWidgets } from '../../widgets/hooks/useActiveWidgets';
import { WidgetCard } from '../../widgets/components/WidgetCard';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';
import { ViewModeToggle } from '../../../shared/ui';

export const ActiveWidgetsPage: React.FC = () => {
    const {
        displayWidgets,
        viewMode,
        setViewMode,
        loading,
        removingWidget,
        confirmRemoveId,
        setConfirmRemoveId,
        stats,
        showViewToggle,
        mobileLayoutMode,
        handleRemove,
        handleIconSelect,
        updateWidgetConfig,
        schemas,
        integrations,
    } = useActiveWidgets();

    if (loading) {
        return <div className="text-center py-16 text-theme-secondary">Loading widgets...</div>;
    }

    if (displayWidgets.length === 0) {
        return (
            <SettingsPage
                title="Active Widgets"
                description="Manage and customize your dashboard widgets"
            >
                <EmptyState
                    icon={Info}
                    message={
                        viewMode === 'mobile' && mobileLayoutMode === 'independent'
                            ? 'No widgets on your mobile dashboard. Go to Widget Gallery to add some!'
                            : 'No widgets on your dashboard yet. Go to Widget Gallery to add some!'
                    }
                />
            </SettingsPage>
        );
    }

    return (
        <SettingsPage
            title="Active Widgets"
            description="Manage and customize your dashboard widgets"
        >
            <SettingsSection title="Your Widgets" icon={Layers}>
                {/* Desktop/Mobile — ViewModeToggle → SlidingTabBar (trial; easy to revert) */}
                {showViewToggle && (
                    <ViewModeToggle
                        className="mb-6"
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        suffix="widgets"
                    />
                )}

                {/* Stats - Inline on mobile */}
                <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="bg-theme-tertiary rounded-xl p-3 sm:p-4 border border-theme text-center">
                        <div className="text-xl sm:text-2xl font-bold text-theme-primary">{stats.total}</div>
                        <div className="text-xs sm:text-sm text-theme-secondary">Total</div>
                    </div>
                    <div className="bg-theme-tertiary rounded-xl p-3 sm:p-4 border border-theme text-center">
                        <div className="text-xl sm:text-2xl font-bold text-theme-primary">{Object.keys(stats.byType).length}</div>
                        <div className="text-xs sm:text-sm text-theme-secondary">Types</div>
                    </div>
                    <div className="bg-theme-tertiary rounded-xl p-3 sm:p-4 border border-theme text-center">
                        <div className="text-xl sm:text-2xl font-bold text-theme-primary">
                            {displayWidgets.length > 0
                                ? `${Math.round(displayWidgets.reduce((sum, w) => sum + (w.layout.w ?? 1), 0) / stats.total)}×${Math.round(displayWidgets.reduce((sum, w) => sum + (w.layout.h ?? 1), 0) / stats.total)}`
                                : '0×0'}
                        </div>
                        <div className="text-xs sm:text-sm text-theme-secondary">Avg Size</div>
                    </div>
                </div>

                {/* Widget List */}
                <div className="space-y-3 sm:space-y-4">
                    {displayWidgets.map(widget => (
                        <WidgetCard
                            key={widget.id}
                            widget={widget}
                            isRemoving={removingWidget === widget.id}
                            isConfirmingRemove={confirmRemoveId === widget.id}
                            onRemove={handleRemove}
                            onConfirmRemove={setConfirmRemoveId}
                            onIconSelect={handleIconSelect}
                            onUpdateConfig={updateWidgetConfig}
                            schemas={schemas}
                            integrations={integrations}
                        />
                    ))}
                </div>
            </SettingsSection>
        </SettingsPage>
    );
};

export default ActiveWidgetsPage;
