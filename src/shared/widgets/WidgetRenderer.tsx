/**
 * WidgetRenderer Component
 * 
 * Unified widget container for grid/layout views:
 * - Dashboard (live mode)
 * - Template Builder (preview mode)
 * - Thumbnails (thumbnail mode)
 * 
 * Provides consistent wrapper, header, and edit controls across all contexts.
 * 
 * Header visibility is controlled by the Adaptive Header system:
 * - 'soft' mode (default): Header shows if preference ON and container height >= threshold
 * - 'hard' mode: Header visibility strictly determined by container height
 */

import React, { useRef } from 'react';
import { Card } from '../../components/common/Card';
import WidgetActionsPopover from '../../app/dashboard/components/WidgetActionsPopover';
import { canWidgetShowHeader, getWidgetContentPadding } from '../../widgets/registry';
import { CornerResizeIndicators } from './CornerResizeIndicators';
import { useAdaptiveHeader } from './hooks/useAdaptiveHeader';
import type { WidgetRendererProps } from './WidgetRenderer.types';
import './WidgetRenderer.css';

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
    widget,
    mode,
    title,
    icon: Icon,
    showHeader = true,
    scale = 1,
    flatten = false,
    paddingSize = 'default',
    editMode = false,
    isMobile = false,
    onEdit,
    onMoveResize,
    onDuplicate,
    onDelete,
    children,
}) => {
    // Container ref for ResizeObserver-based header calculations
    const containerRef = useRef<HTMLDivElement>(null);

    // Use adaptive header system for live resize animations
    const { effectiveShowHeader } = useAdaptiveHeader({
        widgetType: widget.type,
        showHeaderPreference: showHeader,
        containerRef,
    });

    // Check header support from plugin constraints (supportsHeader flag)
    // Note: canWidgetShowHeader without height returns true if widget supports header at all
    const supportsHeader = canWidgetShowHeader(widget.type);
    const shouldShowHeader = supportsHeader ? effectiveShowHeader : false;

    // Determine padding class from plugin constraints
    // Plugin contentPadding is the source of truth; paddingSize prop is only used as fallback
    const pluginPadding = getWidgetContentPadding(widget.type);
    // Map plugin values to CSS class names: 'none'='none', 'sm'='compact', 'md'='default', 'lg'='relaxed'
    const paddingClassMap: Record<string, string> = {
        'none': 'none',
        'sm': 'compact',
        'md': 'default',
        'lg': 'relaxed',
    };
    const actualPaddingSize = paddingClassMap[pluginPadding] ?? paddingSize;

    // Build content class with fluid padding
    // In edit mode, add edit-disabled class to block internal clicks (except .edit-clickable elements)
    const contentClass = `widget-content flex-1 overflow-auto widget-padding-${actualPaddingSize}${editMode ? ' edit-disabled' : ''}`;

    // Handler for delete that passes the widget ID
    const handleDelete = onDelete ? () => onDelete(widget.id) : undefined;

    // Thumbnail mode - minimal rendering, scaled down
    if (mode === 'thumbnail') {
        return (
            <div
                className="widget-renderer-thumbnail"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
                <Card
                    className={`widget-wrapper h-full overflow-hidden flex flex-col relative ${flatten ? 'flatten-mode' : ''}`}
                    padding="none"
                >
                    {shouldShowHeader && (
                        <div className="widget-header h-[36px] flex items-center justify-between px-3 border-b border-theme">
                            <div className="flex items-center gap-2.5 min-w-0">
                                {Icon && (
                                    <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                                        <Icon size={14} className="text-accent" />
                                    </div>
                                )}
                                <h3 className="text-sm font-semibold text-theme-primary truncate">
                                    {title || 'Widget'}
                                </h3>
                            </div>
                        </div>
                    )}
                    <div className={contentClass}>
                        {children}
                    </div>
                </Card>
            </div>
        );
    }

    // Preview mode - used in Template Builder
    if (mode === 'preview') {
        return (
            <div ref={containerRef} className="h-full w-full">
                <Card
                    className={`widget-wrapper h-full overflow-hidden flex flex-col relative ${flatten ? 'flatten-mode' : ''}`}
                    padding="none"
                >
                    {/* Widget Header - with adaptive collapse */}
                    <div
                        className={`widget-header-wrapper ${shouldShowHeader ? '' : 'widget-header--collapsed'}`}
                    >
                        {supportsHeader && (
                            <div className="widget-header h-[36px] flex items-center justify-between px-3 border-b border-theme">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {Icon && (
                                        <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                                            <Icon size={14} className="text-accent" />
                                        </div>
                                    )}
                                    <h3 className="text-sm font-semibold text-theme-primary truncate">
                                        {title || 'Widget'}
                                    </h3>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview mode: floating delete button - always absolute top-right */}
                    {editMode && onDelete && (
                        <div className="widget-edit-controls absolute top-[6px] right-[6px] z-50 no-drag">
                            <button
                                onClick={handleDelete}
                                className="w-6 h-6 rounded bg-theme-secondary/80 flex items-center justify-center text-theme-secondary hover:text-error hover:bg-error/20 transition-colors"
                                title="Remove from template"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <div className={contentClass}>
                        {children}
                    </div>
                </Card>
            </div>
        );
    }

    // Live mode - Dashboard with full popover controls
    return (
        <div ref={containerRef} className="h-full w-full">
            <Card
                className={`widget-wrapper h-full overflow-hidden flex flex-col relative ${flatten ? 'flatten-mode' : ''}`}
                padding="none"
            >
                {/* Widget Header - conditionally rendered with transition */}
                <div
                    className={`widget-header-wrapper ${shouldShowHeader ? '' : 'widget-header--collapsed'}`}
                >
                    {supportsHeader && (
                        <div className="widget-header h-[36px] flex items-center justify-between px-3 border-b border-theme">
                            <div className="flex items-center gap-2.5 min-w-0">
                                {Icon && (
                                    <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                                        <Icon size={14} className="text-accent" />
                                    </div>
                                )}
                                <h3 className="text-sm font-semibold text-theme-primary truncate">
                                    {title || 'Widget'}
                                </h3>
                            </div>
                        </div>
                    )}
                </div>

                {/* Config button - single absolute render, centered in header area */}
                {editMode && (
                    <div className="widget-edit-controls absolute top-[6px] right-[6px] z-50 no-drag">
                        <WidgetActionsPopover
                            widgetId={widget.id}
                            onEdit={onEdit}
                            onMoveResize={onMoveResize}
                            onDuplicate={onDuplicate}
                            onDelete={handleDelete}
                        />
                    </div>
                )}

                {/* Widget Content - uses fluid padding class */}
                <div className={contentClass}>
                    {children}
                </div>

                {/* Corner and Side Resize Indicators */}
                <CornerResizeIndicators
                    visible={editMode}
                    isMobile={isMobile}
                />
            </Card>
        </div>
    );
};

export default WidgetRenderer;
