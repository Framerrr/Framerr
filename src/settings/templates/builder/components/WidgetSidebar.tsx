/**
 * WidgetSidebar - Collapsible sidebar for adding widgets to template
 * 
 * Displays available widgets organized by category.
 * Supports:
 * - Drag to add widgets (via GridStack external drag)
 * - Click to add widgets (Plus button fallback)
 */

import React from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WidgetMetadata, getWidgetConfigConstraints } from '../../../../widgets/registry';
import { getWidgetConfigConstraints as getConstraints } from '../../../../widgets/registry';

interface WidgetsByCategory {
    [category: string]: WidgetMetadata[];
}

interface WidgetSidebarProps {
    /** Whether sidebar is expanded */
    isOpen: boolean;
    /** Toggle sidebar open/closed */
    onToggle: () => void;
    /** Widgets organized by category */
    widgetsByCategory: WidgetsByCategory;
    /** Callback when widget is added */
    onAddWidget: (widgetType: string) => void;
    /** Whether adding widgets is disabled (e.g., mobile linked mode) */
    disabled?: boolean;
}

// ============================================================================
// DraggableWidgetCard - Single draggable widget card (GridStack)
// ============================================================================

interface DraggableWidgetCardProps {
    widget: WidgetMetadata;
    onAddWidget: (widgetType: string) => void;
    disabled: boolean;
}

function DraggableWidgetCard({ widget, onAddWidget, disabled }: DraggableWidgetCardProps) {
    const Icon = widget.icon;
    const widgetType = widget.type!;

    // GridStack data attributes for external drag
    const gsDataAttrs = !disabled ? {
        'data-gs-w': widget.defaultSize.w,
        'data-gs-h': widget.defaultSize.h,
        'data-widget-type': widgetType,
        'data-widget-constraints': JSON.stringify(getConstraints(widgetType)),
    } : {};

    return (
        <div
            className={`palette-item w-full flex items-center gap-2 p-2 rounded-lg
                       bg-theme-primary hover:bg-theme-hover border border-theme
                       transition-colors text-left group select-none
                       ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            style={{
                touchAction: 'none', // Prevent scrolling while dragging
            }}
            {...gsDataAttrs}
        >
            <div className="p-1.5 rounded bg-accent/20 text-accent">
                <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-theme-primary truncate">
                    {widget.name}
                </div>
                <div className="text-xs text-theme-tertiary">
                    {widget.defaultSize.w}×{widget.defaultSize.h}
                </div>
            </div>
            {/* Plus button as click fallback - stops propagation to prevent drag */}
            <Plus
                size={14}
                className="text-theme-tertiary group-hover:text-accent cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    onAddWidget(widgetType);
                }}
            />
        </div>
    );
}

// ============================================================================
// WidgetSidebar - Main component
// ============================================================================

export const WidgetSidebar: React.FC<WidgetSidebarProps> = ({
    isOpen,
    onToggle,
    widgetsByCategory,
    onAddWidget,
    disabled = false,
}) => {
    return (
        <div
            className={`flex-shrink-0 bg-theme-secondary border-r border-theme transition-all duration-300 flex flex-col ${isOpen ? 'w-72' : 'w-12'
                }`}
        >
            {isOpen ? (
                <div className="flex flex-col h-full min-h-0">
                    {/* Sidebar Header */}
                    <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-theme">
                        <span className="font-medium text-theme-primary text-sm">Add Widget</span>
                        <button
                            onClick={onToggle}
                            className="p-1 rounded hover:bg-theme-hover text-theme-secondary"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>

                    {/* Widget List - ONLY SCROLLABLE ELEMENT */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                        {Object.entries(widgetsByCategory).map(([category, widgets]) => (
                            <div key={category}>
                                <div className="text-xs font-medium text-theme-tertiary uppercase tracking-wide mb-2 px-2">
                                    {category}
                                </div>
                                <div className="space-y-1">
                                    {widgets.map(widget => (
                                        widget.type ? (
                                            <DraggableWidgetCard
                                                key={widget.type}
                                                widget={widget}
                                                onAddWidget={onAddWidget}
                                                disabled={disabled}
                                            />
                                        ) : null
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <button
                    onClick={onToggle}
                    className="w-full h-full flex items-center justify-center hover:bg-theme-hover text-theme-secondary"
                >
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    );
};

export default WidgetSidebar;
