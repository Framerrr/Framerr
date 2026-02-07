/**
 * EditorToolbar - Toolbar for template editor
 * 
 * Contains view mode toggle, undo/redo, and widget config controls.
 */

import React from 'react';
import { Eye, EyeOff, Layers, Share2, Undo2, Redo2 } from 'lucide-react';
import { Select, IntegrationDropdown } from '../../../../shared/ui';
import { getWidgetMetadata } from '../../../../widgets/registry';
import { hasSensitiveConfig } from '../../../../../shared/widgetIntegrations';
import type { TemplateData, TemplateWidget } from '../types';

interface IntegrationInstance {
    id: string;
    name: string;
    type: string;
    displayName?: string;
}

interface EditorToolbarProps {
    // Undo/Redo
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    isEditable: boolean;

    // Selected widget
    selectedWidget: TemplateWidget | undefined;
    selectedWidgetIndex: number | null;

    // Widget config updates
    onUpdateWidgetConfig: (updates: Partial<{ showHeader: boolean; flatten: boolean }>) => void;

    // Share controls (admin only)
    isAdmin: boolean;
    integrationInstances: IntegrationInstance[];
    data: TemplateData;
    onChange: (updates: Partial<TemplateData>) => void;
    onDraftSave?: (widgets?: TemplateWidget[]) => void;

    // Widget count display
    widgetCount: number;

    // Mobile customize mode - determines which widget array to update
    isMobileCustomMode?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    isEditable,
    selectedWidget,
    selectedWidgetIndex,
    onUpdateWidgetConfig,
    isAdmin,
    integrationInstances,
    data,
    onChange,
    onDraftSave,
    widgetCount,
    isMobileCustomMode = false,
}) => {
    // Determine which widget array to update based on mode
    const widgetArray = isMobileCustomMode ? (data.mobileWidgets || []) : data.widgets;
    const updateKey = isMobileCustomMode ? 'mobileWidgets' : 'widgets';
    return (
        <div className="flex-shrink-0 h-12 flex items-center justify-between gap-4 px-4 border-b border-theme bg-theme-secondary rounded-t-lg">
            <div className="flex-1 min-w-0 flex items-center gap-2">
                {/* Undo/Redo Buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo || !isEditable}
                        className={`p-2 rounded-lg transition-colors ${canUndo && isEditable
                            ? 'hover:bg-theme-hover text-theme-primary'
                            : 'text-theme-tertiary opacity-50 cursor-not-allowed'
                            }`}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo || !isEditable}
                        className={`p-2 rounded-lg transition-colors ${canRedo && isEditable
                            ? 'hover:bg-theme-hover text-theme-primary'
                            : 'text-theme-tertiary opacity-50 cursor-not-allowed'
                            }`}
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>

                {/* Widget Config Controls */}
                {selectedWidget && isEditable && (
                    <>
                        <div className="h-6 w-px bg-theme mx-2" />
                        <div className="flex items-center gap-1 min-w-0">
                            {/* Header Toggle - hidden for link-grid and hard mode widgets */}
                            {(() => {
                                // Get constraints for the widget
                                const metadata = getWidgetMetadata(selectedWidget.type);
                                const constraints = metadata?.configConstraints ?? {};
                                const headerHeightMode = constraints.headerHeightMode ?? 'soft';

                                // Hide toggle for link-grid (no header support) or hard mode (height-controlled)
                                if (selectedWidget.type === 'link-grid') return null;
                                if (headerHeightMode === 'hard') return null;

                                const isServiceStatusAtMinHeight = selectedWidget.type === 'service-status' && selectedWidget.layout?.h === 1;
                                const headerIsOff = selectedWidget.config?.showHeader === false;
                                const cannotEnableHeader = isServiceStatusAtMinHeight && headerIsOff;

                                return (
                                    <button
                                        onClick={() => {
                                            if (cannotEnableHeader) return;
                                            onUpdateWidgetConfig({ showHeader: !(selectedWidget.config?.showHeader !== false) });
                                        }}
                                        disabled={cannotEnableHeader}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${cannotEnableHeader
                                            ? 'text-theme-tertiary opacity-50 cursor-not-allowed'
                                            : selectedWidget.config?.showHeader !== false
                                                ? 'bg-accent/20 text-accent'
                                                : 'text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover'
                                            }`}
                                        title={cannotEnableHeader ? 'Increase widget height to enable header' : 'Toggle widget header'}
                                    >
                                        {selectedWidget.config?.showHeader !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                                        Header
                                    </button>
                                );
                            })()}
                            {/* Flatten Toggle */}
                            <button
                                onClick={() => onUpdateWidgetConfig({ flatten: !selectedWidget.config?.flatten })}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedWidget.config?.flatten
                                    ? 'bg-accent/20 text-accent'
                                    : 'text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover'
                                    }`}
                                title="Toggle flat design"
                            >
                                <Layers size={14} />
                                Flatten
                            </button>
                            {/* Share Config Toggle */}
                            {isAdmin && hasSensitiveConfig(selectedWidget.type) && (
                                <button
                                    onClick={() => {
                                        if (selectedWidgetIndex === null) return;
                                        const newWidgets = widgetArray.map((w, i) =>
                                            i === selectedWidgetIndex
                                                ? { ...w, shareSensitiveConfig: !w.shareSensitiveConfig }
                                                : w
                                        );
                                        onChange({ [updateKey]: newWidgets });
                                        onDraftSave?.(newWidgets);
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedWidget.shareSensitiveConfig
                                        ? 'bg-accent/20 text-accent'
                                        : 'text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover'
                                        }`}
                                    title="Share this widget's config when sharing template"
                                >
                                    <Share2 size={14} />
                                    {selectedWidget.type === 'link-grid' ? 'Share Links' :
                                        selectedWidget.type === 'custom-html' ? 'Share HTML' : 'Share Config'}
                                </button>
                            )}
                            {/* Integration Binding Selector */}
                            {isAdmin && integrationInstances.length > 0 && (() => {
                                const metadata = getWidgetMetadata(selectedWidget.type);
                                const isMultiIntegration = metadata?.multiIntegration === true;
                                const compatibleTypes = metadata?.compatibleIntegrations || [];

                                // Helper to capitalize integration type
                                const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

                                if (isMultiIntegration && compatibleTypes.length > 0) {
                                    // Dynamic multi-select per compatible type
                                    // Now reads from config.*IntegrationIds instead of shareIntegrations
                                    return (
                                        <div className="flex items-center gap-2">
                                            {compatibleTypes.map(type => {
                                                const instancesForType = integrationInstances.filter(i => i.type === type);
                                                if (instancesForType.length === 0) return null;

                                                // Read from config (e.g., config.sonarrIntegrationIds)
                                                const configKey = `${type}IntegrationIds`;
                                                const selectedIds = (selectedWidget.config?.[configKey] as string[] | undefined) || [];

                                                return (
                                                    <IntegrationDropdown
                                                        key={type}
                                                        integrations={instancesForType.map(i => ({
                                                            id: i.id,
                                                            name: i.displayName || i.name,
                                                            type: i.type,
                                                        }))}
                                                        selectedIds={selectedIds}
                                                        onChange={(ids) => {
                                                            if (selectedWidgetIndex === null) return;
                                                            const newWidgets = widgetArray.map((w, i) => {
                                                                if (i !== selectedWidgetIndex) return w;
                                                                // Update config.*IntegrationIds
                                                                const newConfig = { ...w.config };
                                                                if (ids.length > 0) {
                                                                    newConfig[configKey] = ids;
                                                                } else {
                                                                    delete newConfig[configKey];
                                                                }
                                                                return { ...w, config: newConfig };
                                                            });
                                                            onChange({ [updateKey]: newWidgets });
                                                            onDraftSave?.(newWidgets);
                                                        }}
                                                        size="sm"
                                                        placeholder={`Select ${capitalize(type)}...`}
                                                        maxSelections={5}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                // Single-integration widgets - use config.integrationId
                                const currentIntegrationId = selectedWidget.config?.integrationId as string | undefined;
                                return (
                                    <Select
                                        key={currentIntegrationId || 'no-integration'}
                                        value={!currentIntegrationId || currentIntegrationId === '__none__' ? undefined : currentIntegrationId}
                                        onValueChange={(value) => {
                                            if (selectedWidgetIndex === null) return;
                                            const newWidgets = widgetArray.map((w, i) =>
                                                i === selectedWidgetIndex
                                                    ? { ...w, config: { ...w.config, integrationId: value } }
                                                    : w
                                            );
                                            onChange({ [updateKey]: newWidgets });
                                            onDraftSave?.(newWidgets);
                                        }}
                                    >
                                        <Select.Trigger className="!py-1.5 !px-2.5 !text-sm min-w-[100px] max-w-[200px] flex-shrink" aria-label="Bind Integration">
                                            <div className="flex-1 min-w-0 truncate">
                                                {(!currentIntegrationId || currentIntegrationId === '__none__')
                                                    ? <span className="text-theme-secondary">Select Integration</span>
                                                    : <Select.Value />
                                                }
                                            </div>
                                        </Select.Trigger>
                                        <Select.Content>
                                            <Select.Item value="__none__">
                                                <span className="text-theme-secondary">None</span>
                                            </Select.Item>
                                            {integrationInstances.map(int => (
                                                <Select.Item key={int.id} value={int.id}>
                                                    {int.displayName || int.name}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>

            <div className="text-xs text-theme-tertiary">
                {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
            </div>
        </div>
    );
};

export default EditorToolbar;
