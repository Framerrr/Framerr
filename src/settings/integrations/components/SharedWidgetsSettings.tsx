/**
 * SharedWidgetsSettings - Admin widget sharing management page
 * 
 * Shows ONLY widgets that:
 * 1. Are shareable (have compatible integrations and not isGlobal)
 * 2. Have active shares (userCount > 0 OR groupCount > 0 OR hasEveryoneShare)
 * 
 * Features:
 * - Global "Revoke All" button for clearing all shares
 * - Category-based grouping matching Widget Gallery order
 * - Per-widget management via WidgetShareCard
 */

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Search, Share2, Loader2 } from 'lucide-react';
import { Select, ConfirmButton } from '../../../shared/ui';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';
import { useAllWidgetShares, useUsersAndGroups, useRevokeAllShares } from '../../../api/hooks/useWidgetQueries';
import { useIntegrations } from '../../../api/hooks/useIntegrations';
import { getShareableWidgets, getWidgetsByCategory } from '../../../widgets/registry';
import { useNotifications } from '../../../context/NotificationContext';
import WidgetShareCard from './WidgetShareCard';

// Types
interface Integration {
    id: string;
    name: string;
    type: string;
}

// Category display order (matches Widget Gallery)
const CATEGORY_ORDER = ['system', 'media', 'downloads', 'utility', 'other'];

const SharedWidgetsSettings: React.FC = () => {
    // React Query hooks for data
    const { data: usersAndGroups, isLoading: loadingUsers } = useUsersAndGroups();
    const { data: allSharesData, isLoading: loadingShares } = useAllWidgetShares();
    const { data: integrationsData, isLoading: loadingIntegrations } = useIntegrations();
    const revokeAllMutation = useRevokeAllShares();
    const { success: showSuccess, error: showError } = useNotifications();

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Transform integrations to simple format
    const integrations: Integration[] = useMemo(() => {
        if (!integrationsData) return [];
        return integrationsData.map(i => ({
            id: i.id,
            name: i.displayName || i.name || i.id,
            type: i.type
        }));
    }, [integrationsData]);

    // Extract data from query results
    const groups = usersAndGroups?.groups ?? [];
    const ungroupedUsers = usersAndGroups?.ungroupedUsers ?? [];
    const widgetShares = allSharesData?.widgetShares ?? {};

    // Get shareable widget types from registry (excludes isGlobal widgets)
    const shareableWidgets = useMemo(() => getShareableWidgets(), []);

    // Get widgets by category for filtering
    const widgetsByCategory = useMemo(() => getWidgetsByCategory(), []);
    const categories = useMemo(() => ['all', ...Object.keys(widgetsByCategory)], [widgetsByCategory]);

    // Check if a widget has active shares
    const hasActiveShares = (widgetType: string): boolean => {
        const shares = widgetShares[widgetType];
        if (!shares) return false;
        return shares.userCount > 0 || shares.groupCount > 0 || shares.hasEveryoneShare;
    };

    // Filter widgets: must be shareable AND have active shares, then apply user filters
    const activeWidgets = useMemo(() => {
        return shareableWidgets.filter(widget => {
            // Must have active shares to appear on this page
            if (!hasActiveShares(widget.type)) return false;

            // Category filter
            if (selectedCategory !== 'all' && widget.category !== selectedCategory) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const nameMatch = widget.name.toLowerCase().includes(searchLower);
                const typeMatch = widget.type.toLowerCase().includes(searchLower);
                if (!nameMatch && !typeMatch) return false;
            }

            return true;
        });
    }, [shareableWidgets, widgetShares, searchTerm, selectedCategory]);

    // Group widgets by category for display
    const widgetsByDisplayCategory = useMemo(() => {
        const grouped: Record<string, typeof activeWidgets> = {};

        for (const widget of activeWidgets) {
            const cat = widget.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(widget);
        }

        // Sort by CATEGORY_ORDER
        const orderedCategories = CATEGORY_ORDER.filter(c => grouped[c]?.length > 0);
        // Add any unlisted categories
        Object.keys(grouped).forEach(c => {
            if (!orderedCategories.includes(c)) orderedCategories.push(c);
        });

        return { grouped, orderedCategories };
    }, [activeWidgets]);

    // Count total shares for header
    const totalShareCount = useMemo(() => {
        return Object.values(widgetShares).reduce((sum, s) => sum + s.userCount + s.groupCount, 0);
    }, [widgetShares]);

    // Handle global revoke all
    const handleRevokeAll = async () => {
        try {
            await revokeAllMutation.mutateAsync();
            showSuccess('All Shares Revoked', 'All widget and integration shares have been cleared.');
        } catch {
            showError('Error', 'Failed to revoke all shares.');
        }
    };

    const loading = loadingUsers || loadingShares || loadingIntegrations;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin text-theme-secondary" />
            </div>
        );
    }

    // No users state
    if (groups.length === 0 && ungroupedUsers.length === 0) {
        return (
            <SettingsPage
                title="Shared Widgets"
                description="Manage widget access for your users"
            >
                <EmptyState
                    icon={Share2}
                    message="Create users first, then you can share widgets with them. Go to User Management to add users."
                />
            </SettingsPage>
        );
    }

    return (
        <SettingsPage
            title="Shared Widgets"
            description="Manage widget access for your users"
            headerAction={
                totalShareCount > 0 ? (
                    <ConfirmButton
                        onConfirm={handleRevokeAll}
                        size="md"
                        textSize="sm"
                        confirmMode="icon"
                        label="Revoke All Shares"
                        confirmLabel="Confirm"
                        disabled={revokeAllMutation.isPending}
                    />
                ) : undefined
            }
        >
            <SettingsSection title="Active Shares" icon={Share2}>
                {/* Filter Bar */}
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

                {/* Widget List - Grouped by Category */}
                {activeWidgets.length === 0 ? (
                    <div className="text-center py-16 text-theme-secondary">
                        <Share2 size={40} className="mx-auto mb-4 text-theme-tertiary" />
                        <p className="font-medium text-theme-primary mb-2">No Shared Widgets</p>
                        <p>
                            {searchTerm || selectedCategory !== 'all'
                                ? 'No widgets match your search criteria.'
                                : 'No widgets are currently shared with users. Share widgets from the Widget Gallery.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {widgetsByDisplayCategory.orderedCategories.map(category => (
                            <div key={category}>
                                {/* Category Header */}
                                <h4 className="text-sm font-semibold text-theme-secondary uppercase tracking-wider mb-3 pl-1">
                                    {category}
                                </h4>
                                {/* Widgets in Category */}
                                <div className="space-y-3">
                                    {widgetsByDisplayCategory.grouped[category].map(widget => (
                                        <WidgetShareCard
                                            key={widget.type}
                                            widgetType={widget.type}
                                            groups={groups}
                                            ungroupedUsers={ungroupedUsers}
                                            allIntegrations={integrations}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Summary */}
                <div className="mt-6 text-center text-sm text-theme-secondary">
                    {activeWidgets.length} widget{activeWidgets.length !== 1 ? 's' : ''} with active shares
                </div>
            </SettingsSection>
        </SettingsPage>
    );
};

export default SharedWidgetsSettings;
