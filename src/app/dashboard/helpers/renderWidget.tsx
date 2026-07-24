import React, { Suspense } from 'react';
import type { LucideIcon } from 'lucide-react';
import { getIconComponent } from '../../../utils/iconUtils';
import { WidgetRenderer, WidgetStateMessage, resolveWidgetChrome } from '../../../shared/widgets';
import type { ChromeIntegrationRef, ChromeSchemaRef } from '../../../shared/widgets';
import WidgetErrorBoundary from '@/shared/widgets/WidgetErrorBoundary';
import { LoadingSpinner } from '@/shared/ui';
import { getWidgetComponent, getWidgetIcon } from '../../../widgets/registry';
import type { FramerrWidget } from '../../../../shared/types/widget';
import type { LayoutItem } from '../../../shared/grid/core/types';

/**
 * createRenderWidget - Factory function for the dashboard's widget rendering.
 *
 * Extracted from Dashboard.tsx to isolate the widget rendering logic.
 * Returns a render function that takes a FramerrWidget and produces JSX.
 */

export interface RenderWidgetDeps {
    editMode: boolean;
    isMobile: boolean;
    schemas: Record<string, ChromeSchemaRef> | undefined;
    integrations: ChromeIntegrationRef[];
    layouts: { sm: LayoutItem[]; lg: LayoutItem[] };
    debugOverlayEnabled: boolean;
    handleEditWidget: (widgetId: string) => void;
    setResizeModalWidgetId: (widgetId: string | null) => void;
    handleDuplicateWidget: (widgetId: string) => void;
    handleDeleteWidget: (widgetId: string) => void;
    handleWidgetVisibilityChange: (widgetId: string, visible: boolean) => void;
    setGlobalDragEnabled: (enabled: boolean) => void;
    hasWidgetAccess: (widgetType: string) => boolean;
}

export function createRenderWidget(deps: RenderWidgetDeps): (widget: FramerrWidget) => React.JSX.Element | null {
    const {
        editMode,
        isMobile,
        schemas,
        integrations,
        layouts,
        debugOverlayEnabled,
        handleEditWidget,
        setResizeModalWidgetId,
        handleDuplicateWidget,
        handleDeleteWidget,
        handleWidgetVisibilityChange,
        setGlobalDragEnabled,
        hasWidgetAccess,
    } = deps;

    return (widget: FramerrWidget): React.JSX.Element | null => {
        const WidgetComponent = getWidgetComponent(widget.type);
        const defaultIcon = getWidgetIcon(widget.type);

        if (!WidgetComponent) return null;

        const chrome = resolveWidgetChrome({
            widget,
            schemas,
            integrations,
        });
        const Icon = (getIconComponent(chrome.iconName) || defaultIcon) as LucideIcon;

        // Check widget type access for non-admin users
        const hasAccess = hasWidgetAccess(widget.type);

        // If no access, show "access revoked" state
        if (!hasAccess) {
            return (
                <WidgetRenderer
                    widget={widget}
                    mode="live"
                    title={chrome.title}
                    icon={Icon}
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
                        serviceName={chrome.title}
                    />
                </WidgetRenderer>
            );
        }

        const smLayout = layouts.sm.find(l => l.id === widget.id);
        const yPos = smLayout?.y ?? '?';

        return (
            <WidgetRenderer
                widget={widget}
                mode="live"
                title={chrome.title}
                icon={Icon}
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
                            backgroundColor: 'var(--bg-overlay)',
                            color: 'var(--text-primary)',
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
                <WidgetErrorBoundary widgetType={widget.type}>
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
}
