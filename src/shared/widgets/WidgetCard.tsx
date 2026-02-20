/**
 * WidgetCard Component
 * 
 * Unified widget selection card for:
 * - Widget Gallery (gallery variant)
 * - Add Widget Modal (modal variant)
 * - Template Builder sidebar (builder variant)
 * 
 * External drag support via GridStack data attributes.
 * When draggable=true, GridStack.setupDragIn() makes these cards draggable.
 */

import React from 'react';
import { Plus, AlertCircle, CheckCircle2, Loader, Share2, User } from 'lucide-react';
import type { WidgetCardProps } from './WidgetCard.types';
import { isWidgetShareable, getWidgetConfigConstraints } from '../../widgets/registry';

export const WidgetCard: React.FC<WidgetCardProps> = ({
    widget,
    variant,
    onAdd,
    onShare,
    isAdding = false,
    shareLoading = false,
    disabled = false,
    integrations = {},
    hasAdminAccess = false,
    sharedBy,
    draggable = false,
    fillContainer = false,
}) => {
    const Icon = widget.icon;
    const compatibleTypes = widget.compatibleIntegrations || [];
    const hasIntegrations = compatibleTypes.length > 0;

    // Check if at least one compatible integration is configured
    const isIntegrationReady = !hasIntegrations ||
        compatibleTypes.some((intType: string) => integrations[intType]?.isConfigured);

    // ========== GRIDSTACK DATA ATTRIBUTES ==========
    // GridStack.setupDragIn() looks for these attributes to enable external drag
    const gsDataAttrs = draggable ? {
        'data-gs-w': widget.defaultSize.w,
        'data-gs-h': widget.defaultSize.h,
        'data-widget-type': widget.type,
        'data-widget-constraints': JSON.stringify(getWidgetConfigConstraints(widget.type!)),
    } : {};

    // CSS class for GridStack.setupDragIn() selector
    // Different classes for different source contexts
    const getDragClass = () => {
        if (!draggable) return '';
        switch (variant) {
            case 'modal': return 'modal-widget palette-item';
            case 'builder': return 'builder-widget palette-item';
            case 'gallery': return 'gallery-widget palette-item';
            default: return 'palette-item';
        }
    };

    // Builder variant - compact display (no drag support)
    if (variant === 'builder') {
        return (
            <div className="glass-subtle rounded-lg p-3 border border-theme hover:border-accent/50 transition-all">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg flex-shrink-0">
                        <Icon size={18} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-theme-primary text-sm truncate">{widget.name}</h4>
                        <span className="text-xs text-theme-tertiary">
                            {widget.defaultSize.w}×{widget.defaultSize.h}
                        </span>
                    </div>
                    {onAdd && (
                        <button
                            onClick={() => onAdd(widget.type!)}
                            disabled={disabled || isAdding}
                            className="p-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-all"
                        >
                            {isAdding ? (
                                <Loader size={16} className="animate-spin" />
                            ) : (
                                <Plus size={16} />
                            )}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Gallery/Modal variants - full display with GridStack drag support
    return (
        <div
            className={`bg-theme-tertiary ${getDragClass()} rounded-xl p-${variant === 'gallery' ? '6' : '5'} border border-theme ${draggable ? 'hover:border-accent/50 cursor-grab active:cursor-grabbing' : ''} flex flex-col transition-all`}
            style={{
                ...(fillContainer && { width: '100%', height: '100%', overflow: 'hidden' })
            }}
            {...gsDataAttrs}
        >
            {/* Header */}
            <div className="flex items-start gap-4 mb-3">
                <div className="p-3 bg-accent/20 rounded-lg flex-shrink-0">
                    <Icon size={24} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-theme-primary mb-1">{widget.name}</h4>
                    <p className="text-sm text-theme-secondary line-clamp-2">{widget.description}</p>
                </div>
            </div>

            {/* Info Badges */}
            <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
                <span className="px-2 py-1 bg-theme-tertiary rounded text-theme-secondary">
                    {widget.defaultSize.w}×{widget.defaultSize.h}
                </span>

                {/* Integration badges for admin */}
                {hasAdminAccess && hasIntegrations && (
                    isIntegrationReady ? (
                        // Show badge for each configured integration
                        compatibleTypes
                            .filter((intType: string) => integrations[intType]?.isConfigured)
                            .map((intType: string) => (
                                <div key={intType} className="flex items-center gap-1 px-2 py-1 rounded bg-success/20 text-success">
                                    <CheckCircle2 size={12} />
                                    <span className="capitalize">{intType}</span>
                                </div>
                            ))
                    ) : (
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-warning/20 text-warning">
                            <AlertCircle size={12} />
                            <span>Needs Setup</span>
                        </div>
                    )
                )}

                {/* Shared by badge (non-admin view) */}
                {!hasAdminAccess && sharedBy && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-info/20 text-info">
                        {variant === 'modal' ? <Share2 size={12} /> : <User size={12} />}
                        <span>Shared by {sharedBy}</span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-auto">
                {onAdd && (
                    <button
                        onClick={() => onAdd(widget.type!)}
                        disabled={disabled || isAdding}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-all font-medium"
                    >
                        {isAdding ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                <span>Adding...</span>
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                <span>{variant === 'modal' ? 'Add to Dashboard' : 'Add'}</span>
                            </>
                        )}
                    </button>
                )}
                {variant === 'gallery' && hasAdminAccess && onShare && isWidgetShareable(widget.type!) && (
                    <button
                        onClick={() => onShare(widget)}
                        disabled={shareLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-theme-tertiary hover:bg-theme-hover border border-theme text-theme-primary rounded-lg transition-all font-medium"
                        title="Share this widget with users"
                    >
                        <Share2 size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default WidgetCard;
