import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { LAYOUT } from '../../constants/layout';
import { getWidgetConfigConstraints } from '../../widgets/registry';
import { useIntegrationSchemas } from '../../api/hooks';
import { useDashboardEdit } from '../../context/DashboardEditContext';
import { useWalkthrough } from '../../features/walkthrough';
import DevDebugOverlay from '../../components/dev/DevDebugOverlay';
import { useDragAutoScroll } from '../../hooks/useDragAutoScroll';
import { useResizeHeightLock } from '../../hooks/useResizeHeightLock';
import { FramerrDashboardGrid } from '../../shared/grid';
import '../../styles/GridLayout.css';
import { useNotifications } from '../../context/NotificationContext';
import PullToRefresh from '../../shared/ui/PullToRefresh';
import { getLoadingMessage } from '../../utils/greetings';

// Shared layout hook
import { useDashboardLayout } from '../../hooks/useDashboardLayout';

// Dashboard-specific hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardHandlers } from './hooks/useDashboardHandlers';
import { useDashboardEffects } from './hooks/useDashboardEffects';

// Extracted components
import DashboardHeader from './components/DashboardHeader';
import DashboardEmptyState from './components/DashboardEmptyState';
import DashboardEditOverlay from './components/DashboardEditOverlay';
import DashboardModalStack from './components/DashboardModalStack';
import { createRenderWidget } from './helpers/renderWidget';


/**
 * Dashboard - Main dashboard page using shared layout engine
 * 
 * Thin orchestrator that combines:
 * - useDashboardLayout: Grid/layout state management
 * - useDashboardData: API fetching, integrations, preferences
 * - useDashboardHandlers: Actions, saves, event handling
 * - useDashboardEffects: Standalone effects (events, splash, debug)
 */

const Dashboard = (): React.JSX.Element => {
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const { error: showError } = useNotifications();
    const dashboardEditContext = useDashboardEdit();
    const walkthrough = useWalkthrough();

    // Integration schemas for icon resolution (customIcon → integration icon → widget default)
    const { data: schemas } = useIntegrationSchemas();

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
        greetingMode,
        setGreetingMode,
        greetingText,
        setGreetingText,
        headerVisible,
        setHeaderVisible,
        taglineEnabled,
        setTaglineEnabled,
        taglineText,
        setTaglineText,
        tones,
        setTones,
        loadingMessagesEnabled,
        setLoadingMessagesEnabled,
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
        setGreetingMode,
        setGreetingText,
        setHeaderVisible,
        setTaglineEnabled,
        setTaglineText,
        setTones,
        setLoadingMessagesEnabled,
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

    // Auto-suspend walkthrough while mobile edit disclaimer is showing
    React.useEffect(() => {
        if (showMobileDisclaimer && walkthrough?.state.isActive && !walkthrough.state.suspended) {
            walkthrough.suspend();
        }
    }, [showMobileDisclaimer, walkthrough]);

    // ========== RESIZE MODAL STATE ==========
    const [resizeModalWidgetId, setResizeModalWidgetId] = React.useState<string | null>(null);

    // ========== EFFECTS HOOK ==========
    // Loading message - memoized so it persists during a single load
    const loadingMsg = useMemo(() => {
        if (!loadingMessagesEnabled) return null;
        return getLoadingMessage(user?.displayName || user?.username || 'User');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingMessagesEnabled, user?.displayName, user?.username]);

    const { squareCells } = useDashboardEffects({
        editMode,
        isMobile,
        widgets,
        mobileWidgets,
        layouts,
        mobileLayoutMode,
        pendingUnlink,
        widgetVisibility,
        debugOverlayEnabled,
        loading,
        loadingMsg,
        setWidgetPixelSizes,
        fetchWidgets,
    });

    // ========== AUTO-SCROLL HOOK ==========
    const {
        onDragStart: autoScrollDragStart,
        onDragStop: autoScrollDragStop,
        setDownOnly: autoScrollSetDownOnly,
    } = useDragAutoScroll({ enabled: editMode });

    // ========== RESIZE HEIGHT LOCK ==========
    const {
        containerRef: gridAreaRef,
        onResizeStart: heightLockStart,
        onResizeStop: heightLockStop,
    } = useResizeHeightLock();

    // ========== RENDER WIDGET ==========
    const renderWidget = createRenderWidget({
        editMode,
        isMobile,
        schemas,
        layouts,
        debugOverlayEnabled,
        handleEditWidget,
        setResizeModalWidgetId,
        handleDuplicateWidget,
        handleDeleteWidget,
        handleWidgetVisibilityChange,
        setGlobalDragEnabled,
        hasWidgetAccess,
    });

    // ========== RENDER ==========

    // Splash screen covers the viewport while loading — render nothing underneath
    if (loading) {
        return <div className="h-full w-full" />;
    }

    const isEmpty = displayWidgets.length === 0;

    return (
        <div
            className={`w-full min-h-full max-w-[2000px] mx-auto fade-in p-2 md:p-4 ${editMode ? 'dashboard-edit-mode' : ''}`}
            style={{ alignSelf: 'flex-start' }}
        >
            {/* Mobile pull-to-refresh — disabled during edit mode */}
            {!editMode && <PullToRefresh />}

            {/* Header — greeting, edit button, tagline */}
            <DashboardHeader
                user={user}
                greetingMode={greetingMode}
                greetingText={greetingText}
                tones={tones}
                headerVisible={headerVisible}
                taglineEnabled={taglineEnabled}
                taglineText={taglineText}
                editMode={editMode}
                isMobile={isMobile}
                hideMobileEditButton={hideMobileEditButton}
                mobileLayoutMode={mobileLayoutMode}
                pendingUnlink={pendingUnlink}
                debugOverlayEnabled={debugOverlayEnabled}
                onToggleEdit={handleToggleEdit}
            />

            {/* Edit mode overlay — subtitle, edit bar, mobile badge */}
            <DashboardEditOverlay
                editMode={editMode}
                isMobile={isMobile}
                taglineEnabled={taglineEnabled}
                headerVisible={headerVisible}
                mobileLayoutMode={mobileLayoutMode}
                pendingUnlink={pendingUnlink}
                hasUnsavedChanges={hasUnsavedChanges}
                saving={saving}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onAddWidget={() => handleAddWidget()}
                onRelink={() => setShowRelinkConfirmation(true)}
                onSave={handleSave}
                onCancel={handleCancel}
            />

            {/* Grid Layout or Empty State */}
            <div
                ref={gridAreaRef}
                className="dashboard-grid-area relative"
                data-walkthrough="dashboard-grid"
                style={{
                    minHeight: isEmpty ? 'calc(100dvh - 200px)' : '400px',
                    paddingBottom: editMode ? '200px' : undefined,
                }}
            >
                <FramerrDashboardGrid
                    widgets={displayWidgets}
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
                        autoScrollSetDownOnly(true);
                        autoScrollDragStart();
                        heightLockStart();
                    }}
                    onLayoutCommit={(event) => {
                        gridProps.onLayoutCommit(event);
                        autoScrollDragStop();
                        if (event.reason === 'resize') {
                            heightLockStop();
                            autoScrollSetDownOnly(false);
                        }
                    }}
                    onExternalWidgetDrop={(event) => {
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
                    squareCells={squareCells}
                    emptyOverlay={isEmpty ? (
                        <DashboardEmptyState onAddWidget={handleAddWidget} />
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

            {/* Modal Stack */}
            <DashboardModalStack
                modals={{
                    showAddModal,
                    showMobileDisclaimer,
                    showUnlinkConfirmation,
                    showRelinkConfirmation,
                    configModalWidgetId,
                    resizeModalWidgetId,
                }}
                modalSetters={{
                    setShowAddModal,
                    setShowMobileDisclaimer,
                    setShowUnlinkConfirmation,
                    setShowRelinkConfirmation,
                    setConfigModalWidgetId,
                    setResizeModalWidgetId,
                }}
                handlers={{
                    handleAddWidgetFromModal,
                    handleSaveWidgetConfig,
                    performSave,
                    handleSaveAndNavigate,
                    handleCancelNavigation,
                    handleDiscardAndNavigate,
                    handleResetMobileLayout,
                    resizeWidget,
                    updateWidgetConfig,
                }}
                context={{
                    displayWidgets,
                    layouts,
                    isMobile,
                    editMode,
                    hasUnsavedChanges,
                    pendingUnlink,
                    pendingDestination: dashboardEditContext?.pendingDestination ?? null,
                    mobileDisclaimerDismissed,
                    walkthrough: walkthrough ? {
                        isModalProtected: walkthrough.isModalProtected,
                        state: walkthrough.state,
                        resume: walkthrough.resume,
                        skip: walkthrough.skip,
                    } : null,
                }}
                setEditMode={setEditMode}
                setMobileDisclaimerDismissed={setMobileDisclaimerDismissed}
            />

            {/* Bottom Spacer */}
            <div style={{ height: isMobile ? LAYOUT.TABBAR_HEIGHT + LAYOUT.PAGE_MARGIN : LAYOUT.PAGE_MARGIN }} aria-hidden="true" />
        </div>
    );
};

export default Dashboard;
