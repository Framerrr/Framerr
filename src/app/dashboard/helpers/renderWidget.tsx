import React, { Suspense } from 'react';
import type { LucideIcon } from 'lucide-react';
import { getIconComponent } from '../../../utils/iconUtils';
import { WidgetRenderer, WidgetStateMessage } from '../../../shared/widgets';
import WidgetErrorBoundary from '../../../components/widgets/WidgetErrorBoundary';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { getWidgetComponent, getWidgetIcon, getWidgetMetadata } from '../../../widgets/registry';
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
    schemas: Record<string, { name?: string; icon?: string }> | undefined;
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

        // Only resolve integration icon/name for single-type widgets (e.g., overseerr, plex, sonarr).
        // Multi-type widgets (media-search, calendar, system-status) keep their own identity.
        const compatibleTypes = metadata?.compatibleIntegrations || [];
        const isSingleTypeWidget = compatibleTypes.length === 1;
        const integrationId = widget.config?.integrationId as string | undefined;

        let Icon: LucideIcon | React.FC;
        if (widget.config?.customIcon) {
            // User explicitly picked an icon
            const customIconValue = widget.config.customIcon as string;
            Icon = getIconComponent(customIconValue);
        } else if (isSingleTypeWidget && integrationId && schemas) {
            // Single-type widget with bound integration → use integration icon
            const intType = integrationId.split('-')[0];
            const schemaIcon = schemas[intType]?.icon;
            Icon = schemaIcon ? getIconComponent(schemaIcon) : defaultIcon;
        } else {
            Icon = defaultIcon;
        }

        // Title resolution chain: config.title (if customized) → integration name → widget default
        const storedTitle = widget.config?.title as string;
        const defaultName = metadata?.name || 'Widget';
        const isDefaultTitle = !storedTitle || storedTitle === defaultName;
        let resolvedTitle: string;

        if (!isDefaultTitle) {
            // User set a custom title — use it
            resolvedTitle = storedTitle;
        } else if (isSingleTypeWidget && integrationId && schemas) {
            // Single-type widget → use integration schema name
            const intType = integrationId.split('-')[0];
            resolvedTitle = schemas[intType]?.name || defaultName;
        } else {
            resolvedTitle = defaultName;
        }

        const smLayout = layouts.sm.find(l => l.id === widget.id);
        const yPos = smLayout?.y ?? '?';

        return (
            <WidgetRenderer
                widget={widget}
                mode="live"
                title={resolvedTitle}
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
}
