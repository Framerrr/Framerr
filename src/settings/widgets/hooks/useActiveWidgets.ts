/**
 * useActiveWidgets Hook
 * 
 * Handles fetching, updating, and removing widgets for both
 * desktop and mobile layouts in the Active Widgets settings tab.
 * 
 * P2 Migration: Thin Orchestrator pattern
 * - Server state: Delegated to useWidgets and useSaveWidgets
 * - Local state: View mode, confirm removal, removing state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWidgets, useSaveWidgets } from '../../../api/hooks/useDashboard';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import { useLayout } from '../../../context/LayoutContext';
import type { Widget, WidgetConfig, ViewMode, WidgetStats } from '../types';
import type { MobileLayoutMode } from '../../../api/endpoints';

interface UseActiveWidgetsReturn {
    // State
    widgets: Widget[];
    mobileWidgets: Widget[];
    displayWidgets: Widget[];
    mobileLayoutMode: MobileLayoutMode;
    viewMode: ViewMode;
    loading: boolean;
    removingWidget: string | null;
    confirmRemoveId: string | null;
    stats: WidgetStats;
    showViewToggle: boolean;

    // Actions
    setViewMode: (mode: ViewMode) => void;
    setConfirmRemoveId: (id: string | null) => void;
    handleRemove: (widgetId: string) => Promise<void>;
    handleIconSelect: (widgetId: string, iconName: string) => Promise<void>;
    updateWidgetConfig: (widgetId: string, configUpdates: Partial<WidgetConfig>) => Promise<void>;
    resizeWidget: (widgetId: string, size: { w?: number; h?: number }) => Promise<void>;
}

/**
 * Hook for managing active widgets state and operations
 */
export function useActiveWidgets(): UseActiveWidgetsReturn {
    const { isMobile } = useLayout();
    const { error: showError, success: showSuccess } = useNotifications();

    // ========================================================================
    // Server State (React Query)
    // ========================================================================
    const {
        data: widgetsData,
        isLoading: loading,
        refetch: refetchWidgets,
    } = useWidgets();

    const saveMutation = useSaveWidgets();

    // Unwrap data from query
    const widgets = widgetsData?.widgets ?? [];
    const mobileWidgets = widgetsData?.mobileWidgets ?? [];
    const mobileLayoutMode = widgetsData?.mobileLayoutMode ?? 'linked';

    // ========================================================================
    // Local UI State
    // ========================================================================
    const [viewMode, setViewMode] = useState<ViewMode>('desktop');
    const [removingWidget, setRemovingWidget] = useState<string | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    // Set default view based on current device
    useEffect(() => {
        setViewMode(isMobile ? 'mobile' : 'desktop');
    }, [isMobile]);

    // ========================================================================
    // Event Listeners (refetch on external changes)
    // ========================================================================
    useEffect(() => {
        const handleRefresh = (): void => {
            refetchWidgets();
        };

        const handleHashChange = (): void => {
            if (window.location.hash.includes('active-widgets')) {
                refetchWidgets();
            }
        };

        window.addEventListener('mobile-layout-mode-changed', handleRefresh);
        window.addEventListener('widgets-added', handleRefresh);
        window.addEventListener('widgets-updated', handleRefresh);
        window.addEventListener('widget-config-changed', handleRefresh);
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('mobile-layout-mode-changed', handleRefresh);
            window.removeEventListener('widgets-added', handleRefresh);
            window.removeEventListener('widgets-updated', handleRefresh);
            window.removeEventListener('widget-config-changed', handleRefresh);
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [refetchWidgets]);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleRemove = useCallback(async (widgetId: string): Promise<void> => {
        setRemovingWidget(widgetId);
        try {
            // Determine which array to update based on view mode
            if (viewMode === 'mobile' && mobileLayoutMode === 'independent') {
                const updatedMobileWidgets = mobileWidgets.filter(w => w.id !== widgetId);
                await saveMutation.mutateAsync({
                    widgets,
                    mobileLayoutMode: 'independent',
                    mobileWidgets: updatedMobileWidgets
                });
            } else {
                const updatedWidgets = widgets.filter(w => w.id !== widgetId);
                await saveMutation.mutateAsync({
                    widgets: updatedWidgets,
                    mobileLayoutMode,
                    mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined
                });
            }
            setConfirmRemoveId(null);
            showSuccess('Widget Removed', 'Widget removed from dashboard');
            window.dispatchEvent(new CustomEvent('widgets-added'));
        } catch (error) {
            logger.error('Failed to remove widget', { widgetId, error: (error as Error).message });
            showError('Remove Failed', 'Failed to remove widget. Please try again.');
            setConfirmRemoveId(null);
        } finally {
            setRemovingWidget(null);
        }
    }, [viewMode, mobileLayoutMode, widgets, mobileWidgets, saveMutation, showError, showSuccess]);

    const handleIconSelect = useCallback(async (widgetId: string, iconName: string): Promise<void> => {
        const isMobileEdit = viewMode === 'mobile' && mobileLayoutMode === 'independent';

        try {
            if (isMobileEdit) {
                const updatedMobileWidgets = mobileWidgets.map(w =>
                    w.id === widgetId
                        ? { ...w, config: { ...w.config, customIcon: iconName } }
                        : w
                );
                await saveMutation.mutateAsync({
                    widgets,
                    mobileLayoutMode: 'independent',
                    mobileWidgets: updatedMobileWidgets
                });
                window.dispatchEvent(new CustomEvent('widget-config-changed', {
                    detail: { widgetId, config: updatedMobileWidgets.find(w => w.id === widgetId)?.config, target: 'mobile' as const }
                }));
            } else {
                const updatedWidgets = widgets.map(w =>
                    w.id === widgetId
                        ? { ...w, config: { ...w.config, customIcon: iconName } }
                        : w
                );
                await saveMutation.mutateAsync({
                    widgets: updatedWidgets,
                    mobileLayoutMode,
                    mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined
                });
                window.dispatchEvent(new CustomEvent('widget-config-changed', {
                    detail: { widgetId, config: updatedWidgets.find(w => w.id === widgetId)?.config, target: 'desktop' as const }
                }));
            }
        } catch (error) {
            logger.error('Failed to update widget icon', { widgetId, error: (error as Error).message });
            refetchWidgets();
        }
    }, [viewMode, mobileLayoutMode, widgets, mobileWidgets, saveMutation, refetchWidgets]);

    const updateWidgetConfig = useCallback(async (
        widgetId: string,
        configUpdates: Partial<WidgetConfig>
    ): Promise<void> => {
        const isMobileEdit = viewMode === 'mobile' && mobileLayoutMode === 'independent';

        try {
            if (isMobileEdit) {
                const updatedMobileWidgets = mobileWidgets.map(w =>
                    w.id === widgetId
                        ? { ...w, config: { ...w.config, ...configUpdates } }
                        : w
                );
                await saveMutation.mutateAsync({
                    widgets,
                    mobileLayoutMode: 'independent',
                    mobileWidgets: updatedMobileWidgets
                });
                const updatedWidget = updatedMobileWidgets.find(w => w.id === widgetId);
                window.dispatchEvent(new CustomEvent('widget-config-changed', {
                    detail: { widgetId, config: updatedWidget?.config, target: 'mobile' as const }
                }));
            } else {
                const updatedWidgets = widgets.map(w =>
                    w.id === widgetId
                        ? { ...w, config: { ...w.config, ...configUpdates } }
                        : w
                );
                await saveMutation.mutateAsync({
                    widgets: updatedWidgets,
                    mobileLayoutMode,
                    mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined
                });
                const updatedWidget = updatedWidgets.find(w => w.id === widgetId);
                window.dispatchEvent(new CustomEvent('widget-config-changed', {
                    detail: { widgetId, config: updatedWidget?.config, target: 'desktop' as const }
                }));
            }
        } catch (error) {
            logger.error('Failed to update widget config', { widgetId, error: (error as Error).message });
            showError('Update Failed', 'Failed to update widget. Please try again.');
            refetchWidgets();
        }
    }, [viewMode, mobileLayoutMode, widgets, mobileWidgets, saveMutation, showError, refetchWidgets]);

    /**
     * Resize a widget's dimensions.
     * Used by header toggle when headerHeightMode is 'hard',
     * and future manual resize modal.
     */
    const resizeWidget = useCallback(async (
        widgetId: string,
        size: { w?: number; h?: number }
    ): Promise<void> => {
        const isMobileEdit = viewMode === 'mobile' && mobileLayoutMode === 'independent';

        try {
            if (isMobileEdit) {
                const updatedMobileWidgets = mobileWidgets.map(w => {
                    if (w.id !== widgetId) return w;
                    return {
                        ...w,
                        mobileLayout: w.mobileLayout ? {
                            ...w.mobileLayout,
                            w: size.w ?? w.mobileLayout.w,
                            h: size.h ?? w.mobileLayout.h,
                        } : {
                            ...w.layout,
                            w: size.w ?? w.layout.w,
                            h: size.h ?? w.layout.h,
                        },
                    };
                });
                await saveMutation.mutateAsync({
                    widgets,
                    mobileLayoutMode: 'independent',
                    mobileWidgets: updatedMobileWidgets
                });
            } else {
                const updatedWidgets = widgets.map(w => {
                    if (w.id !== widgetId) return w;
                    return {
                        ...w,
                        layout: {
                            ...w.layout,
                            w: size.w ?? w.layout.w,
                            h: size.h ?? w.layout.h,
                        },
                    };
                });
                await saveMutation.mutateAsync({
                    widgets: updatedWidgets,
                    mobileLayoutMode,
                    mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined
                });
            }
            // Notify dashboard to refresh
            window.dispatchEvent(new CustomEvent('widgets-updated'));
        } catch (error) {
            logger.error('Failed to resize widget', { widgetId, size, error: (error as Error).message });
            showError('Resize Failed', 'Failed to resize widget. Please try again.');
            refetchWidgets();
        }
    }, [viewMode, mobileLayoutMode, widgets, mobileWidgets, saveMutation, showError, refetchWidgets]);

    // ========================================================================
    // Derived State
    // ========================================================================

    // Determine which widgets to display based on view mode
    const displayWidgets = (viewMode === 'mobile' && mobileLayoutMode === 'independent')
        ? mobileWidgets
        : widgets;

    // Calculate stats based on displayed widgets
    const stats: WidgetStats = useMemo(() => ({
        total: displayWidgets.length,
        byType: displayWidgets.reduce<Record<string, number>>((acc, w) => {
            acc[w.type] = (acc[w.type] || 0) + 1;
            return acc;
        }, {})
    }), [displayWidgets]);

    // Show toggle only when in independent mode
    const showViewToggle = mobileLayoutMode === 'independent';

    // ========================================================================
    // Return
    // ========================================================================

    return {
        widgets,
        mobileWidgets,
        displayWidgets,
        mobileLayoutMode,
        viewMode,
        loading,
        removingWidget,
        confirmRemoveId,
        stats,
        showViewToggle,

        setViewMode,
        setConfirmRemoveId,
        handleRemove,
        handleIconSelect,
        updateWidgetConfig,
        resizeWidget
    };
}
