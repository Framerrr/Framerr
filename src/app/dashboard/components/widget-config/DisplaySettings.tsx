/**
 * DisplaySettings - Widget display configuration section
 *
 * Extracted from WidgetConfigModal. Renders icon picker, title input,
 * flatten toggle, and show header toggle.
 */

import React, { useMemo } from 'react';
import { Switch } from '../../../../shared/ui';
import { getWidgetIconName } from '../../../../widgets/registry';
import { resolveWidgetChrome } from '../../../../shared/widgets';
import type { ChromeIntegrationRef } from '../../../../shared/widgets';
import IconPicker from '../../../../components/IconPicker';
import { Input } from '@/shared/ui';
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
    integrations?: ChromeIntegrationRef[];
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
    integrations = [],
}) => {
    const chrome = useMemo(
        () =>
            resolveWidgetChrome({
                widget: { type: widgetType, config },
                schemas,
                integrations,
            }),
        [widgetType, config, schemas, integrations]
    );

    const widgetDefaultIcon = getWidgetIconName(widgetType);

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
                        value={chrome.iconName}
                        onChange={(iconName) => {
                            // Picking the widget default icon resets override → derive again
                            if (iconName === widgetDefaultIcon) {
                                updateConfig('customIcon', undefined);
                                updateConfig('iconOverridden', false);
                                return;
                            }
                            updateConfig('customIcon', iconName);
                            updateConfig('iconOverridden', true);
                        }}
                        compact
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <Input
                        label="Widget Title"
                        value={
                            config.titleOverridden
                                ? ((config.title as string) ?? '')
                                : chrome.title
                        }
                        onChange={(e) => {
                            const next = e.target.value;
                            if (!next.trim()) {
                                updateConfig('title', undefined);
                                updateConfig('titleOverridden', false);
                                return;
                            }
                            updateConfig('title', next);
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
