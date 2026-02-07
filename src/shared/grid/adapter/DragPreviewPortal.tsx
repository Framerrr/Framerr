/**
 * DragPreviewPortal - Renders React widgets into drag helper elements.
 * 
 * HOW IT WORKS:
 * 1. setupExternalDragSources creates a DOM element with data-drag-preview-type="clock"
 * 2. DragPreviewPortal uses MutationObserver to detect these elements
 * 3. When found, it renders the widget component into the element via portal
 * 4. When element is removed (drag ends), portal is cleaned up
 * 
 * This bridges the gap between GridStack's vanilla JS helper and React components.
 * 
 * CONTEXT-AWARE RENDERING:
 * - Dashboard (previewMode=false): Renders REAL widgets with live data
 * - Template Builder (previewMode=true): Renders PREVIEW widgets with mock data
 * 
 * Based on: prototypes/gridstack/components/DragPreviewPortal.tsx
 */

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Production widget registry
import { getWidgetComponent, getWidgetMetadata } from '../../../widgets/registry';

// Integration data hook - uses React Query cache
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';

// Types
import type { FramerrWidget } from '../../../../shared/types/widget';

// ============================================================================
// TYPES
// ============================================================================

interface DragPreview {
    id: string;
    element: HTMLElement;
    widgetType: string;
}

export interface DragPreviewPortalProps {
    /**
     * Preview mode determines widget rendering:
     * - false = Dashboard: Real widget with live data binding
     * - true = Builder: Preview widget with mock data
     */
    previewMode: boolean;

    /**
     * For Dashboard mode: function to get integration binding for the widget.
     * Called with widget type, returns integration instance ID if one should be bound.
     * 
     * This mimics the "Add to Dashboard" button behavior where integration
     * is auto-selected based on available instances.
     */
    getIntegrationBinding?: (widgetType: string) => string | null;

    /**
     * For Dashboard mode: the same renderWidget function used by the grid.
     * When provided, the preview will render widgets EXACTLY like the grid does.
     */
    renderWidget?: (widget: FramerrWidget) => ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Manages React portals for drag preview widgets.
 * Mount this component at the surface level (Dashboard or Template Builder).
 */
export function DragPreviewPortal({ previewMode, getIntegrationBinding, renderWidget }: DragPreviewPortalProps) {
    const [previews, setPreviews] = useState<DragPreview[]>([]);

    // Watch for drag preview elements in the DOM
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Check added nodes for drag preview targets
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        // Check if this element or its children have drag-preview-type
                        const previewEl = node.matches('[data-drag-preview-type]')
                            ? node
                            : node.querySelector('[data-drag-preview-type]');

                        if (previewEl && previewEl instanceof HTMLElement) {
                            const widgetType = previewEl.dataset.dragPreviewType;
                            const previewId = previewEl.dataset.dragPreviewId || `preview-${Date.now()}`;

                            if (widgetType) {
                                setPreviews(prev => {
                                    // Avoid duplicates
                                    if (prev.some(p => p.id === previewId)) return prev;
                                    return [...prev, {
                                        id: previewId,
                                        element: previewEl,
                                        widgetType,
                                    }];
                                });
                            }
                        }
                    }
                });

                // Check removed nodes to clean up
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        const previewEl = node.matches('[data-drag-preview-type]')
                            ? node
                            : node.querySelector('[data-drag-preview-type]');

                        if (previewEl && previewEl instanceof HTMLElement) {
                            const previewId = previewEl.dataset.dragPreviewId;
                            if (previewId) {
                                setPreviews(prev => prev.filter(p => p.id !== previewId));
                            }
                        }
                    }
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, []);

    // Cleanup orphaned previews (element no longer in DOM)
    useEffect(() => {
        const cleanup = setInterval(() => {
            setPreviews(prev => prev.filter(p => document.body.contains(p.element)));
        }, 500);

        return () => clearInterval(cleanup);
    }, []);

    return (
        <>
            {previews.map(preview => (
                <PreviewWidget
                    key={preview.id}
                    preview={preview}
                    previewMode={previewMode}
                    getIntegrationBinding={getIntegrationBinding}
                    renderWidget={renderWidget}
                />
            ))}
        </>
    );
}

// ============================================================================
// PREVIEW WIDGET RENDERER
// ============================================================================

interface PreviewWidgetProps {
    preview: DragPreview;
    previewMode: boolean;
    getIntegrationBinding?: (widgetType: string) => string | null;
    renderWidget?: (widget: FramerrWidget) => ReactNode;
}

/**
 * Renders a single preview widget into its portal container.
 */
function PreviewWidget({ preview, previewMode, getIntegrationBinding, renderWidget }: PreviewWidgetProps) {
    const Component = getWidgetComponent(preview.widgetType);
    const metadata = getWidgetMetadata(preview.widgetType);

    // Get all integrations from React Query cache (no new API calls)
    const { data: allIntegrations = [] } = useRoleAwareIntegrations();

    if (!Component) {
        // Unknown widget - render fallback
        return createPortal(
            <div
                className="bg-theme-tertiary text-theme-secondary flex items-center justify-center h-full rounded-lg"
                style={{ fontSize: '12px' }}
            >
                Unknown: {preview.widgetType}
            </div>,
            preview.element
        );
    }

    // Get integration binding - use callback if provided, otherwise lookup from cache
    const integrationId = useMemo(() => {
        if (previewMode) return undefined;

        // If callback provided, use it
        if (getIntegrationBinding) {
            return getIntegrationBinding(preview.widgetType);
        }

        // Otherwise lookup from cached integrations
        const compatibleTypes = metadata?.compatibleIntegrations || [];
        if (compatibleTypes.length === 0) return undefined;

        // Find first enabled integration instance of a compatible type
        for (const integrationType of compatibleTypes) {
            const instance = allIntegrations.find(
                (int: { type: string; enabled: boolean }) =>
                    int.type === integrationType && int.enabled
            );
            if (instance) {
                return instance.id;
            }
        }
        return undefined;
    }, [previewMode, getIntegrationBinding, preview.widgetType, metadata?.compatibleIntegrations, allIntegrations]);

    // Build FULL widget config matching handleAddWidgetFromModal pattern
    // This ensures drag preview looks identical to the actual widget
    const widgetConfig: Record<string, unknown> = {
        ...metadata?.defaultConfig, // Apply plugin defaults (e.g., showHeader: false)
        title: metadata?.name,
        integrationId,
    };

    // Build widgetData as FramerrWidget format
    const widgetData: FramerrWidget = {
        id: preview.id,
        type: preview.widgetType,
        config: widgetConfig,
        layout: { x: 0, y: 0, w: metadata?.defaultSize?.w || 4, h: metadata?.defaultSize?.h || 2 },
    };

    // If renderWidget is provided, use it for TRUE rendering parity
    // This renders the widget EXACTLY like it would appear on the grid
    // Works for both Dashboard mode and Template Builder mode
    if (renderWidget) {
        const renderedContent = renderWidget(widgetData);
        return createPortal(
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}
            >
                {renderedContent}
            </div>,
            preview.element
        );
    }

    // Fallback: render component directly (when no renderWidget provided)
    return createPortal(
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'var(--bg-primary, #0f172a)',
            }}
        >
            <div style={{ width: '100%', height: '100%' }}>
                <Component
                    widget={widgetData}
                    previewMode={previewMode}
                />
            </div>
        </div>,
        preview.element
    );
}
