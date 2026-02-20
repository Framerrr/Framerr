import React, { ChangeEvent } from 'react';
import { getWidgetMetadata, getWidgetIconName, getWidgetConfigConstraints } from '../../../widgets/registry';
import { useWidgetConfigUI } from '../../../shared/widgets';
import IconPicker from '../../../components/IconPicker';
import { Input } from '../../../components/common/Input';
import { Button, ConfirmButton } from '../../../shared/ui';
import { Switch } from '@/shared/ui';
import type { Widget, WidgetConfig } from '../types';

interface WidgetCardProps {
    widget: Widget;
    isRemoving: boolean;
    isConfirmingRemove: boolean;
    onRemove: (widgetId: string) => Promise<void>;
    onConfirmRemove: (widgetId: string | null) => void;
    onIconSelect: (widgetId: string, iconName: string) => Promise<void>;
    onUpdateConfig: (widgetId: string, configUpdates: Partial<WidgetConfig>) => Promise<void>;
    onResize?: (widgetId: string, size: { w?: number; h?: number }) => Promise<void>;
}

/**
 * Individual widget card with customization options
 * 
 * Displays widget info, icon picker, custom name input,
 * and toggle options for flatten/header settings.
 */
export const WidgetCard: React.FC<WidgetCardProps> = ({
    widget,
    isRemoving,
    isConfirmingRemove,
    onRemove,
    onConfirmRemove,
    onIconSelect,
    onUpdateConfig,
    onResize
}) => {
    const metadata = getWidgetMetadata(widget.type);
    const customIcon = widget.config?.customIcon;

    // Centralized config UI state from plugin constraints
    const widgetHeight = widget.layout.h;
    const configUI = useWidgetConfigUI(widget.type, widgetHeight);

    return (
        <div className="bg-theme-tertiary rounded-xl p-4 sm:p-6 border border-theme">
            {/* Header Row */}
            <div className="flex items-start gap-2 sm:gap-4 mb-3 sm:mb-4">
                {/* Icon - Compact on mobile, full on desktop */}
                <div className="flex-shrink-0">
                    <IconPicker
                        value={customIcon || getWidgetIconName(widget.type)}
                        onChange={(iconName: string) => onIconSelect(widget.id, iconName)}
                        compact
                    />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-theme-primary mb-1 truncate text-sm sm:text-base">
                        {widget.config?.title || metadata?.name || widget.type}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[10px] sm:text-xs text-theme-secondary">
                        <span className="whitespace-nowrap">{metadata?.name || widget.type}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">
                            {widget.layout.w}x{widget.layout.h}
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="hidden xs:inline whitespace-nowrap">
                            ({widget.layout.x},{widget.layout.y})
                        </span>
                    </div>
                </div>

                {/* Delete Button - IconOnly ConfirmButton */}
                <div className="flex-shrink-0">
                    <ConfirmButton
                        onConfirm={() => onRemove(widget.id)}
                        size="md"
                        confirmMode="iconOnly"
                        anchorButton="cancel"
                        expandDirection="left"
                        disabled={isRemoving}
                    />
                </div>
            </div>

            {/* Customization Section */}
            <div className="space-y-3 pt-3 border-t border-theme">
                {/* Custom Name Input */}
                <Input
                    label="Custom Name"
                    placeholder={metadata?.name || widget.type}
                    value={widget.config?.customName || ''}
                    onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                        await onUpdateConfig(widget.id, {
                            customName: e.target.value,
                            title: e.target.value || metadata?.name || widget.type
                        });
                    }}
                />

                {/* Toggle Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Flatten Mode Toggle */}
                    <div className="flex items-center justify-between p-3 bg-theme-tertiary/30 rounded-lg border border-theme">
                        <div>
                            <div className="text-sm font-medium text-theme-primary">Flat Design</div>
                            <div className="text-xs text-theme-tertiary mt-0.5">Remove glassmorphism</div>
                        </div>
                        <Switch
                            checked={widget.config?.flatten || false}
                            onCheckedChange={async (checked: boolean) => {
                                await onUpdateConfig(widget.id, { flatten: checked });
                            }}
                        />
                    </div>

                    {/* Header Toggle - Visibility and disabled state from plugin constraints */}
                    {configUI.showHeaderToggle && (
                        <div
                            className={`flex items-center justify-between p-3 bg-theme-tertiary/30 rounded-lg border border-theme ${configUI.headerToggleDisabled ? 'opacity-50' : ''}`}
                            title={configUI.headerDisabledReason}
                        >
                            <div>
                                <div className="text-sm font-medium text-theme-primary">Header</div>
                                <div className="text-xs text-theme-tertiary mt-0.5">
                                    {configUI.headerToggleDisabled ? 'Resize to enable' : 'Show icon and name'}
                                </div>
                            </div>
                            <Switch
                                checked={widget.config?.showHeader !== false}
                                onCheckedChange={async (checked: boolean) => {
                                    if (!configUI.headerToggleDisabled) {
                                        // Update config
                                        await onUpdateConfig(widget.id, { showHeader: checked });

                                        // If hard mode, also resize widget
                                        if (configUI.headerTriggersResize && onResize) {
                                            const constraints = getWidgetConfigConstraints(widget.type);
                                            const threshold = constraints.minHeightForHeader ?? 2;
                                            await onResize(widget.id, { h: checked ? threshold : 1 });
                                        }
                                    }
                                }}
                                disabled={configUI.headerToggleDisabled}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
