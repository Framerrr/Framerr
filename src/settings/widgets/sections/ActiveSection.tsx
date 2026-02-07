import React from 'react';
import { Info, Monitor, Smartphone } from 'lucide-react';
import { useActiveWidgets } from '../hooks/useActiveWidgets';
import { WidgetCard } from '../components/WidgetCard';
import { useSettingsAnimationClass } from '../../../context/SettingsAnimationContext';

/**
 * Active Widgets Section
 * 
 * Thin orchestrator that composes the active widgets UI.
 * Delegates state management to useActiveWidgets hook
 * and widget rendering to WidgetCard component.
 */
const ActiveSection: React.FC = () => {
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
        resizeWidget
    } = useActiveWidgets();

    if (loading) {
        return <div className="text-center py-16 text-theme-secondary">Loading widgets...</div>;
    }

    if (displayWidgets.length === 0) {
        return (
            <div className="text-center py-16">
                <Info size={48} className="mx-auto mb-4 text-theme-tertiary" />
                <p className="text-lg text-theme-secondary mb-2">
                    {viewMode === 'mobile' && mobileLayoutMode === 'independent'
                        ? 'No widgets on your mobile dashboard'
                        : 'No widgets on your dashboard yet'}
                </p>
                <p className="text-sm text-theme-tertiary">Go to Widget Gallery to add some!</p>
            </div>
        );
    }

    // Animation class - only animates on first render
    const animClass = useSettingsAnimationClass('active-widgets');

    return (
        <div className={`space-y-6 ${animClass}`}>
            {/* Page Header */}
            <div className="pl-4 md:pl-2">
                <h3 className="text-xl font-bold text-theme-primary mb-1">Active Widgets</h3>
                <p className="text-theme-secondary text-sm">
                    Manage and customize your dashboard widgets
                </p>
            </div>

            {/* Widgets Section */}
            <div className="glass-subtle rounded-xl shadow-medium p-6 border border-theme">
                {/* Desktop/Mobile Toggle - only shown in independent mode */}
                {showViewToggle && (
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-theme-primary rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'desktop'
                                    ? 'bg-accent text-white'
                                    : 'text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                <Monitor size={14} />
                                Desktop
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'mobile'
                                    ? 'bg-accent text-white'
                                    : 'text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                <Smartphone size={14} />
                                Mobile
                            </button>
                        </div>
                        <div className="text-xs text-theme-tertiary">
                            Editing {viewMode} widgets
                        </div>
                    </div>
                )}

                {/* Stats - Inline on mobile */}
                <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="glass-subtle shadow-medium rounded-xl p-3 sm:p-4 border border-theme text-center">
                        <div className="text-xl sm:text-2xl font-bold text-theme-primary">{stats.total}</div>
                        <div className="text-xs sm:text-sm text-theme-secondary">Total</div>
                    </div>
                    <div className="glass-subtle shadow-medium rounded-xl p-3 sm:p-4 border border-theme text-center">
                        <div className="text-xl sm:text-2xl font-bold text-theme-primary">{Object.keys(stats.byType).length}</div>
                        <div className="text-xs sm:text-sm text-theme-secondary">Types</div>
                    </div>
                    <div className="glass-subtle shadow-medium rounded-xl p-3 sm:p-4 border border-theme text-center">
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
                            onResize={resizeWidget}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ActiveSection;
