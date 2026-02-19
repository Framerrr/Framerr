// Dashboard handlers hook - handles actions and event effects
// Extracted from Dashboard.tsx during Phase 6.2 refactor

import { useEffect, useCallback, useRef } from 'react';
import logger from '../../../utils/logger';
import { useWalkthrough } from '../../../features/walkthrough';
import { getWidgetMetadata } from '../../../widgets/registry';
import { resolveAutoBinding } from '../../../widgets/resolveAutoBinding';
import { generateAllMobileLayouts } from '../../../utils/layoutUtils';
import { fromLegacyWidget } from '../../../shared/grid/adapter';
import { GRID_COLS } from '../../../constants/gridConfig';
import { triggerHaptic } from '../../../utils/haptics';
import { widgetsApi } from '../../../api/endpoints/widgets';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import type { FramerrWidget } from '../../../../shared/types/widget';
import type { LayoutItem } from '../../../hooks/useDashboardLayout/types';
import type { WidgetApiResponse } from '../types';

interface DashboardEditContextType {
    pendingDestination: string | null;
    setPendingDestination: (dest: string | null) => void;
    updateEditState: (state: {
        editMode: boolean;
        hasUnsavedChanges: boolean;
        pendingUnlink: boolean;
        canUndo: boolean;
        canRedo: boolean;
        saving: boolean;
        mobileLayoutMode: 'linked' | 'independent';
    }) => void;
    registerDashboard: (handlers: {
        handleSave: () => Promise<void>;
        handleCancel: () => void;
        handleAddWidget: () => void;
        handleRelink: () => void;
        handleUndo: () => void;
        handleRedo: () => void;
        handleEnterEditMode: (isTouch?: boolean) => void;
    }) => void;
    unregisterDashboard: () => void;
}

interface UseDashboardHandlersOptions {
    // Layout hook state
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    layouts: { lg: LayoutItem[]; sm: LayoutItem[] };
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    editMode: boolean;
    hasUnsavedChanges: boolean;
    isMobile: boolean;
    currentBreakpoint: string;

    // Layout hook actions
    setEditMode: (mode: boolean) => void;
    addWidget: (widget: FramerrWidget) => void;
    deleteWidget: (widgetId: string) => void;
    cancelEditing: () => void;
    commitChanges: () => void;
    updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clearHistory: () => void;
    setInitialData: (data: {
        widgets: FramerrWidget[];
        mobileWidgets?: FramerrWidget[];
        mobileLayoutMode: 'linked' | 'independent';
    }) => void;

    // Data hook state
    saving: boolean;
    setSaving: (saving: boolean) => void;
    setLoading: (loading: boolean) => void;
    mobileDisclaimerDismissed: boolean;
    setIsUsingTouch: (isTouch: boolean) => void;
    setGreetingMode: (mode: 'auto' | 'manual') => void;
    setGreetingText: (text: string) => void;
    setHeaderVisible: (visible: boolean) => void;
    setTaglineEnabled: (enabled: boolean) => void;
    setTaglineText: (text: string) => void;
    setTones: (tones: string[]) => void;
    setLoadingMessagesEnabled: (enabled: boolean) => void;

    // Context
    dashboardEditContext: DashboardEditContextType | null;

    // Notifications
    showError: (title: string, message: string) => void;
}

interface UseDashboardHandlersReturn {
    // Modal controls
    showAddModal: boolean;
    setShowAddModal: (show: boolean) => void;
    showMobileDisclaimer: boolean;
    setShowMobileDisclaimer: (show: boolean) => void;
    showUnlinkConfirmation: boolean;
    setShowUnlinkConfirmation: (show: boolean) => void;
    showRelinkConfirmation: boolean;
    setShowRelinkConfirmation: (show: boolean) => void;
    configModalWidgetId: string | null;
    setConfigModalWidgetId: (id: string | null) => void;

    // Save/Cancel
    handleSave: () => Promise<void>;
    performSave: () => Promise<void>;
    handleCancel: () => void;

    // Navigation guards
    handleDiscardAndNavigate: () => void;
    handleSaveAndNavigate: () => Promise<void>;
    handleCancelNavigation: () => void;

    // Edit mode
    handleToggleEdit: (isTouch?: boolean) => void;
    handleAddWidget: () => void;
    handleAddWidgetFromModal: (widgetType: string, layout?: { x: number; y: number; w: number; h: number; id?: string }) => Promise<void>;

    // Widget actions
    handleDeleteWidget: (widgetId: string) => void;
    handleDuplicateWidget: (widgetId: string) => void;
    handleEditWidget: (widgetId: string) => void;
    handleSaveWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
    handleResetMobileLayout: () => Promise<void>;
}

export function useDashboardHandlers({
    widgets,
    mobileWidgets,
    layouts,
    mobileLayoutMode,
    pendingUnlink,
    editMode,
    hasUnsavedChanges,
    isMobile,
    currentBreakpoint,
    setEditMode,
    addWidget,
    deleteWidget,
    cancelEditing,
    commitChanges,
    updateWidgetConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    setInitialData,
    saving,
    setSaving,
    setLoading,
    mobileDisclaimerDismissed,
    setIsUsingTouch,
    setGreetingMode,
    setGreetingText,
    setHeaderVisible,
    setTaglineEnabled,
    setTaglineText,
    setTones,
    setLoadingMessagesEnabled,
    dashboardEditContext,
    showError,
}: UseDashboardHandlersOptions): UseDashboardHandlersReturn {
    // Modal state - kept here since handlers control them
    const [showAddModal, setShowAddModal] = React.useState<boolean>(false);
    const [showMobileDisclaimer, setShowMobileDisclaimer] = React.useState<boolean>(false);
    const [showUnlinkConfirmation, setShowUnlinkConfirmation] = React.useState<boolean>(false);
    const [showRelinkConfirmation, setShowRelinkConfirmation] = React.useState<boolean>(false);
    const [configModalWidgetId, setConfigModalWidgetId] = React.useState<string | null>(null);

    // Integration data for auto-binding (from React Query cache)
    const { data: allIntegrations = [] } = useRoleAwareIntegrations();

    // Walkthrough engine — used for emit() on widget add
    const walkthrough = useWalkthrough();

    // ========== SAVE/CANCEL HANDLERS ==========

    const performSave = useCallback(async (): Promise<void> => {
        try {
            setSaving(true);

            if (pendingUnlink || (isMobile && mobileLayoutMode === 'independent')) {
                if (pendingUnlink && mobileLayoutMode === 'linked') {
                    await widgetsApi.saveAll({
                        widgets: widgets,
                        mobileLayoutMode: 'independent',
                        mobileWidgets: mobileWidgets
                    });
                    window.dispatchEvent(new CustomEvent('mobile-layout-mode-changed'));
                    logger.debug('Mobile dashboard unlinked and saved');
                } else if (mobileLayoutMode === 'independent') {
                    await widgetsApi.saveAll({
                        widgets: widgets,
                        mobileLayoutMode: 'independent',
                        mobileWidgets: mobileWidgets
                    });
                    logger.debug('Independent mobile widgets saved');
                }
            } else {
                await widgetsApi.saveAll({
                    widgets,
                    mobileLayoutMode,
                    mobileWidgets: mobileLayoutMode === 'independent' ? mobileWidgets : undefined
                });
            }

            commitChanges();
            clearHistory();
            setEditMode(false);
            setShowUnlinkConfirmation(false);
            window.dispatchEvent(new CustomEvent('widgets-updated'));
            logger.debug('Widgets saved successfully');
        } catch (error) {
            logger.error('Failed to save widgets:', { error });
        } finally {
            setSaving(false);
        }
    }, [widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, isMobile, commitChanges, clearHistory, setEditMode, setSaving]);

    const handleSave = useCallback(async (): Promise<void> => {
        if (pendingUnlink && mobileLayoutMode === 'linked') {
            setShowUnlinkConfirmation(true);
            return;
        }
        await performSave();
    }, [pendingUnlink, mobileLayoutMode, performSave]);

    const handleCancel = useCallback((): void => {
        cancelEditing();
        clearHistory();
        setShowUnlinkConfirmation(false);
    }, [cancelEditing, clearHistory]);

    // ========== NAVIGATION GUARD HANDLERS ==========

    const handleDiscardAndNavigate = useCallback((): void => {
        const destination = dashboardEditContext?.pendingDestination;
        handleCancel();
        dashboardEditContext?.setPendingDestination(null);
        if (destination) {
            window.location.hash = destination;
        }
    }, [dashboardEditContext, handleCancel]);

    const handleSaveAndNavigate = useCallback(async (): Promise<void> => {
        const destination = dashboardEditContext?.pendingDestination;
        dashboardEditContext?.setPendingDestination(null);
        await performSave();
        if (destination) {
            window.location.hash = destination;
        }
    }, [dashboardEditContext, performSave]);

    const handleCancelNavigation = useCallback((): void => {
        dashboardEditContext?.setPendingDestination(null);
    }, [dashboardEditContext]);

    // ========== EDIT MODE HANDLERS ==========

    const handleToggleEdit = useCallback((isTouch?: boolean): void => {
        if (editMode && hasUnsavedChanges) {
            handleCancel();
        } else if (!editMode) {
            if (isMobile && mobileLayoutMode === 'linked' && !mobileDisclaimerDismissed) {
                setShowMobileDisclaimer(true);
                return;
            }
            if (isTouch !== undefined) {
                setIsUsingTouch(isTouch);
            }
            setEditMode(true);
        } else {
            setEditMode(!editMode);
        }
    }, [editMode, hasUnsavedChanges, isMobile, mobileLayoutMode, mobileDisclaimerDismissed, handleCancel, setEditMode, setIsUsingTouch]);

    const handleAddWidget = useCallback((): void => {
        setShowAddModal(true);
        if (!editMode) setEditMode(true);
    }, [editMode, setEditMode]);

    const handleAddWidgetFromModal = useCallback(async (widgetType: string, layout?: { x: number; y: number; w: number; h: number; id?: string }): Promise<void> => {
        try {
            const metadata = getWidgetMetadata(widgetType);
            if (!metadata) {
                showError('Add Widget Failed', 'Widget type not found.');
                return;
            }

            // Start with plugin's defaultConfig, then add title and auto-binding
            const autoBinding = resolveAutoBinding(widgetType, allIntegrations);
            const widgetConfig: Record<string, unknown> = {
                ...metadata.defaultConfig,
                title: metadata.name,
                ...autoBinding,
            };

            // Create FramerrWidget format
            // If layout provided (from external drag), use it; otherwise default to (0,0)
            // If ID provided (from drop handler), use it; otherwise generate new ID
            const newWidget: FramerrWidget = {
                id: layout?.id || `widget-${Date.now()}`,
                type: widgetType,
                layout: layout ?? { x: 0, y: 0, w: metadata.defaultSize.w, h: metadata.defaultSize.h },
                // Mobile layout: use drop position for x/y, but full-width for mobile
                mobileLayout: {
                    x: 0, // Mobile is typically full-width, so x=0 is correct
                    y: layout?.y ?? 0, // Keep the y position from drop!
                    w: GRID_COLS.sm,
                    h: layout?.h ?? metadata.defaultSize.h
                },
                config: widgetConfig
            };

            addWidget(newWidget);
            setShowAddModal(false);

            // Notify walkthrough engine that a widget was added (for step advancement)
            walkthrough?.emit('widget-added', { widgetId: newWidget.id, widgetType: widgetType });
        } catch (error) {
            logger.error('Failed to add widget:', { error });
            showError('Add Widget Failed', 'Failed to add widget.');
        }
    }, [addWidget, showError, allIntegrations]);

    // ========== WIDGET ACTION HANDLERS ==========

    const handleDeleteWidget = useCallback((widgetId: string): void => {
        deleteWidget(widgetId);
    }, [deleteWidget]);

    const handleDuplicateWidget = useCallback((widgetId: string): void => {
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        // Get source widget's current position from grid layout state
        const breakpoint = isMobile ? 'sm' : 'lg';
        const sourceLayout = layouts[breakpoint].find(l => l.id === widgetId);

        // Create FramerrWidget format with same dimensions, positioned at source's Y
        // GridStack compaction will handle finding the actual insertion point
        const newWidget: FramerrWidget = {
            id: `widget-${Date.now()}`,
            type: widget.type,
            layout: {
                x: 0,
                y: sourceLayout?.y ?? widget.layout.y ?? 0,
                w: sourceLayout?.w ?? widget.layout.w ?? 4,
                h: sourceLayout?.h ?? widget.layout.h ?? 4
            },
            mobileLayout: widget.mobileLayout ? {
                ...widget.mobileLayout,
                y: (isMobile && sourceLayout) ? sourceLayout.y : (widget.mobileLayout.y ?? 0),
            } : undefined,
            config: { ...widget.config }
        };

        addWidget(newWidget);
    }, [widgets, layouts, isMobile, addWidget]);

    const handleEditWidget = useCallback((widgetId: string): void => {
        setConfigModalWidgetId(widgetId);
    }, []);

    const handleSaveWidgetConfig = useCallback((widgetId: string, config: Record<string, unknown>): void => {
        window.dispatchEvent(new CustomEvent('widget-config-changed', {
            detail: { widgetId, config }
        }));
    }, []);

    const handleResetMobileLayout = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);

            // API returns FramerrWidget[] directly
            const response = await widgetsApi.getAll() as WidgetApiResponse;
            let fetchedWidgets = response.widgets || [];

            // Generate mobile layouts for the fetched widgets
            fetchedWidgets = generateAllMobileLayouts(fetchedWidgets);

            await widgetsApi.saveAll({
                widgets: fetchedWidgets,
                mobileLayoutMode: 'linked',
                mobileWidgets: []
            });

            setInitialData({
                widgets: fetchedWidgets,
                mobileWidgets: [],
                mobileLayoutMode: 'linked'
            });

            window.dispatchEvent(new CustomEvent('mobile-layout-mode-changed'));
            logger.debug('Reset to linked mode - regenerated from desktop');
        } catch (error) {
            logger.error('Failed to reset:', { error });
        } finally {
            setLoading(false);
        }
    }, [setLoading, setInitialData]);

    // ========== EFFECTS ==========

    // Walkthrough: re-open modal on failed drag drop (soft lock protection)
    useEffect(() => {
        const handler = () => {
            logger.info('[Walkthrough] walkthrough-reopen-modal received — calling setShowAddModal(true)');
            // setTimeout forces this into a separate React render batch from the
            // modal close (onClose sets false). Without this, React 18 auto-batching
            // combines both into one render and the modal never actually unmounts.
            setTimeout(() => setShowAddModal(true), 0);
        };
        window.addEventListener('walkthrough-reopen-modal', handler);
        return () => window.removeEventListener('walkthrough-reopen-modal', handler);
    }, []);

    // Walkthrough: close modals and save before navigating (e.g., admin → service settings)
    useEffect(() => {
        const handler = async () => {
            logger.info('[Walkthrough] close-modals-and-save event — closing modals and saving dashboard');
            setConfigModalWidgetId(null);
            setShowAddModal(false);
            try {
                await performSave();
                logger.info('[Walkthrough] Dashboard saved before navigation');
            } catch (error) {
                logger.error('[Walkthrough] Save failed before navigation:', { error });
                setEditMode(false);
            }
        };
        window.addEventListener('close-modals-and-save', handler);
        return () => window.removeEventListener('close-modals-and-save', handler);
    }, [performSave, setEditMode]);

    // Walkthrough: save dashboard and exit edit mode when flow completes
    useEffect(() => {
        const handler = async () => {
            logger.info('[Walkthrough] Flow complete event received — saving dashboard and exiting edit mode');
            // Close any open config modal first
            setConfigModalWidgetId(null);
            try {
                // Save the dashboard (commits all widget additions/changes)
                await performSave();
                logger.info('[Walkthrough] Dashboard saved successfully');
            } catch (error) {
                logger.error('[Walkthrough] performSave failed, forcing edit mode exit:', { error });
                // Even if save fails, exit edit mode so the user isn't stuck
                setEditMode(false);
            }
        };
        window.addEventListener('walkthrough-flow-complete', handler);
        return () => window.removeEventListener('walkthrough-flow-complete', handler);
    }, [performSave, setEditMode]);

    // Sync edit state to context for Sidebar navigation blocking
    useEffect(() => {
        dashboardEditContext?.updateEditState({
            editMode,
            hasUnsavedChanges,
            pendingUnlink,
            canUndo,
            canRedo,
            saving,
            mobileLayoutMode,
        });
    }, [editMode, hasUnsavedChanges, pendingUnlink, canUndo, canRedo, saving, mobileLayoutMode, dashboardEditContext]);

    // Listen for dashboard events from Settings
    useEffect(() => {
        const handleWidgetsAdded = (): void => {
            logger.debug('widgets-added event received');
        };

        const handleGreetingUpdated = (event: Event): void => {
            const customEvent = event as CustomEvent<{
                mode?: 'auto' | 'manual';
                text?: string;
                headerVisible?: boolean;
                taglineEnabled?: boolean;
                taglineText?: string;
                tones?: string[];
                loadingMessages?: boolean;
            }>;
            if (customEvent.detail) {
                const d = customEvent.detail;
                if (d.mode !== undefined) setGreetingMode(d.mode);
                if (d.text !== undefined) setGreetingText(d.text);
                if (d.headerVisible !== undefined) setHeaderVisible(d.headerVisible);
                if (d.taglineEnabled !== undefined) setTaglineEnabled(d.taglineEnabled);
                if (d.taglineText !== undefined) setTaglineText(d.taglineText);
                if (d.tones !== undefined) setTones(d.tones);
                if (d.loadingMessages !== undefined) setLoadingMessagesEnabled(d.loadingMessages);
            }
        };

        const handleWidgetConfigChanged = (event: Event): void => {
            const customEvent = event as CustomEvent<{
                widgetId: string;
                config: Record<string, unknown>;
                target?: 'desktop' | 'mobile';
            }>;
            if (!customEvent.detail) return;

            const { widgetId, config } = customEvent.detail;
            logger.debug('widget-config-changed received', { widgetId, hasConfig: !!config, isMobile, mobileLayoutMode });

            if (widgetId && config) {
                updateWidgetConfig(widgetId, config);
            }
        };

        window.addEventListener('widgets-added', handleWidgetsAdded);
        window.addEventListener('greetingUpdated', handleGreetingUpdated);
        window.addEventListener('widget-config-changed', handleWidgetConfigChanged);
        return () => {
            window.removeEventListener('widgets-added', handleWidgetsAdded);
            window.removeEventListener('greetingUpdated', handleGreetingUpdated);
            window.removeEventListener('widget-config-changed', handleWidgetConfigChanged);
        };
    }, [editMode, isMobile, currentBreakpoint, mobileLayoutMode, updateWidgetConfig, setGreetingMode, setGreetingText, setHeaderVisible, setTaglineEnabled, setTaglineText, setTones, setLoadingMessagesEnabled]);

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (!editMode) return;

            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? e.metaKey : e.ctrlKey;

            if (modifierKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (modifierKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editMode, undo, redo]);

    // Register Dashboard action handlers with context for mobile tab bar
    const handlersRef = useRef<{
        handleSave: () => Promise<void>;
        handleCancel: () => void;
        handleAddWidget: () => void;
        handleRelink: () => void;
        handleUndo: () => void;
        handleRedo: () => void;
        handleEnterEditMode: (isTouch?: boolean) => void;
    } | null>(null);

    handlersRef.current = {
        handleSave,
        handleCancel,
        handleAddWidget,
        handleRelink: () => setShowRelinkConfirmation(true),
        handleUndo: undo,
        handleRedo: redo,
        handleEnterEditMode: (isTouch?: boolean) => {
            if (!editMode) {
                triggerHaptic();
                handleToggleEdit(isTouch);
            }
        },
    };

    useEffect(() => {
        dashboardEditContext?.registerDashboard({
            handleSave: async () => handlersRef.current?.handleSave(),
            handleCancel: () => handlersRef.current?.handleCancel(),
            handleAddWidget: () => handlersRef.current?.handleAddWidget(),
            handleRelink: () => handlersRef.current?.handleRelink(),
            handleUndo: () => handlersRef.current?.handleUndo(),
            handleRedo: () => handlersRef.current?.handleRedo(),
            handleEnterEditMode: (isTouch?: boolean) => handlersRef.current?.handleEnterEditMode(isTouch),
        });

        return () => {
            dashboardEditContext?.unregisterDashboard();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        showAddModal,
        setShowAddModal,
        showMobileDisclaimer,
        setShowMobileDisclaimer,
        showUnlinkConfirmation,
        setShowUnlinkConfirmation,
        showRelinkConfirmation,
        setShowRelinkConfirmation,
        configModalWidgetId,
        setConfigModalWidgetId,
        handleSave,
        performSave,
        handleCancel,
        handleDiscardAndNavigate,
        handleSaveAndNavigate,
        handleCancelNavigation,
        handleToggleEdit,
        handleAddWidget,
        handleAddWidgetFromModal,
        handleDeleteWidget,
        handleDuplicateWidget,
        handleEditWidget,
        handleSaveWidgetConfig,
        handleResetMobileLayout,
    };
}

// Need React import for useState
import React from 'react';

