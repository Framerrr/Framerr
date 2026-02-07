/**
 * WidgetConfigModal - Per-widget configuration modal
 * 
 * Opens when user clicks "Edit" in the WidgetActionsPopover.
 * 
 * Features:
 * - Integration selector (for widgets with compatibleIntegrations)
 * - Widget-specific settings (Clock toggles, Calendar dual picker, LinkGrid justify, etc.)
 * - Title/display name configuration
 * - Header visibility toggle
 *
 * Uses the Modal primitive for consistent styling.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, Select, Switch, IntegrationDropdown } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon, getWidgetConfigConstraints } from '../../../widgets/registry';
import { useWidgetConfigUI } from '../../../shared/widgets';
import { useRoleAwareIntegrations } from '../../../api/hooks';
import {
    Settings,
    Link2,
    Sliders,
    Search,
    Loader,
    MapPin
} from 'lucide-react';
import type { WidgetConfigOption, SearchResult } from '../../../widgets/types';

// ============================================================================
// Types
// ============================================================================

interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    enabled: boolean;
}

export interface WidgetConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    widgetId: string;
    widgetType: string;
    widgetHeight?: number; // Current widget height for constraint checking
    currentConfig: Record<string, unknown>;
    onSave: (widgetId: string, config: Record<string, unknown>) => void;
    onResize?: (widgetId: string, layout: { w?: number; h?: number }) => void;
}

// ============================================================================
// Component
// ============================================================================

const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({
    isOpen,
    onClose,
    widgetId,
    widgetType,
    widgetHeight,
    currentConfig,
    onSave,
    onResize
}) => {
    const [config, setConfig] = useState<Record<string, unknown>>({});

    // Search state: per-option-key search query, results, and loading
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
    const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({});
    const [searchLoading, setSearchLoading] = useState<Record<string, boolean>>({});
    const [searchOpen, setSearchOpen] = useState<Record<string, boolean>>({});
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const metadata = useMemo(() => getWidgetMetadata(widgetType), [widgetType]);
    const WidgetIcon = useMemo(() => getWidgetIcon(widgetType), [widgetType]);
    const compatibleTypes = useMemo(() => metadata?.compatibleIntegrations || [], [metadata]);
    const isMultiIntegration = metadata?.multiIntegration === true;

    // Centralized config UI state from plugin constraints
    const configUI = useWidgetConfigUI(widgetType, widgetHeight);

    // Use cached React Query hooks - data is already loaded when dashboard mounts
    // useRoleAwareIntegrations already returns only accessible integrations for non-admins
    const { data: allIntegrations = [], isLoading: integrationsLoading } = useRoleAwareIntegrations();

    // Filter integrations by compatible types (client-side filtering of cached data)
    const availableIntegrations = useMemo((): IntegrationInstance[] => {
        if (compatibleTypes.length === 0) return [];

        // Filter to only compatible types and transform to expected format
        return allIntegrations
            .filter(inst =>
                compatibleTypes.some(type => type.toLowerCase() === inst.type.toLowerCase())
            )
            .map(i => ({
                id: i.id,
                type: i.type,
                displayName: i.displayName || i.name || i.type,
                enabled: i.enabled !== false
            }));
    }, [allIntegrations, compatibleTypes]);

    // Loading state only while initial data loads (rare, usually already cached)
    const loading = integrationsLoading;

    // Initialize config from current widget config
    useEffect(() => {
        if (isOpen) {
            setConfig({ ...currentConfig });
            // Pre-populate search queries from stored config for search-type options
            const initialQueries: Record<string, string> = {};
            for (const option of configUI.options) {
                if (option.type === 'search' && currentConfig[option.key]) {
                    initialQueries[option.key] = currentConfig[option.key] as string;
                }
            }
            setSearchQueries(initialQueries);
            setSearchResults({});
            setSearchLoading({});
            setSearchOpen({});
        }
    }, [isOpen, currentConfig, configUI.options]);

    // Cleanup debounce timers on unmount
    useEffect(() => {
        return () => {
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, []);

    /**
     * Check if a visibleWhen/readOnlyWhen condition is met.
     * Supports single value or array of values (matches ANY).
     */
    const checkCondition = useCallback((condition: { key: string; value: unknown | unknown[] } | undefined): boolean => {
        if (!condition) return false;
        const currentVal = config[condition.key];
        if (Array.isArray(condition.value)) {
            return (condition.value as unknown[]).includes(currentVal);
        }
        return currentVal === condition.value;
    }, [config]);

    /**
     * Debounced search handler for 'search' type options.
     */
    const handleSearchInput = useCallback((optionKey: string, query: string, searchFn?: (q: string) => Promise<SearchResult[]>) => {
        setSearchQueries(prev => ({ ...prev, [optionKey]: query }));

        // Clear previous timer
        if (debounceTimers.current[optionKey]) {
            clearTimeout(debounceTimers.current[optionKey]);
        }

        // Min 2 chars to search
        if (query.length < 2 || !searchFn) {
            setSearchResults(prev => ({ ...prev, [optionKey]: [] }));
            setSearchLoading(prev => ({ ...prev, [optionKey]: false }));
            setSearchOpen(prev => ({ ...prev, [optionKey]: false }));
            return;
        }

        setSearchLoading(prev => ({ ...prev, [optionKey]: true }));
        setSearchOpen(prev => ({ ...prev, [optionKey]: true }));

        debounceTimers.current[optionKey] = setTimeout(async () => {
            try {
                const results = await searchFn(query);
                setSearchResults(prev => ({ ...prev, [optionKey]: results }));
            } catch {
                setSearchResults(prev => ({ ...prev, [optionKey]: [] }));
            } finally {
                setSearchLoading(prev => ({ ...prev, [optionKey]: false }));
            }
        }, 300);
    }, []);

    /**
     * Handle search result selection — fill linked fields.
     */
    const handleSearchSelect = useCallback((option: WidgetConfigOption, result: SearchResult) => {
        // Set the display value in the search field
        setSearchQueries(prev => ({ ...prev, [option.key]: result.label }));
        setSearchOpen(prev => ({ ...prev, [option.key]: false }));
        setSearchResults(prev => ({ ...prev, [option.key]: [] }));

        // Store the display label in config under the search option's key (for persistence)
        setConfig(prev => {
            const updates = { ...prev, [option.key]: result.label };

            // Auto-fill linked fields from the result value
            if (option.linkedFields) {
                for (const [configKey, resultProp] of Object.entries(option.linkedFields!)) {
                    updates[configKey] = result.value[resultProp];
                }
            }
            return updates;
        });
    }, []);

    // Update config value
    const updateConfig = (key: string, value: unknown) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    // Handle save
    const handleSave = () => {
        onSave(widgetId, config);

        // If hard mode and header visibility changed, resize widget
        const constraints = getWidgetConfigConstraints(widgetType);
        const headerWasVisible = currentConfig.showHeader !== false;
        const headerIsNowVisible = config.showHeader !== false;
        if (constraints.headerHeightMode === 'hard' && onResize && headerWasVisible !== headerIsNowVisible) {
            const threshold = constraints.minHeightForHeader ?? 2;
            onResize(widgetId, { h: headerIsNowVisible ? threshold : 1 });
        }

        onClose();
    };

    // ========== Dynamic Options Section (Plugin-Driven) ==========

    /**
     * Renders a single option based on its type.
     * Supports: toggle, toggle-buttons, buttons, select, text, number, search
     */
    const renderOption = (option: WidgetConfigOption) => {
        const currentValue = config[option.key] ?? option.defaultValue;
        const isReadOnly = checkCondition(option.readOnlyWhen);

        switch (option.type) {
            case 'toggle': {
                const isChecked = currentValue === true ||
                    (option.defaultValue === true && currentValue !== false);
                return (
                    <div key={option.key} className="flex items-center justify-between">
                        <span className="text-sm text-theme-primary">{option.label}</span>
                        <Switch
                            checked={isChecked}
                            onCheckedChange={(checked) => updateConfig(option.key, checked)}
                            disabled={isReadOnly}
                        />
                    </div>
                );
            }

            case 'buttons': {
                const selectedValue = (currentValue as string) || option.defaultValue;
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <div className="flex gap-3">
                            {option.choices?.map((choice) => {
                                const Icon = choice.icon;
                                const isSelected = selectedValue === choice.value;
                                return (
                                    <button
                                        key={choice.value}
                                        onClick={() => updateConfig(option.key, choice.value)}
                                        disabled={isReadOnly}
                                        className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${isSelected
                                            ? 'bg-accent text-white'
                                            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                            } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {Icon && <Icon size={16} />}
                                        {choice.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            case 'toggle-buttons': {
                // Independent toggles rendered as buttons (each choice is a separate config key)
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <div className="flex gap-3">
                            {option.choices?.map((choice) => {
                                const Icon = choice.icon;
                                // Each choice.value is a config key, value is boolean
                                const isActive = config[choice.value] === true ||
                                    (choice.defaultValue === true && config[choice.value] !== false);
                                return (
                                    <button
                                        key={choice.value}
                                        onClick={() => updateConfig(choice.value, !isActive)}
                                        className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${isActive
                                            ? 'bg-accent text-white'
                                            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                            }`}
                                    >
                                        {Icon && <Icon size={16} />}
                                        {choice.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            case 'select': {
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <Select
                            value={(currentValue as string) || ''}
                            onValueChange={(value) => updateConfig(option.key, value || undefined)}
                            disabled={isReadOnly}
                        >
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder={`Select ${option.label.toLowerCase()}...`} />
                            </Select.Trigger>
                            <Select.Content>
                                {option.choices?.map((choice) => (
                                    <Select.Item key={choice.value} value={choice.value}>
                                        {choice.label}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>
                );
            }

            case 'text': {
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <input
                            type="text"
                            value={(currentValue as string) || ''}
                            onChange={(e) => updateConfig(option.key, e.target.value)}
                            placeholder={option.placeholder}
                            disabled={isReadOnly}
                            className={`w-full px-3 py-2 rounded-lg text-sm bg-theme-tertiary text-theme-primary border border-theme placeholder:text-theme-tertiary focus:outline-none focus:border-accent transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                );
            }

            case 'number': {
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <input
                            type="number"
                            value={currentValue != null ? String(currentValue) : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                updateConfig(option.key, val === '' ? null : Number(val));
                            }}
                            placeholder={option.placeholder}
                            min={option.min}
                            max={option.max}
                            step={option.step}
                            disabled={isReadOnly}
                            className={`w-full px-3 py-2 rounded-lg text-sm bg-theme-tertiary text-theme-primary border border-theme placeholder:text-theme-tertiary focus:outline-none focus:border-accent transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                );
            }

            case 'search': {
                const query = searchQueries[option.key] || '';
                const results = searchResults[option.key] || [];
                const isSearchLoading = searchLoading[option.key] || false;
                const isDropdownOpen = searchOpen[option.key] || false;

                return (
                    <div key={option.key} className="space-y-2 relative">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-tertiary pointer-events-none" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => handleSearchInput(option.key, e.target.value, option.searchFn)}
                                onFocus={() => {
                                    if (results.length > 0) {
                                        setSearchOpen(prev => ({ ...prev, [option.key]: true }));
                                    }
                                }}
                                placeholder={option.placeholder || 'Search...'}
                                disabled={isReadOnly}
                                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-theme-tertiary text-theme-primary border border-theme placeholder:text-theme-tertiary focus:outline-none focus:border-accent transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            {isSearchLoading && (
                                <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-tertiary animate-spin" />
                            )}
                        </div>

                        {/* Search results dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-theme bg-theme-secondary overflow-hidden shadow-lg">
                                {isSearchLoading ? (
                                    <div className="py-3 px-3 text-sm text-theme-tertiary text-center flex items-center justify-center gap-2">
                                        <Loader size={14} className="animate-spin" />
                                        Searching...
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="py-3 px-3 text-sm text-theme-tertiary text-center">
                                        No results found
                                    </div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto">
                                        {results.map((result, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSearchSelect(option, result)}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-primary text-left hover:bg-theme-hover transition-colors"
                                            >
                                                <MapPin size={14} className="text-theme-tertiary flex-shrink-0" />
                                                <span className="truncate">{result.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return null;
        }
    };

    /**
     * Renders the Options section if the plugin has defined options.
     */
    const renderOptionsSection = () => {
        if (configUI.options.length === 0) {
            return null;
        }

        // Filter options by visibleWhen condition
        const visibleOptions = configUI.options.filter(option => {
            if (!option.visibleWhen) return true; // No condition = always visible
            return checkCondition(option.visibleWhen);
        });

        if (visibleOptions.length === 0) {
            return null;
        }

        return (
            <div className="pt-4 border-t border-theme space-y-4">
                <h4 className="text-sm font-medium text-theme-secondary flex items-center gap-2">
                    <Sliders size={16} />
                    Options
                </h4>
                <div className="space-y-3">
                    {visibleOptions.map(renderOption)}
                </div>
            </div>
        );
    };

    // Dynamic multi-integration selector (for Calendar and future multi-source widgets)
    // Uses multi-select dropdowns with max 5 selections per type
    // Matches single-selector styling pattern
    const renderMultiIntegrationSelector = () => {
        if (!configUI.isMultiIntegration || configUI.compatibleIntegrationTypes.length === 0) {
            return null;
        }

        // Capitalize integration type name for display
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        // Check which types have available instances (case-insensitive comparison)
        const availableByType = configUI.compatibleIntegrationTypes.map(type => ({
            type,
            instances: availableIntegrations.filter(i => i.type.toLowerCase() === type.toLowerCase())
        }));
        const typesWithInstances = availableByType.filter(t => t.instances.length > 0);

        // If NO integration types have instances, show empty state (same as single-integration)
        if (typesWithInstances.length === 0) {
            return (
                <div className="flex flex-col items-center pb-4 border-b border-theme mb-2">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 size={16} className="text-theme-secondary" />
                        <span className="text-sm font-medium text-theme-secondary">Integration(s)</span>
                    </div>
                    <div className="p-4 text-center text-theme-secondary bg-theme-tertiary rounded-lg w-full">
                        No {configUI.compatibleIntegrationTypes.join(' or ')} integrations configured.
                    </div>
                </div>
            );
        }

        // Otherwise render multi-select dropdowns for types that have instances
        return (
            <div className="flex flex-col items-center pb-4 border-b border-theme mb-2">
                <div className="flex items-center gap-2 mb-3">
                    <Link2 size={16} className="text-theme-secondary" />
                    <span className="text-sm font-medium text-theme-secondary">Integration(s)</span>
                </div>

                <div className="w-full space-y-3">
                    {typesWithInstances.map(({ type: integrationType, instances }) => {
                        // Use plural config key for multi-select
                        const configKey = `${integrationType}IntegrationIds`;
                        // Support legacy singular key for backward compatibility
                        const legacyKey = `${integrationType}IntegrationId`;

                        // Read current value - support both array and legacy single value
                        const rawValue = config[configKey] ?? config[legacyKey];
                        const currentIds: string[] = Array.isArray(rawValue)
                            ? rawValue as string[]
                            : (rawValue ? [rawValue as string] : []);

                        // Map instances to IntegrationDropdown format
                        const dropdownIntegrations = instances.map(i => ({
                            id: i.id,
                            name: i.displayName || i.type, // Ensure name is always a string
                            type: i.type,
                        }));

                        return (
                            <div key={integrationType} className="w-full">
                                <label className="block text-xs font-medium text-theme-tertiary mb-1.5">
                                    {capitalize(integrationType)}
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
                                    placeholder={`Select ${capitalize(integrationType).toLowerCase()} instance(s)...`}
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

    // Single integration selector (for most widgets) - centered at top
    const renderIntegrationSelector = () => {
        if (compatibleTypes.length === 0 || isMultiIntegration) return null;

        const integrationOptions = availableIntegrations.map(i => ({ value: i.id, label: i.displayName }));

        return (
            <div className="flex flex-col items-center pb-4 border-b border-theme mb-2">
                <div className="flex items-center gap-2 mb-3">
                    <Link2 size={16} className="text-theme-secondary" />
                    <span className="text-sm font-medium text-theme-secondary">Integration</span>
                </div>

                {loading ? (
                    <div className="p-4 text-center text-theme-secondary">Loading integrations...</div>
                ) : availableIntegrations.length === 0 ? (
                    <div className="p-4 text-center text-theme-secondary bg-theme-tertiary rounded-lg">
                        No {compatibleTypes.join(' or ')} integrations configured.
                    </div>
                ) : (
                    <div className="w-full">
                        <Select value={(config.integrationId as string) || ''} onValueChange={(value) => updateConfig('integrationId', value || undefined)}>
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


    // ========== Modal Content ==========

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
            <Modal.Header
                icon={<WidgetIcon size={18} className="text-accent" />}
                title={`Configure ${metadata?.name || 'Widget'}`}
            />
            <Modal.Body>
                <div className="space-y-6">
                    {/* Integration Selector - FIRST, centered at top for widgets that need it */}
                    {renderIntegrationSelector()}

                    {/* Multi-Integration Selector (for Calendar and future multi-source widgets) */}
                    {renderMultiIntegrationSelector()}

                    {/* Display Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-theme-secondary flex items-center gap-2">
                            <Settings size={16} />
                            Display Settings
                        </h4>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-theme-secondary mb-2">
                                Widget Title
                            </label>
                            <input
                                type="text"
                                value={(config.title as string) || metadata?.name || ''}
                                onChange={(e) => updateConfig('title', e.target.value)}
                                placeholder={metadata?.name || 'Widget'}
                                className="w-full p-3 rounded-lg bg-theme-tertiary border border-theme text-theme-primary placeholder:text-theme-tertiary"
                            />
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

                    {/* Options (plugin-driven) */}
                    {renderOptionsSection()}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-theme-tertiary text-theme-primary hover:bg-theme-hover transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                    Save Changes
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default WidgetConfigModal;
