import React, { useEffect, useRef, Suspense } from 'react';
import { Edit, Plus, LucideIcon, Link, Unlink, LayoutGrid } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getIconComponent } from '../../utils/iconUtils';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { LAYOUT } from '../../constants/layout';
import { WidgetRenderer, WidgetStateMessage } from '../../shared/widgets';
import WidgetErrorBoundary from '../../components/widgets/WidgetErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getWidgetComponent, getWidgetIcon, getWidgetMetadata, getWidgetConfigConstraints } from '../../widgets/registry';
import AddWidgetModal from './components/AddWidgetModal';
import WidgetConfigModal from './components/WidgetConfigModal';
import WidgetResizeModal from './components/WidgetResizeModal';
import MobileEditDisclaimerModal from './components/MobileEditDisclaimerModal';
import UnlinkConfirmationModal from './components/UnlinkConfirmationModal';
import RelinkConfirmationModal from './components/RelinkConfirmationModal';
import UnsavedChangesModal from './components/UnsavedChangesModal';
import DashboardEditBar from './components/DashboardEditBar';
import { useDashboardEdit } from '../../context/DashboardEditContext';
import DevDebugOverlay from '../../components/dev/DevDebugOverlay';
import { useDragAutoScroll } from '../../hooks/useDragAutoScroll';
import { configApi } from '../../api/endpoints';
// Grid wrapper - encapsulates RGL and provides library-agnostic API
import { FramerrDashboardGrid } from '../../shared/grid';
import '../../styles/GridLayout.css';
import logger from '../../utils/logger';
import { useNotifications } from '../../context/NotificationContext';
import type { FramerrWidget } from '../../../shared/types/widget';

// Shared layout hook
import { useDashboardLayout } from '../../hooks/useDashboardLayout';

// Dashboard-specific hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardHandlers } from './hooks/useDashboardHandlers';


/**
 * Dashboard - Main dashboard page using shared layout engine
 * 
 * Thin orchestrator that combines:
 * - useDashboardLayout: Grid/layout state management
 * - useDashboardData: API fetching, integrations, preferences
 * - useDashboardHandlers: Actions, saves, event handling
 */

const Dashboard = (): React.JSX.Element => {
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const { error: showError } = useNotifications();
    const dashboardEditContext = useDashboardEdit();

    // ========== SHARED LAYOUT HOOK ==========
    const layoutHook = useDashboardLayout({
        initialWidgets: [],
        initialMobileWidgets: [],
        initialMobileLayoutMode: 'linked',
        isMobile,
    });

    const {
        widgets,
        mobileWidgets,
        layouts,
        mobileLayoutMode,
        pendingUnlink,
        editMode,
        hasUnsavedChanges,
        currentBreakpoint,
        isUserDragging,
        displayWidgets,
        gridProps,
        setEditMode,
        addWidget,
        deleteWidget,
        cancelEditing,
        commitChanges,
        setInitialData,
        updateWidgetConfig,
        resizeWidget,
        setWidgets,
        setDisplayWidgetsUnified,
        canUndo,
        canRedo,
        undo,
        redo,
        clearHistory,
    } = layoutHook;

    // ========== DATA HOOK ==========
    const dataHook = useDashboardData({
        user,
        setInitialData,
    });

    const {
        loading,
        setLoading,
        saving,
        setSaving,
        isGlobalDragEnabled,
        setGlobalDragEnabled,
        isUsingTouch,
        setIsUsingTouch,
        widgetVisibility,
        handleWidgetVisibilityChange,
        greetingEnabled,
        setGreetingEnabled,
        greetingText,
        setGreetingText,
        mobileDisclaimerDismissed,
        setMobileDisclaimerDismissed,
        hideMobileEditButton,
        debugOverlayEnabled,
        widgetPixelSizes,
        setWidgetPixelSizes,
        userIsAdmin,
        hasWidgetAccess,
        fetchWidgets,
    } = dataHook;

    // ========== HANDLERS HOOK ==========
    const handlersHook = useDashboardHandlers({
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
        setGreetingEnabled,
        setGreetingText,
        dashboardEditContext,
        showError,
    });

    const {
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
    } = handlersHook;

    // ========== RESIZE MODAL STATE ==========
    const [resizeModalWidgetId, setResizeModalWidgetId] = React.useState<string | null>(null);

    // ========== AUTO-SCROLL HOOK ==========
    const {
        onDragStart: autoScrollDragStart,
        onDragStop: autoScrollDragStop,
    } = useDragAutoScroll({ enabled: editMode });

    // iOS PWA workaround - set inline styles for resize handles
    useEffect(() => {
        if (!editMode || !isMobile) return;

        const handles = document.querySelectorAll('.react-resizable-handle');
        handles.forEach((handle) => {
            const el = handle as HTMLElement;
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'none';
        });

        return () => {
            handles.forEach((handle) => {
                const el = handle as HTMLElement;
                el.style.pointerEvents = '';
                el.style.touchAction = '';
            });
        };
    }, [editMode, isMobile, widgets]);

    // Dynamically adjust widget heights when visibility changes
    const prevVisibilityRef = useRef<Record<string, boolean>>({});
    const prevEditModeRef = useRef<boolean>(false);
    useEffect(() => {
        if (!widgets.length) return;

        const editModeJustEnabled = editMode && !prevEditModeRef.current;
        prevEditModeRef.current = editMode;

        if (editModeJustEnabled || editMode) return;

        const visibilityChanged = Object.keys(widgetVisibility).some(
            key => widgetVisibility[key] !== prevVisibilityRef.current[key]
        ) || Object.keys(prevVisibilityRef.current).some(
            key => prevVisibilityRef.current[key] !== widgetVisibility[key]
        );

        prevVisibilityRef.current = { ...widgetVisibility };

        if (!visibilityChanged) return;
    }, [widgetVisibility, widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, editMode]);

    // Track widget pixel sizes for debug overlay
    useEffect(() => {
        if (!debugOverlayEnabled) return;

        const updateSizes = () => {
            const widgetElements = document.querySelectorAll('[data-widget-id]');
            const sizes: Record<string, { w: number; h: number }> = {};
            widgetElements.forEach((el) => {
                const widgetId = el.getAttribute('data-widget-id');
                if (widgetId) {
                    const rect = el.getBoundingClientRect();
                    const computed = window.getComputedStyle(el);
                    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
                    const paddingRight = parseFloat(computed.paddingRight) || 0;
                    const paddingTop = parseFloat(computed.paddingTop) || 0;
                    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
                    sizes[widgetId] = {
                        w: Math.round(rect.width - paddingLeft - paddingRight),
                        h: Math.round(rect.height - paddingTop - paddingBottom)
                    };
                }
            });
            setWidgetPixelSizes(sizes);
        };

        updateSizes();

        const observer = new ResizeObserver(() => updateSizes());
        const widgetElements = document.querySelectorAll('[data-widget-id]');
        widgetElements.forEach((el) => observer.observe(el));
        window.addEventListener('resize', updateSizes);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSizes);
        };
    }, [debugOverlayEnabled, widgets, mobileWidgets, layouts, setWidgetPixelSizes]);

    // Listen for widgets-added event to refetch
    useEffect(() => {
        const handleWidgetsAdded = (): void => {
            logger.debug('widgets-added event received, reloading dashboard');
            fetchWidgets();
        };

        // Also listen for widget-config-updated (dispatched by fallback persistence)
        const handleConfigUpdated = (): void => {
            logger.debug('widget-config-updated event received, reloading dashboard');
            fetchWidgets();
        };

        window.addEventListener('widgets-added', handleWidgetsAdded);
        window.addEventListener('widget-config-updated', handleConfigUpdated);
        return () => {
            window.removeEventListener('widgets-added', handleWidgetsAdded);
            window.removeEventListener('widget-config-updated', handleConfigUpdated);
        };
    }, [fetchWidgets]);

    // ========== RENDER WIDGET ==========

    const renderWidget = (widget: FramerrWidget): React.JSX.Element | null => {
        const WidgetComponent = getWidgetComponent(widget.type);
        const defaultIcon = getWidgetIcon(widget.type);
        const metadata = getWidgetMetadata(widget.type);

        if (!WidgetComponent) return null;

        // Check widget type access for non-admin users
        const hasAccess = hasWidgetAccess(widget.type);

        // If no access, show "access revoked" state
        if (!hasAccess) {
            return (
                <WidgetRenderer
                    widget={widget}
                    mode="live"
                    title={widget.config?.title as string || metadata?.name || 'Widget'}
                    icon={defaultIcon as LucideIcon}
                    editMode={editMode}
                    onEdit={() => handleEditWidget(widget.id)}
                    onMoveResize={() => setResizeModalWidgetId(widget.id)}
                    onDuplicate={() => handleDuplicateWidget(widget.id)}
                    onDelete={handleDeleteWidget}
                    flatten={false}
                    showHeader={true}
                >
                    <WidgetStateMessage
                        variant="noAccess"
                        serviceName={widget.config?.title as string || metadata?.name || 'Widget'}
                    />
                </WidgetRenderer>
            );
        }

        let Icon: LucideIcon | React.FC;
        if (widget.config?.customIcon) {
            const customIconValue = widget.config.customIcon as string;
            Icon = getIconComponent(customIconValue);
        } else {
            Icon = defaultIcon;
        }

        const smLayout = layouts.sm.find(l => l.id === widget.id);
        const yPos = smLayout?.y ?? '?';

        // Note: paddingSize is now controlled by plugin configConstraints.contentPadding
        // WidgetRenderer reads this directly from the registry

        return (
            <WidgetRenderer
                widget={widget}
                mode="live"
                title={widget.config?.title as string || getWidgetMetadata(widget.type)?.name || 'Widget'}
                icon={Icon as LucideIcon}
                editMode={editMode}
                isMobile={isMobile}
                onEdit={() => handleEditWidget(widget.id)}
                onMoveResize={() => setResizeModalWidgetId(widget.id)}
                onDuplicate={() => handleDuplicateWidget(widget.id)}
                onDelete={handleDeleteWidget}
                flatten={widget.config?.flatten as boolean || false}
                showHeader={widget.config?.showHeader !== false}
            >
                {debugOverlayEnabled && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            zIndex: 100
                        }}
                    >
                        sm.y: {yPos}
                    </div>
                )}
                <WidgetErrorBoundary>
                    <Suspense fallback={<LoadingSpinner />}>
                        <WidgetComponent
                            widget={widget}
                            isEditMode={editMode}
                            onVisibilityChange={handleWidgetVisibilityChange}
                            setGlobalDragEnabled={setGlobalDragEnabled}
                        />
                    </Suspense>
                </WidgetErrorBoundary>
            </WidgetRenderer>
        );
    };

    // ========== RENDER ==========

    if (loading) {
        return <div className="h-full w-full flex items-center justify-center"><LoadingSpinner /></div>;
    }

    const isEmpty = widgets.length === 0;

    return (
        <div className={`w-full min-h-screen max-w-[2000px] mx-auto fade-in p-2 md:p-8 ${editMode ? 'dashboard-edit-mode' : ''}`}>
            {/* Header */}
            <header className={`flex items-center justify-between transition-[margin] duration-300 ${(greetingEnabled || editMode) ? 'mb-8' : 'mb-4'}`}>
                <div>
                    <h1 className="text-4xl font-bold mb-2 gradient-text">
                        Welcome back, {user?.displayName || user?.username || 'User'}
                    </h1>
                    <AnimatePresence mode="wait">
                        {editMode ? (
                            <motion.div
                                key="edit-info"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{
                                    duration: 0.35,
                                    ease: [0.4, 0, 0.2, 1],
                                    opacity: { duration: 0.2 }
                                }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div>
                                    <p className="text-lg text-slate-400">
                                        Editing mode - Drag to rearrange widgets
                                    </p>
                                    {isMobile && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span
                                                className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium ${(mobileLayoutMode === 'independent' || pendingUnlink)
                                                    ? 'bg-warning/20 text-warning'
                                                    : 'bg-success/20 text-success'
                                                    }`}
                                            >
                                                {(mobileLayoutMode === 'independent' || pendingUnlink) ? (
                                                    <>
                                                        <Unlink size={12} />
                                                        Independent
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link size={12} />
                                                        Linked
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : greetingEnabled ? (
                            <motion.p
                                key="greeting"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-lg text-slate-400"
                            >
                                {greetingText}
                            </motion.p>
                        ) : null}
                    </AnimatePresence>
                    {debugOverlayEnabled && (
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                    backgroundColor: mobileLayoutMode === 'linked' ? '#3b82f680' : '#22c55e80',
                                    color: '#fff'
                                }}
                            >
                                {mobileLayoutMode.toUpperCase()}
                            </span>
                            {pendingUnlink && (
                                <span className="text-xs px-2 py-1 rounded bg-orange-500/50 text-white">
                                    PENDING UNLINK
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {!editMode && !(isMobile && hideMobileEditButton) && (
                        <button
                            onPointerUp={(e) => {
                                const isTouch = e.pointerType === 'touch';
                                handleToggleEdit(isTouch);
                            }}
                            className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary rounded-lg transition-all duration-300 flex items-center gap-2"
                        >
                            <Edit size={16} />
                            Edit
                        </button>
                    )}
                </div>
            </header>

            {/* Desktop Edit Bar */}
            <AnimatePresence>
                {editMode && !isMobile && (
                    <DashboardEditBar
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                        mobileLayoutMode={mobileLayoutMode}
                        pendingUnlink={pendingUnlink}
                        isMobile={isMobile}
                        hasUnsavedChanges={hasUnsavedChanges}
                        saving={saving}
                        onAddWidget={handleAddWidget}
                        onRelink={() => setShowRelinkConfirmation(true)}
                        onSave={handleSave}
                        onCancel={handleCancel}
                    />
                )}
            </AnimatePresence>

            {/* Grid Layout or Empty State */}
            <div
                className="dashboard-grid-area relative"
                style={{
                    transition: 'margin-top 300ms ease-out',
                    // When empty, fill remaining viewport height (accounting for header/edit bar ~200px)
                    minHeight: isEmpty ? 'calc(100dvh - 200px)' : '400px',
                }}
            >

                {/* Grid - always rendered for drop target */}
                <FramerrDashboardGrid
                    widgets={displayWidgets}
                    layouts={layouts}
                    editMode={editMode}
                    isMobile={isMobile}
                    currentBreakpoint={currentBreakpoint}
                    widgetVisibility={widgetVisibility}
                    isGlobalDragEnabled={isGlobalDragEnabled}
                    onDragStart={() => {
                        gridProps.onDragStart();
                        autoScrollDragStart();
                    }}
                    onDragStop={() => autoScrollDragStop()}
                    onResizeStart={() => {
                        gridProps.onResizeStart();
                        autoScrollDragStart();
                    }}
                    onLayoutCommit={(event) => {
                        gridProps.onLayoutCommit(event);
                        autoScrollDragStop();
                    }}
                    onExternalWidgetDrop={(event) => {
                        // Use layout info from external drop event
                        // NOTE: Do NOT pass event.id - we intentionally want the React widget
                        // to have a DIFFERENT ID so the sync effect replaces the dirty drop element
                        // (which has morph/card content) with a fresh clean element
                        handleAddWidgetFromModal(event.widgetType, {
                            x: event.x,
                            y: event.y,
                            w: event.w,
                            h: event.h,
                        });
                    }}
                    onBreakpointChange={gridProps.onBreakpointChange}
                    renderWidget={renderWidget}
                    debugOverlayEnabled={debugOverlayEnabled}
                    mobileLayoutMode={mobileLayoutMode}
                    pendingUnlink={pendingUnlink}
                    emptyOverlay={isEmpty ? (
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
                                onClick={handleAddWidget}
                                className="absolute inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors pointer-events-auto z-30 whitespace-nowrap"
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
                    ) : undefined}
                />
            </div>

            {/* Debug Overlay */}
            {debugOverlayEnabled && (
                <DevDebugOverlay
                    mobileLayoutMode={mobileLayoutMode}
                    pendingUnlink={pendingUnlink}
                    currentBreakpoint={currentBreakpoint}
                    editMode={editMode}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isMobile={isMobile}
                    isUserDragging={isUserDragging}
                    widgets={widgets}
                    mobileWidgets={mobileWidgets}
                    layouts={layouts}
                    widgetVisibility={widgetVisibility}
                    widgetPixelSizes={widgetPixelSizes}
                />
            )}

            {/* Add Widget Modal */}
            <AddWidgetModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddWidget={handleAddWidgetFromModal}
            />

            {/* Mobile Edit Disclaimer Modal */}
            <MobileEditDisclaimerModal
                isOpen={showMobileDisclaimer}
                onContinue={() => {
                    setShowMobileDisclaimer(false);
                    setEditMode(true);
                }}
                onCancel={() => setShowMobileDisclaimer(false)}
                onDismissForever={async () => {
                    setMobileDisclaimerDismissed(true);
                    try {
                        await configApi.updateUser({
                            preferences: { mobileEditDisclaimerDismissed: true }
                        });
                    } catch (error) {
                        logger.error('Failed to save mobile disclaimer preference:', { error });
                    }
                }}
            />

            {/* Unlink Confirmation Modal */}
            <UnlinkConfirmationModal
                isOpen={showUnlinkConfirmation}
                onConfirm={performSave}
                onCancel={() => setShowUnlinkConfirmation(false)}
            />

            {/* Relink Confirmation Modal */}
            <RelinkConfirmationModal
                isOpen={showRelinkConfirmation}
                onConfirm={async () => {
                    setShowRelinkConfirmation(false);
                    setEditMode(false);
                    await handleResetMobileLayout();
                }}
                onCancel={() => setShowRelinkConfirmation(false)}
            />

            {/* Navigation Guard Modals */}
            {dashboardEditContext?.pendingDestination && pendingUnlink && (
                <UnlinkConfirmationModal
                    isOpen={true}
                    onConfirm={handleSaveAndNavigate}
                    onCancel={handleCancelNavigation}
                    onDiscard={handleDiscardAndNavigate}
                />
            )}
            {dashboardEditContext?.pendingDestination && !pendingUnlink && hasUnsavedChanges && (
                <UnsavedChangesModal
                    isOpen={true}
                    onSave={handleSaveAndNavigate}
                    onCancel={handleCancelNavigation}
                    onDiscard={handleDiscardAndNavigate}
                />
            )}

            {/* Widget Config Modal */}
            {configModalWidgetId && (() => {
                // Use displayWidgets so we get the correct config for the current breakpoint
                // (mobile independent mode has its own config separate from desktop)
                const widget = displayWidgets.find(w => w.id === configModalWidgetId);
                if (!widget) return null;
                // Get current height from the correct breakpoint layout
                const breakpoint = isMobile ? 'sm' : 'lg';
                const layoutItem = layouts[breakpoint].find(l => l.id === widget.id);
                const widgetHeight = layoutItem?.h ?? widget.layout.h;
                return (
                    <WidgetConfigModal
                        isOpen={true}
                        onClose={() => setConfigModalWidgetId(null)}
                        widgetId={widget.id}
                        widgetType={widget.type}
                        widgetHeight={widgetHeight}
                        currentConfig={widget.config || {}}
                        onSave={handleSaveWidgetConfig}
                        onResize={resizeWidget}
                    />
                );
            })()}

            {/* Widget Resize Modal */}
            {resizeModalWidgetId && (() => {
                const widget = widgets.find(w => w.id === resizeModalWidgetId);
                if (!widget) return null;
                // Get current layout from grid state
                const breakpoint = isMobile ? 'sm' : 'lg';
                const layoutItem = layouts[breakpoint].find(l => l.id === widget.id);
                // Use FramerrWidget.layout or .mobileLayout based on breakpoint
                const widgetLayout = breakpoint === 'sm' ? widget.mobileLayout : widget.layout;
                const currentLayout = {
                    x: layoutItem?.x ?? widgetLayout?.x ?? 0,
                    y: layoutItem?.y ?? widgetLayout?.y ?? 0,
                    w: layoutItem?.w ?? widgetLayout?.w ?? 4,
                    h: layoutItem?.h ?? widgetLayout?.h ?? 2,
                };
                return (
                    <WidgetResizeModal
                        isOpen={true}
                        onClose={() => setResizeModalWidgetId(null)}
                        widgetId={widget.id}
                        widgetType={widget.type}
                        widgetName={widget.config?.title as string || getWidgetMetadata(widget.type)?.name || 'Widget'}
                        currentLayout={currentLayout}
                        currentShowHeader={widget.config?.showHeader !== false}
                        isMobile={isMobile}
                        onSave={(id, layout) => {
                            resizeWidget(id, layout);
                            setResizeModalWidgetId(null);
                        }}
                        onConfigUpdate={updateWidgetConfig}
                    />
                );
            })()}

            {/* Bottom Spacer */}
            <div style={{ height: isMobile ? LAYOUT.TABBAR_HEIGHT + LAYOUT.PAGE_MARGIN : LAYOUT.PAGE_MARGIN }} aria-hidden="true" />
        </div>
    );
};

export default Dashboard;
