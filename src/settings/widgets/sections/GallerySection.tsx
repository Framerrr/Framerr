/**
 * GallerySection (Widget Gallery)
 * 
 * Thin orchestrator that composes the widget gallery UI.
 * Delegates state management to useWidgetGallery hook
 * and widget rendering to shared WidgetCard component.
 */

import React, { ChangeEvent } from 'react';
import { Search, Share2 } from 'lucide-react';
import { useWidgetGallery } from '../hooks/useWidgetGallery';
import { WidgetCard } from '../../../shared/widgets';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { Select } from '../../../shared/ui';
import WidgetShareModal from '../../../components/modals/WidgetShareModal';
import { useSettingsAnimationClass } from '../../../context/SettingsAnimationContext';

/**
 * Widget Gallery - Browse and add widgets to dashboard
 * For admins: Shows all widgets, integration status
 * For users: Shows utility widgets + widgets shared by admin
 */
const GallerySection: React.FC = () => {
    const {
        loading,
        searchTerm,
        setSearchTerm,
        selectedCategory,
        setSelectedCategory,
        addingWidget,
        categories,
        filteredWidgets,
        totalVisibleWidgets,
        hasAdminAccess,
        integrations,
        sharedIntegrations,
        shareModalOpen,
        setShareModalOpen,
        shareWidget,
        setShareWidget,
        shareLoading,
        groups,
        ungroupedUsers,
        shareIntegrations,
        initialUserShares,
        handleAddWidget,
        handleShareWidget,
        handleSaveShares,
        getSharedByInfo,
        isIntegrationReady
    } = useWidgetGallery();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading widgets..." />
            </div>
        );
    }

    // Empty state for non-admin users with no shared widgets
    if (!hasAdminAccess && totalVisibleWidgets === 0 && !searchTerm) {
        return (
            <div className="text-center py-16">
                <div className="w-16 h-16 bg-theme-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Share2 size={32} className="text-theme-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-theme-primary mb-2">No Widgets Available</h3>
                <p className="text-theme-secondary max-w-md mx-auto">
                    No widgets have been shared with you yet. Contact your administrator to get access
                    to integration widgets like Plex, Sonarr, or System Status.
                </p>
            </div>
        );
    }

    // Animation class - only animates on first render
    const animClass = useSettingsAnimationClass('widget-gallery');

    return (
        <>
            <div className={`space-y-6 ${animClass}`}>
                {/* Page Header */}
                <div className="pl-4 md:pl-2">
                    <h3 className="text-xl font-bold text-theme-primary mb-1">Widget Gallery</h3>
                    <p className="text-theme-secondary text-sm">
                        Browse and add widgets to your dashboard
                    </p>
                </div>

                {/* Widgets Section */}
                <div className="glass-subtle rounded-xl p-6 border border-theme">
                    {/* Filters */}
                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-tertiary" size={18} />
                            <input
                                type="text"
                                placeholder="Search widgets..."
                                value={searchTerm}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent"
                            />
                        </div>

                        {/* Category Filter */}
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <Select.Trigger className="w-[180px]">
                                <Select.Value placeholder="All Categories" />
                            </Select.Trigger>
                            <Select.Content>
                                {categories.map(cat => (
                                    <Select.Item key={cat} value={cat}>
                                        {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>

                    {/* Widget Grid */}
                    {Object.keys(filteredWidgets).length === 0 ? (
                        <div className="text-center py-16 text-theme-secondary">
                            <p>No widgets found matching your search.</p>
                        </div>
                    ) : (
                        Object.entries(filteredWidgets).map(([category, widgets]) => (
                            <div key={category} className="mb-8">
                                <h3 className="text-lg font-semibold text-theme-primary mb-4 capitalize flex items-center gap-2">
                                    {category}
                                    <span className="text-sm text-theme-secondary font-normal">({widgets.length})</span>
                                </h3>

                                <div className="grid grid-cols-1 min-[1000px]:grid-cols-2 min-[1280px]:grid-cols-3 gap-4">
                                    {widgets.map(widget => (
                                        <WidgetCard
                                            key={widget.type}
                                            widget={widget}
                                            variant="gallery"
                                            isAdding={addingWidget === widget.type}
                                            hasAdminAccess={hasAdminAccess}
                                            shareLoading={shareLoading}
                                            integrations={integrations}
                                            onAdd={handleAddWidget}
                                            onShare={handleShareWidget}
                                            sharedBy={getSharedByInfo(widget)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Share Modal */}
            {shareWidget && (
                <WidgetShareModal
                    isOpen={shareModalOpen}
                    onClose={() => { setShareModalOpen(false); setShareWidget(null); }}
                    widgetType={shareWidget.type!}
                    widgetName={shareWidget.name}
                    compatibleIntegrations={shareIntegrations}
                    groups={groups}
                    ungroupedUsers={ungroupedUsers}
                    initialUserShares={initialUserShares}
                    onSave={handleSaveShares}
                />
            )}
        </>
    );
};

export default GallerySection;
