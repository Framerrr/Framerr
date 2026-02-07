/**
 * TemplateBuilderStep3 - Review and save screen
 * 
 * Displays:
 * - Live grid preview with mock widgets (matching Step 2 styling)
 * - Desktop/Mobile toggle with mobile layout mode banner
 * - Template info (name, category, description, widget count)
 * 
 * Actions:
 * - Cancel
 * - Save
 * - Save & Apply
 * - Save & Share (admin only)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Monitor, Smartphone, Link, Unlink } from 'lucide-react';
import { TemplateGrid } from '../../../shared/widgets/TemplateGrid';
import type { TemplateData } from './TemplateBuilder';

type ViewMode = 'desktop' | 'mobile';

interface Step3Props {
    data: TemplateData;
    onSave?: (template: TemplateData) => void;
    onShare?: (template: TemplateData & { id: string }) => void;
    onClose: () => void;
    isAdmin?: boolean;
    onSaveAction?: (action: 'save' | 'apply' | 'share') => void;
    saving?: boolean;
    saveAction?: 'save' | 'apply' | 'share' | null;
    onReady?: () => void;
}

const TemplateBuilderStep3: React.FC<Step3Props> = ({
    data,
    onSave,
    onShare,
    onClose,
    isAdmin = false,
    onSaveAction,
    saving: externalSaving,
    saveAction: externalSaveAction,
    onReady,
}) => {
    // Use external saving state if handleSave is managed by parent
    const saving = externalSaving ?? false;
    const saveAction = externalSaveAction ?? null;
    const [viewMode, setViewMode] = useState<ViewMode>('desktop');

    // Container measurement for scale calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(600);

    // Get mobile layout mode from data
    const mobileLayoutMode = data.mobileLayoutMode || 'linked';

    // Measure container width for scaling
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();
        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Signal ready after container measured
    useEffect(() => {
        if (containerWidth > 0) {
            onReady?.();
        }
    }, [containerWidth, onReady]);

    // Get widgets for current view mode
    const displayWidgets = useMemo(() => {
        if (viewMode === 'mobile' && mobileLayoutMode === 'independent' && data.mobileWidgets) {
            return data.mobileWidgets;
        }
        return data.widgets;
    }, [viewMode, mobileLayoutMode, data.widgets, data.mobileWidgets]);

    // Get unique widget types for display
    const getWidgetTypes = () => {
        const types = new Set(data.widgets.map(w => w.type));
        return Array.from(types);
    };

    const widgetTypes = getWidgetTypes();

    return (
        <div className="space-y-6">
            {/* Live Grid Preview - matches Step 2 / Preview Modal styling */}
            <div className="rounded-lg border border-theme overflow-hidden">
                {/* Toolbar - matches Step 2 styling */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-theme bg-theme-secondary">
                    <div className="flex items-center gap-2">
                        {/* Desktop/Mobile Toggle - with text labels like Step 2 */}
                        <div className="flex items-center gap-1 bg-theme-primary rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'desktop'
                                    ? 'bg-accent text-white'
                                    : 'text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                <Monitor size={14} />
                                Desktop
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'mobile'
                                    ? 'bg-accent text-white'
                                    : 'text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                <Smartphone size={14} />
                                Mobile
                            </button>
                        </div>
                    </div>

                    {/* Widget count */}
                    <div className="text-xs text-theme-tertiary">
                        {displayWidgets.length} widget{displayWidgets.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Mobile Layout Mode Status Banner - matches Step 2 */}
                <div className="flex-shrink-0 px-4 py-2 border-b border-theme bg-theme-secondary flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        {mobileLayoutMode === 'linked' ? (
                            <Link size={14} className="text-info" />
                        ) : (
                            <Unlink size={14} className="text-warning" />
                        )}
                        <span className="text-theme-secondary">
                            {mobileLayoutMode === 'linked'
                                ? 'Mobile layout auto-generated from desktop'
                                : 'Mobile layout customized independently'}
                        </span>
                    </div>
                </div>

                {/* Preview Grid */}
                <div
                    ref={containerRef}
                    className="max-h-[250px] overflow-y-auto custom-scrollbar bg-theme-primary"
                >
                    {displayWidgets.length === 0 ? (
                        <div className="flex items-center justify-center h-[150px] text-theme-tertiary">
                            <p className="text-sm">No widgets added</p>
                        </div>
                    ) : (
                        <TemplateGrid
                            widgets={displayWidgets}
                            viewMode={viewMode}
                            mobileLayoutMode={mobileLayoutMode}
                            editMode={false}
                            containerWidth={containerWidth}
                        />
                    )}
                </div>
            </div>

            {/* Template Info */}
            <div className="space-y-3 p-4 rounded-lg bg-theme-secondary border border-theme">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-sm text-theme-tertiary">Name</div>
                        <div className="font-medium text-theme-primary">{data.name || 'Untitled'}</div>
                    </div>
                </div>

                {data.description && (
                    <div>
                        <div className="text-sm text-theme-tertiary">Description</div>
                        <div className="text-theme-secondary text-sm">{data.description}</div>
                    </div>
                )}

                <div className="flex gap-6">
                    <div>
                        <div className="text-sm text-theme-tertiary">Category</div>
                        <div className="text-theme-primary">
                            {data.categoryId ? 'Custom' : 'None'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-theme-tertiary">Widgets</div>
                        <div className="text-theme-primary">
                            {data.widgets.length === 0
                                ? 'None'
                                : widgetTypes.length <= 3
                                    ? widgetTypes.join(', ')
                                    : `${widgetTypes.slice(0, 3).join(', ')} +${widgetTypes.length - 3} more`
                            }
                            {data.widgets.length > 0 && ` (${data.widgets.length} total)`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateBuilderStep3;
