import React from 'react';
import AddWidgetModal from './AddWidgetModal';
import WidgetConfigModal from './WidgetConfigModal';
import WidgetResizeModal from './WidgetResizeModal';
import MobileEditDisclaimerModal from './MobileEditDisclaimerModal';
import UnlinkConfirmationModal from './UnlinkConfirmationModal';
import RelinkConfirmationModal from './RelinkConfirmationModal';
import UnsavedChangesModal from './UnsavedChangesModal';
import { configApi } from '../../../api/endpoints';
import { getWidgetMetadata } from '../../../widgets/registry';
import logger from '../../../utils/logger';
import type { FramerrWidget } from '../../../../shared/types/widget';
import type { LayoutItem } from '../../../shared/grid/core/types';

/**
 * DashboardModalStack - All modal surfaces for the Dashboard.
 * 
 * Extracted from Dashboard.tsx to isolate modal composition.
 * All modal state is controlled from the parent orchestrator.
 */

export interface DashboardModalStackProps {
    // Modal open state
    modals: {
        showAddModal: boolean;
        showMobileDisclaimer: boolean;
        showUnlinkConfirmation: boolean;
        showRelinkConfirmation: boolean;
        configModalWidgetId: string | null;
        resizeModalWidgetId: string | null;
    };
    // Modal state setters
    modalSetters: {
        setShowAddModal: (show: boolean) => void;
        setShowMobileDisclaimer: (show: boolean) => void;
        setShowUnlinkConfirmation: (show: boolean) => void;
        setShowRelinkConfirmation: (show: boolean) => void;
        setConfigModalWidgetId: (id: string | null) => void;
        setResizeModalWidgetId: (id: string | null) => void;
    };
    // Handler callbacks
    handlers: {
        handleAddWidgetFromModal: (widgetType: string, position?: { x: number; y: number; w: number; h: number }) => void;
        handleSaveWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
        performSave: () => void;
        handleSaveAndNavigate: () => void;
        handleCancelNavigation: () => void;
        handleDiscardAndNavigate: () => void;
        handleResetMobileLayout: () => Promise<void>;
        resizeWidget: (widgetId: string, layout: { w?: number; h?: number }) => void;
        updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
    };
    // Context data
    context: {
        displayWidgets: FramerrWidget[];
        layouts: { sm: LayoutItem[]; lg: LayoutItem[] };
        isMobile: boolean;
        editMode: boolean;
        hasUnsavedChanges: boolean;
        pendingUnlink: boolean;
        pendingDestination: string | null;
        mobileDisclaimerDismissed: boolean;
        walkthrough: {
            isModalProtected?: boolean;
            state: { suspended?: boolean; isActive?: boolean };
            resume: () => void;
            skip: () => void;
        } | null;
    };
    // Layout hook methods needed by modals
    setEditMode: (mode: boolean) => void;
    setMobileDisclaimerDismissed: (dismissed: boolean) => void;
}

const DashboardModalStack: React.FC<DashboardModalStackProps> = ({
    modals,
    modalSetters,
    handlers,
    context,
    setEditMode,
    setMobileDisclaimerDismissed,
}) => {
    const {
        showAddModal,
        showMobileDisclaimer,
        showUnlinkConfirmation,
        showRelinkConfirmation,
        configModalWidgetId,
        resizeModalWidgetId,
    } = modals;

    const {
        setShowAddModal,
        setShowMobileDisclaimer,
        setShowUnlinkConfirmation,
        setShowRelinkConfirmation,
        setConfigModalWidgetId,
        setResizeModalWidgetId,
    } = modalSetters;

    const {
        handleAddWidgetFromModal,
        handleSaveWidgetConfig,
        performSave,
        handleSaveAndNavigate,
        handleCancelNavigation,
        handleDiscardAndNavigate,
        handleResetMobileLayout,
        resizeWidget,
        updateWidgetConfig,
    } = handlers;

    const {
        displayWidgets,
        layouts,
        isMobile,
        editMode,
        hasUnsavedChanges,
        pendingUnlink,
        pendingDestination,
        walkthrough,
    } = context;

    return (
        <>
            {/* Add Widget Modal */}
            <AddWidgetModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddWidget={async (widgetType: string) => {
                    handleAddWidgetFromModal(widgetType);
                }}
                preventClose={walkthrough?.isModalProtected}
            />

            {/* Mobile Edit Disclaimer Modal */}
            <MobileEditDisclaimerModal
                isOpen={showMobileDisclaimer}
                onContinue={() => {
                    setShowMobileDisclaimer(false);
                    setEditMode(true);
                    // Resume walkthrough — overlay reappears, continues at add-widget-button
                    if (walkthrough?.state.suspended) {
                        walkthrough.resume();
                    }
                }}
                onCancel={() => {
                    setShowMobileDisclaimer(false);
                    // End the walkthrough entirely — user chose not to continue
                    if (walkthrough?.state.isActive) {
                        walkthrough.skip();
                    }
                }}
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
            {pendingDestination && pendingUnlink && (
                <UnlinkConfirmationModal
                    isOpen={true}
                    onConfirm={handleSaveAndNavigate}
                    onCancel={handleCancelNavigation}
                    onDiscard={handleDiscardAndNavigate}
                />
            )}
            {pendingDestination && !pendingUnlink && hasUnsavedChanges && (
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
                const widget = displayWidgets.find(w => w.id === configModalWidgetId);
                if (!widget) return null;
                // Get current height from the correct breakpoint layout
                const breakpoint = isMobile ? 'sm' : 'lg';
                const layoutItem = layouts[breakpoint].find(l => l.id === widget.id);
                const widgetHeight = layoutItem?.h ?? widget.layout.h;
                return (
                    <WidgetConfigModal
                        isOpen={true}
                        onClose={() => {
                            // Don't let Radix outside-click close the modal during walkthrough
                            if (walkthrough?.isModalProtected) return;
                            setConfigModalWidgetId(null);
                        }}
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
                const widget = displayWidgets.find(w => w.id === resizeModalWidgetId);
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
                        allLayouts={layouts[breakpoint]}
                        onSave={(id, layout) => {
                            resizeWidget(id, layout as { w: number; h: number });
                            setResizeModalWidgetId(null);
                        }}
                        onConfigUpdate={updateWidgetConfig}
                    />
                );
            })()}
        </>
    );
};

export default DashboardModalStack;
