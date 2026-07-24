import React, { ChangeEvent, useMemo } from 'react';
import { getWidgetMetadata, getWidgetConfigConstraints } from '../../../widgets/registry';
import { useWidgetConfigUI } from '../../../shared/widgets/hooks/useWidgetConfigUI';
import { resolveWidgetChrome } from '../../../shared/widgets';
import type { ChromeIntegrationRef, ChromeSchemaRef } from '../../../shared/widgets';
import IconPicker from '../../../components/IconPicker';
import { Input } from '@/shared/ui';
import { ConfirmButton } from '../../../shared/ui';
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
    schemas?: Record<string, ChromeSchemaRef> | null;
    integrations?: ChromeIntegrationRef[];
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
    onRemove,
    onIconSelect,
    onUpdateConfig,
    onResize,
    schemas,
    integrations = [],
}) => {
    const metadata = getWidgetMetadata(widget.type);

    const chrome = useMemo(
        () =>
            resolveWidgetChrome({
                widget: { type: widget.type, config: widget.config || {} },
                schemas,
                integrations,
            }),
        [widget.type, widget.config, schemas, integrations]
    );

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
                        value={chrome.iconName}
                        onChange={(iconName: string) => onIconSelect(widget.id, iconName)}
                        compact
                    />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-theme-primary mb-1 truncate text-sm sm:text-base">
                        {chrome.title}
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
                {/* Custom Name Input — title is canonical for chrome; customName kept in sync for settings UI */}
                <Input
                    label="Custom Name"
                    placeholder={metadata?.name || widget.type}
                    value={
                        widget.config?.titleOverridden
                            ? (widget.config?.customName || widget.config?.title || '')
                            : chrome.title
                    }
                    onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                        const next = e.target.value;
                        if (!next.trim()) {
                            await onUpdateConfig(widget.id, {
                                customName: undefined,
                                title: undefined,
                                titleOverridden: false,
                            });
                            return;
                        }
                        await onUpdateConfig(widget.id, {
                            customName: next,
                            title: next,
                            titleOverridden: true,
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
                                        await onUpdateConfig(widget.id, { showHeader: checked });

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
