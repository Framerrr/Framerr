/**
 * IntegrationSelector - Single and multi-integration selection components
 *
 * Extracted from WidgetConfigModal. Contains:
 * - SingleIntegrationSelector: for widgets with one compatible integration
 * - MultiIntegrationSelector: for calendar/multi-source widgets
 * - Shared CompatibleIntegrationsEmpty sub-component
 */

import React from 'react';
import { Select, IntegrationDropdown, Popover } from '../../../../shared/ui';
import { Link2, ExternalLink, Info } from 'lucide-react';
import type { IntegrationInstance, WidgetConfigUIState } from './types';

// ============================================================================
// Types
// ============================================================================

interface IntegrationSelectorBaseProps {
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
    configUI: WidgetConfigUIState;
    availableIntegrations: IntegrationInstance[];
    schemas: Record<string, { name?: string; icon?: string; metrics?: { key: string }[] }> | undefined;
    userIsAdmin: boolean;
    onClose: () => void;
    compatPopoverOpen: boolean;
    setCompatPopoverOpen: (open: boolean) => void;
}

export interface SingleIntegrationSelectorProps extends IntegrationSelectorBaseProps {
    compatibleTypes: string[];
    loading: boolean;
}

export interface MultiIntegrationSelectorProps extends IntegrationSelectorBaseProps {
    metadata: { integrationGroups?: { key: string; label: string; types: string[] }[] } | null | undefined;
}

// ============================================================================
// Shared: Compatible Integrations Empty State
// ============================================================================

interface CompatibleIntegrationsEmptyProps {
    compatNames: string[];
    userIsAdmin: boolean;
    onClose: () => void;
    compatPopoverOpen: boolean;
    setCompatPopoverOpen: (open: boolean) => void;
}

const CompatibleIntegrationsEmpty: React.FC<CompatibleIntegrationsEmptyProps> = ({
    compatNames,
    userIsAdmin,
    onClose,
    compatPopoverOpen,
    setCompatPopoverOpen,
}) => (
    <div className={`py-2 px-4 text-center bg-theme-tertiary rounded-lg w-full space-y-1${!userIsAdmin ? ' flex items-center justify-center min-h-[3rem]' : ''}`}>
        <span className="text-base text-theme-secondary block">
            No{' '}
            <Popover open={compatPopoverOpen} onOpenChange={setCompatPopoverOpen}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        className="font-semibold text-accent hover:underline inline-flex items-center gap-1"
                        onClick={() => setCompatPopoverOpen(!compatPopoverOpen)}
                    >
                        compatible integrations
                        <Info size={12} />
                    </button>
                </Popover.Trigger>
                <Popover.Content side="top" align="center" className="p-3 max-w-52">
                    <span className="text-xs font-medium text-theme-secondary mb-2 block">This widget works with:</span>
                    <ul className="space-y-1">
                        {compatNames.map(name => (
                            <li key={name} className="text-xs text-theme-primary flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                                {name}
                            </li>
                        ))}
                    </ul>
                </Popover.Content>
            </Popover>
            {' '}configured.
        </span>
        {userIsAdmin && (
            <button
                type="button"
                className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                onClick={() => {
                    onClose();
                    window.location.hash = '#settings/integrations/services';
                }}
            >
                Go to Service Settings
                <ExternalLink size={11} />
            </button>
        )}
    </div>
);

// ============================================================================
// Single Integration Selector
// ============================================================================

export const SingleIntegrationSelector: React.FC<SingleIntegrationSelectorProps> = ({
    config,
    updateConfig,
    compatibleTypes,
    availableIntegrations,
    schemas,
    userIsAdmin,
    onClose,
    loading,
    configUI,
    compatPopoverOpen,
    setCompatPopoverOpen,
}) => {
    if (compatibleTypes.length === 0 || configUI.isMultiIntegration) return null;

    const integrationOptions = availableIntegrations.map(i => ({ value: i.id, label: i.displayName }));

    // Validate stored integrationId against available options
    const storedId = config.integrationId as string | undefined;
    const isValidId = storedId && integrationOptions.some(opt => opt.value === storedId);
    const selectValue = isValidId ? storedId : '';

    /**
     * Handle integration selection — auto-fill title and icon if not overridden.
     */
    const handleIntegrationChange = (newId: string | undefined) => {
        updateConfig('integrationId', newId || undefined);

        if (!newId) return;

        const selectedIntegration = availableIntegrations.find(i => i.id === newId);
        if (!selectedIntegration) return;

        // Auto-fill title if not manually overridden
        if (!config.titleOverridden) {
            updateConfig('title', selectedIntegration.displayName);
        }

        // Auto-fill icon if not manually overridden
        if (!config.iconOverridden) {
            const intType = newId.split('-')[0];
            const schemaIcon = schemas?.[intType]?.icon;
            if (schemaIcon) {
                updateConfig('customIcon', schemaIcon);
            }
        }
    };

    const compatNames = compatibleTypes.map(type =>
        schemas?.[type]?.name || type.charAt(0).toUpperCase() + type.slice(1)
    );

    return (
        <div className="flex flex-col items-center pb-4 border-b border-theme mb-2" data-walkthrough="widget-integration-section">
            <div className="flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-theme-secondary" />
                <span className="text-sm font-medium text-theme-secondary">Integration</span>
            </div>

            {loading ? (
                <div className="p-4 text-center text-theme-secondary">Loading integrations...</div>
            ) : availableIntegrations.length === 0 ? (
                <CompatibleIntegrationsEmpty
                    compatNames={compatNames}
                    userIsAdmin={userIsAdmin}
                    onClose={onClose}
                    compatPopoverOpen={compatPopoverOpen}
                    setCompatPopoverOpen={setCompatPopoverOpen}
                />
            ) : (
                <div className="w-full">
                    <Select value={selectValue} onValueChange={handleIntegrationChange}>
                        <Select.Trigger className="w-full">
                            <Select.Value placeholder="Select an integration..." />
                        </Select.Trigger>
                        <Select.Content>
                            {integrationOptions.map(opt => (
                                <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Multi Integration Selector
// ============================================================================

export const MultiIntegrationSelector: React.FC<MultiIntegrationSelectorProps> = ({
    config,
    updateConfig,
    configUI,
    availableIntegrations,
    schemas,
    userIsAdmin,
    onClose,
    metadata,
    compatPopoverOpen,
    setCompatPopoverOpen,
}) => {
    if (!configUI.isMultiIntegration || configUI.compatibleIntegrationTypes.length === 0) {
        return null;
    }

    // Capitalize integration type name for display
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Determine grouping: use plugin-defined groups or default to per-type
    const groups = metadata?.integrationGroups
        ? metadata.integrationGroups.map(group => ({
            key: group.key,
            label: group.label,
            instances: availableIntegrations.filter(i =>
                group.types.some(t => t.toLowerCase() === i.type.toLowerCase())
            )
        }))
        : configUI.compatibleIntegrationTypes.map(type => ({
            key: `${type}IntegrationIds`,
            label: capitalize(type),
            instances: availableIntegrations.filter(i =>
                i.type.toLowerCase() === type.toLowerCase()
            )
        }));

    const groupsWithInstances = groups.filter(g => g.instances.length > 0);

    // If NO integration types have instances, show empty state
    if (groupsWithInstances.length === 0) {
        const compatNames = configUI.compatibleIntegrationTypes.map(t =>
            schemas?.[t]?.name || t.charAt(0).toUpperCase() + t.slice(1)
        );
        return (
            <div className="flex flex-col items-center pb-4 border-b border-theme mb-2" data-walkthrough="widget-integration-section">
                <div className="flex items-center gap-2 mb-3">
                    <Link2 size={16} className="text-theme-secondary" />
                    <span className="text-sm font-medium text-theme-secondary">Integration(s)</span>
                </div>
                <CompatibleIntegrationsEmpty
                    compatNames={compatNames}
                    userIsAdmin={userIsAdmin}
                    onClose={onClose}
                    compatPopoverOpen={compatPopoverOpen}
                    setCompatPopoverOpen={setCompatPopoverOpen}
                />
            </div>
        );
    }

    // Otherwise render multi-select dropdowns for groups that have instances
    return (
        <div className="flex flex-col items-center pb-4 border-b border-theme mb-2" data-walkthrough="widget-integration-section">
            <div className="flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-theme-secondary" />
                <span className="text-sm font-medium text-theme-secondary">Integration(s)</span>
            </div>

            <div className="w-full space-y-3">
                {groupsWithInstances.map(({ key: configKey, label, instances }) => {
                    // Support legacy singular key for backward compatibility
                    const legacyKey = configKey.replace('Ids', 'Id');

                    // Read current value - support both array and legacy single value
                    const rawValue = config[configKey] ?? config[legacyKey];
                    const currentIds: string[] = Array.isArray(rawValue)
                        ? rawValue as string[]
                        : (rawValue ? [rawValue as string] : []);

                    // Map instances to IntegrationDropdown format
                    const dropdownIntegrations = instances.map(i => ({
                        id: i.id,
                        name: i.displayName || i.type,
                        type: i.type,
                    }));

                    return (
                        <div key={configKey} className="w-full">
                            <label className="block text-xs font-medium text-theme-tertiary mb-1.5">
                                {label}
                            </label>
                            <IntegrationDropdown
                                integrations={dropdownIntegrations}
                                selectedIds={currentIds}
                                onChange={(ids) => {
                                    // Store as array in new key
                                    updateConfig(configKey, ids.length > 0 ? ids : undefined);
                                    // Clear legacy key if it exists
                                    if (config[legacyKey]) {
                                        updateConfig(legacyKey, undefined);
                                    }
                                }}
                                size="md"
                                placeholder={`Select ${label.toLowerCase()}...`}
                                maxSelections={5}
                                showBulkActions={instances.length > 3}
                                fullWidth
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
