/**
 * DisplaySettings - Widget display configuration section
 *
 * Extracted from WidgetConfigModal. Renders icon picker, title input,
 * flatten toggle, and show header toggle.
 */

import React from 'react';
import { Switch } from '../../../../shared/ui';
import { getWidgetIconName } from '../../../../widgets/registry';
import IconPicker from '../../../../components/IconPicker';
import { Input } from '../../../../components/common/Input';
import { Settings } from 'lucide-react';
import type { WidgetConfigUIState } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DisplaySettingsProps {
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
    configUI: WidgetConfigUIState;
    widgetType: string;
    schemas: Record<string, { name?: string; icon?: string; metrics?: { key: string }[] }> | undefined;
    metadataName: string | undefined;
}

// ============================================================================
// Component
// ============================================================================

const DisplaySettings: React.FC<DisplaySettingsProps> = ({
    config,
    updateConfig,
    configUI,
    widgetType,
    schemas,
    metadataName,
}) => {
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-theme-secondary flex items-center gap-2">
                <Settings size={16} />
                Display Settings
            </h4>

            {/* Icon + Title Row */}
            <div className="flex gap-2 items-end">
                <div className="flex-shrink-0 self-end">
                    <IconPicker
                        value={(config.customIcon as string) || (() => {
                            // Resolution chain: customIcon → integration icon → widget default
                            const integrationId = config.integrationId as string | undefined;
                            if (integrationId) {
                                const intType = integrationId.split('-')[0];
                                const schemaIcon = schemas?.[intType]?.icon;
                                if (schemaIcon) return schemaIcon;
                            }
                            return getWidgetIconName(widgetType);
                        })()}
                        onChange={(iconName) => {
                            updateConfig('customIcon', iconName);
                            updateConfig('iconOverridden', true);
                        }}
                        compact
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <Input
                        label="Widget Title"
                        value={(config.title as string) ?? metadataName ?? ''}
                        onChange={(e) => {
                            updateConfig('title', e.target.value);
                            updateConfig('titleOverridden', true);
                        }}
                        placeholder={metadataName || 'Widget'}
                        className="!mb-0"
                    />
                </div>
            </div>

            {/* Flatten Toggle - only show if widget supports it */}
            {configUI.showFlattenToggle && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-theme-primary">Flat Design</span>
                    <Switch
                        checked={config.flatten === true}
                        onCheckedChange={(checked) => updateConfig('flatten', checked)}
                    />
                </div>
            )}

            {/* Show Header Toggle - only show if widget supports it */}
            {configUI.showHeaderToggle && (
                <div
                    className={`flex items-center justify-between ${configUI.headerToggleDisabled ? 'opacity-50' : ''}`}
                    title={configUI.headerDisabledReason}
                >
                    <div>
                        <span className="text-sm text-theme-primary">Show Header</span>
                        {configUI.headerToggleDisabled && (
                            <p className="text-xs text-theme-tertiary">Resize widget first</p>
                        )}
                    </div>
                    <Switch
                        checked={config.showHeader !== false}
                        onCheckedChange={(checked) => !configUI.headerToggleDisabled && updateConfig('showHeader', checked)}
                        disabled={configUI.headerToggleDisabled}
                    />
                </div>
            )}
        </div>
    );
};

export default DisplaySettings;
