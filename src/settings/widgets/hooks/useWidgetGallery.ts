/**
 * useWidgetGallery Hook
 * 
 * State management and business logic for the Widget Gallery.
 * Handles fetching integrations, widget visibility, filtering, and adding widgets.
 * 
 * P2 React Query Migration: Uses useWidgetData for role-aware server state.
 */

import { useState, useCallback, useMemo } from 'react';
import { widgetsApi, integrationsApi } from '../../../api/endpoints';
import { useWidgets } from '../../../api/hooks';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useLayout } from '../../../context/LayoutContext';
import { isAdmin } from '../../../utils/permissions';
import { getWidgetsByCategory, getWidgetMetadata, WidgetMetadata } from '../../../widgets/registry';
import { useWidgetSharing } from '../../../hooks/useWidgetSharing';
import { useWidgetData } from '../../../shared/widgets';
// Note: SSE permission subscription is now centralized in useWidgetData
import { GRID_COLS } from '../../../constants/gridConfig';
import { Widget, IntegrationConfig, SharedIntegration } from '../types';

export interface UseWidgetGalleryReturn {
    // State
    loading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    addingWidget: string | null;
    categories: string[];
    filteredWidgets: Record<string, WidgetMetadata[]>;
    totalVisibleWidgets: number;
    hasAdminAccess: boolean;

    // Integration state
    integrations: Record<string, IntegrationConfig>;
    sharedIntegrations: SharedIntegration[];

    // Share modal state
    shareModalOpen: boolean;
    setShareModalOpen: (open: boolean) => void;
    shareWidget: WidgetMetadata | null;
    setShareWidget: (widget: WidgetMetadata | null) => void;
    shareLoading: boolean;
    groups: ReturnType<typeof useWidgetSharing>['groups'];
    ungroupedUsers: ReturnType<typeof useWidgetSharing>['ungroupedUsers'];
    shareIntegrations: ReturnType<typeof useWidgetSharing>['compatibleIntegrations'];
    initialUserShares: ReturnType<typeof useWidgetSharing>['initialUserShares'];

    // Actions
    handleAddWidget: (widgetType: string) => Promise<void>;
    handleShareWidget: (widget: WidgetMetadata) => Promise<void>;
    handleSaveShares: (shares: { widgetShares: string[]; integrationShares: Record<string, string[]> }) => Promise<void>;
    isWidgetVisible: (widget: WidgetMetadata) => boolean;
    getSharedByInfo: (widget: WidgetMetadata) => string | undefined;
    isIntegrationReady: (widget: WidgetMetadata) => boolean;
}

export function useWidgetGallery(): UseWidgetGalleryReturn {
    // UI State
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [addingWidget, setAddingWidget] = useState<string | null>(null);

    // Share modal state
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareWidget, setShareWidget] = useState<WidgetMetadata | null>(null);

    // Context
    const { success: showSuccess, error: showError } = useNotifications();
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const hasAdminAccess = isAdmin(user);

    // Dashboard data for mobile layout
    const { data: dashboardData } = useWidgets();
    const mobileLayoutMode = dashboardData?.mobileLayoutMode || 'linked';
    const mobileWidgets = dashboardData?.mobileWidgets || [];

    // P2 React Query: Use shared useWidgetData hook (single source of truth, role-aware)
    const {
        loading,
        integrations,
        sharedIntegrations,
        isWidgetVisible: sharedIsWidgetVisible,
        getSharedByInfo: sharedGetSharedByInfo,
        fetchIntegrations: refetchWidgetData,
    } = useWidgetData({ fetchOnMount: true });

    // Widget sharing hook
    const {
        loading: shareLoading,
        groups,
        ungroupedUsers,
        compatibleIntegrations: shareIntegrations,
        initialUserShares,
        loadShareData,
        saveShares
    } = useWidgetSharing();

    // Note: SSE permission subscription is centralized in useWidgetData hook (Phase 24)
    // All consumers of useWidgetData automatically react to permission changes

    // Widget metadata
    const widgetsByCategory = getWidgetsByCategory();
    const categories = useMemo(() => ['all', ...Object.keys(widgetsByCategory)], [widgetsByCategory]);

    // Delegate visibility checks to shared useWidgetData hook (single source of truth)
    // This ensures the Widget Gallery and AddWidgetModal have identical visibility logic
    const isWidgetVisible = sharedIsWidgetVisible;

    // Delegate getSharedByInfo to shared hook as well
    const getSharedByInfo = useCallback((widget: WidgetMetadata): string | undefined => {
        return sharedGetSharedByInfo(widget) || undefined;
    }, [sharedGetSharedByInfo]);

    // Check if integration is ready for a widget
    const isIntegrationReady = useCallback((widget: WidgetMetadata): boolean => {
        const compatibleTypes = widget.compatibleIntegrations || [];
        const hasIntegrations = compatibleTypes.length > 0;

        if (!hasIntegrations) return true;

        if (hasAdminAccess) {
            return compatibleTypes.some(type => integrations[type]?.isConfigured);
        } else {
            return compatibleTypes.some(type =>
                sharedIntegrations.some(si => si.name === type)
            );
        }
    }, [hasAdminAccess, integrations, sharedIntegrations]);

    // Open share modal for a widget (admin only)
    const handleShareWidget = useCallback(async (widget: WidgetMetadata): Promise<void> => {
        setShareWidget(widget);
        const loaded = await loadShareData(widget.type!, widget.compatibleIntegrations || []);
        if (loaded) {
            setShareModalOpen(true);
        }
    }, [loadShareData]);

    // Save shares from modal
    const handleSaveShares = useCallback(async (shares: { widgetShares: string[]; integrationShares: Record<string, string[]> }) => {
        if (shareWidget?.type) {
            await saveShares(shareWidget.type, shares, shareWidget.compatibleIntegrations || []);
        }
    }, [shareWidget, saveShares]);

    // Add widget to dashboard
    const handleAddWidget = useCallback(async (widgetType: string): Promise<void> => {
        setAddingWidget(widgetType);

        try {
            const metadata = getWidgetMetadata(widgetType);
            if (!metadata) {
                showError('Widget Not Found', 'Widget metadata not found');
                return;
            }

            // Fetch current widgets
            const currentResponse = await widgetsApi.getAll();
            const currentWidgets: Widget[] = currentResponse.widgets || [];
            const currentMobileWidgets: Widget[] = currentResponse.mobileWidgets || [];
            const currentMobileLayoutMode = currentResponse.mobileLayoutMode || 'linked';

            // Build widget config based on role
            let widgetConfig: Record<string, unknown> = {
                title: metadata.name
            };

            // For integration widgets, auto-bind integrationId
            const compatibleTypes = metadata.compatibleIntegrations || [];
            if (compatibleTypes.length > 0) {
                // Check if this is the calendar widget (multi-integration)
                if (widgetType === 'calendar') {
                    const [sonarrRes, radarrRes] = await Promise.all([
                        integrationsApi.getByType('sonarr').catch(() => ({ instances: [] })),
                        integrationsApi.getByType('radarr').catch(() => ({ instances: [] }))
                    ]);

                    const sonarrInstances = sonarrRes.instances || [];
                    const radarrInstances = radarrRes.instances || [];

                    if (sonarrInstances.length > 0) {
                        widgetConfig.sonarrIntegrationId = sonarrInstances[0].id;
                    }
                    if (radarrInstances.length > 0) {
                        widgetConfig.radarrIntegrationId = radarrInstances[0].id;
                    }
                } else {
                    // Single-integration widget - find first available instance
                    for (const integrationType of compatibleTypes) {
                        try {
                            const instancesRes = await integrationsApi.getByType(integrationType);
                            const instances = instancesRes.instances || [];

                            if (instances.length > 0) {
                                widgetConfig.integrationId = instances[0].id;
                                break;
                            }
                        } catch (err) {
                            logger.warn(`Failed to fetch instances for ${integrationType}:`, err);
                        }
                    }
                }
            }

            // Determine if adding to mobile or desktop
            const shouldAddToMobile = isMobile && currentMobileLayoutMode === 'independent';

            if (shouldAddToMobile) {
                // Add to mobile widgets (FramerrWidget format)
                const newMobileWidget: Widget = {
                    id: `widget-${Date.now()}`,
                    type: widgetType,
                    layout: { x: 0, y: 0, w: 24, h: metadata.defaultSize.h },
                    mobileLayout: { x: 0, y: 0, w: GRID_COLS.sm, h: metadata.defaultSize.h },
                    config: widgetConfig
                };

                // Shift existing mobile widgets down
                const shiftedMobileWidgets = currentMobileWidgets.map(w => ({
                    ...w,
                    mobileLayout: {
                        ...w.mobileLayout,
                        x: w.mobileLayout?.x ?? 0,
                        y: (w.mobileLayout?.y ?? 0) + metadata.defaultSize.h,
                        w: w.mobileLayout?.w ?? GRID_COLS.sm,
                        h: w.mobileLayout?.h ?? 2
                    }
                }));

                const updatedMobileWidgets = [newMobileWidget, ...shiftedMobileWidgets];

                await widgetsApi.saveAll({
                    widgets: currentWidgets,
                    mobileLayoutMode: currentMobileLayoutMode,
                    mobileWidgets: updatedMobileWidgets
                });

                showSuccess('Widget Added', `${metadata.name} added to your mobile dashboard!`);
            } else {
                // Add to desktop widgets (FramerrWidget format)
                const newWidget: Widget = {
                    id: `widget-${Date.now()}`,
                    type: widgetType,
                    layout: { x: 0, y: 0, w: 24, h: metadata.defaultSize.h },
                    mobileLayout: { x: 0, y: 0, w: GRID_COLS.sm, h: metadata.defaultSize.h },
                    config: widgetConfig
                };

                // Shift existing widgets down (update both layout and mobileLayout)
                const shiftedWidgets = currentWidgets.map(w => ({
                    ...w,
                    layout: {
                        ...w.layout,
                        x: w.layout.x,
                        y: w.layout.y + metadata.defaultSize.h,
                        w: w.layout.w,
                        h: w.layout.h
                    },
                    mobileLayout: w.mobileLayout ? {
                        ...w.mobileLayout,
                        x: w.mobileLayout.x,
                        y: w.mobileLayout.y + metadata.defaultSize.h,
                        w: w.mobileLayout.w,
                        h: w.mobileLayout.h
                    } : undefined
                }));

                const updatedWidgets = [newWidget, ...shiftedWidgets];

                await widgetsApi.saveAll({
                    widgets: updatedWidgets,
                    mobileLayoutMode: currentMobileLayoutMode,
                    mobileWidgets: currentMobileLayoutMode === 'independent' ? currentMobileWidgets : undefined
                });

                showSuccess('Widget Added', `${metadata.name} added to your dashboard!`);
            }

            // Dispatch event for Dashboard refresh
            window.dispatchEvent(new CustomEvent('widgets-added', {
                detail: { widgetType, target: shouldAddToMobile ? 'mobile' : 'desktop' }
            }));
        } catch (error) {
            logger.error('Failed to add widget:', error);
            showError('Add Failed', 'Failed to add widget. Please try again.');
        } finally {
            setAddingWidget(null);
        }
    }, [isMobile, showSuccess, showError]);

    // Filter widgets based on visibility and search
    const filteredWidgets = useMemo(() => {
        return Object.entries(widgetsByCategory).reduce<Record<string, WidgetMetadata[]>>((acc, [category, widgets]) => {
            if (selectedCategory !== 'all' && selectedCategory !== category) {
                return acc;
            }

            const filtered = widgets.filter(widget => {
                if (!isWidgetVisible(widget)) {
                    return false;
                }

                return (
                    widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    widget.description.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });

            if (filtered.length > 0) {
                acc[category] = filtered;
            }

            return acc;
        }, {});
    }, [widgetsByCategory, selectedCategory, searchTerm, isWidgetVisible]);

    // Total visible widgets count
    const totalVisibleWidgets = useMemo(() => {
        return Object.values(filteredWidgets).reduce((sum, widgets) => sum + widgets.length, 0);
    }, [filteredWidgets]);

    return {
        // State
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

        // Integration state
        integrations,
        sharedIntegrations,

        // Share modal state
        shareModalOpen,
        setShareModalOpen,
        shareWidget,
        setShareWidget,
        shareLoading,
        groups,
        ungroupedUsers,
        shareIntegrations,
        initialUserShares,

        // Actions
        handleAddWidget,
        handleShareWidget,
        handleSaveShares,
        isWidgetVisible,
        getSharedByInfo,
        isIntegrationReady
    };
}
