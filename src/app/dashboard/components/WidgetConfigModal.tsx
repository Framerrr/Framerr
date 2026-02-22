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
import { Modal, Select, Switch, IntegrationDropdown, CodeEditor, Popover } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon, getWidgetIconName, getWidgetConfigConstraints } from '../../../widgets/registry';
import { useWidgetConfigUI } from '../../../shared/widgets';
import { useRoleAwareIntegrations, useIntegrationSchemas } from '../../../api/hooks';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import IconPicker from '../../../components/IconPicker';
import { Input } from '../../../components/common/Input';
import {
    Settings,
    Link2,
    Sliders,
    Search,
    Loader,
    MapPin,
    ExternalLink,
    Info
} from 'lucide-react';
import type { WidgetConfigOption, SearchResult } from '../../../widgets/types';
import { getMetricsForIntegration, METRIC_REGISTRY } from '../../../widgets/system-status/hooks/useMetricConfig';

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
    const [compatPopoverOpen, setCompatPopoverOpen] = useState(false);

    // Admin check for conditional UI (e.g. Service Settings link)
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

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
    const { data: schemas } = useIntegrationSchemas();

    // Filter integrations by compatible types (client-side filtering of cached data)
    const availableIntegrations = useMemo((): IntegrationInstance[] => {
        if (compatibleTypes.length === 0) return [];

        // Filter to only compatible types that are enabled, and transform to expected format
        return allIntegrations
            .filter(inst =>
                inst.enabled !== false &&
                compatibleTypes.some(type => type.toLowerCase() === inst.type.toLowerCase())
            )
            .map(i => ({
                id: i.id,
                type: i.type,
                displayName: i.displayName || i.name || i.type,
                enabled: true
            }));
    }, [allIntegrations, compatibleTypes]);

    // Loading state only while initial data loads (rare, usually already cached)
    const loading = integrationsLoading;

    // Initialize config from current widget config
    useEffect(() => {
        if (isOpen) {
            const newConfig = { ...currentConfig };

            // Auto-fill title/icon from bound integration if not overridden
            const integrationId = newConfig.integrationId as string | undefined;
            if (integrationId) {
                const boundIntegration = allIntegrations.find(i => i.id === integrationId);

                // Auto-fill title from bound integration if not overridden
                if (!newConfig.titleOverridden && boundIntegration) {
                    const defaultTitle = metadata?.name || '';
                    if (!newConfig.title || newConfig.title === defaultTitle) {
                        newConfig.title = boundIntegration.displayName || boundIntegration.name || boundIntegration.type;
                    }
                }
            }

            setConfig(newConfig);
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
     * Supports: toggle, toggle-buttons, buttons, select, text, textarea, number, search
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
                // Filter choices by integration type for system-status metrics
                let filteredChoices = option.choices || [];
                if (widgetType === 'system-status' && option.key === 'visibleMetrics') {
                    const selectedIntId = config.integrationId as string | undefined;
                    if (selectedIntId) {
                        const intType = selectedIntId.split('-')[0];
                        const schemaMetricKeys = schemas?.[intType]?.metrics?.map(m => m.key);
                        const availableMetricKeys = getMetricsForIntegration(intType, schemaMetricKeys);
                        // Map configKey → metric key for filtering
                        const availableConfigKeys = new Set(
                            METRIC_REGISTRY
                                .filter(m => availableMetricKeys.includes(m.key))
                                .map(m => m.configKey)
                        );
                        filteredChoices = filteredChoices.filter(c => availableConfigKeys.has(c.value));
                    }
                }
                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <div className="flex flex-wrap gap-2">
                            {filteredChoices.map((choice) => {
                                const Icon = choice.icon;
                                // Each choice.value is a config key, value is boolean
                                const isActive = config[choice.value] === true ||
                                    (choice.defaultValue === true && config[choice.value] !== false);
                                return (
                                    <button
                                        key={choice.value}
                                        onClick={() => updateConfig(choice.value, !isActive)}
                                        className={`px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${isActive
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

            case 'textarea': {
                // If syntax highlighting requested, use CodeEditor
                if (option.syntax) {
                    return (
                        <div key={option.key} className="space-y-2">
                            <span className="text-sm text-theme-secondary">{option.label}</span>
                            <CodeEditor
                                value={(currentValue as string) || ''}
                                onChange={(val) => updateConfig(option.key, val)}
                                syntax={option.syntax}
                                placeholder={option.placeholder}
                                rows={option.rows ?? 4}
                                disabled={isReadOnly}
                            />
                        </div>
                    );
                }

                return (
                    <div key={option.key} className="space-y-2">
                        <span className="text-sm text-theme-secondary">{option.label}</span>
                        <textarea
                            value={(currentValue as string) || ''}
                            onChange={(e) => updateConfig(option.key, e.target.value)}
                            placeholder={option.placeholder}
                            disabled={isReadOnly}
                            rows={option.rows ?? 4}
                            className={`w-full px-3 py-2 rounded-lg text-sm bg-theme-tertiary text-theme-primary border border-theme placeholder:text-theme-tertiary focus:outline-none focus:border-accent transition-colors font-mono ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
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

            case 'component': {
                const CustomComponent = option.component;
                if (!CustomComponent) return null;
                return (
                    <div key={option.key} className="space-y-2">
                        {option.label && <span className="text-sm text-theme-secondary">{option.label}</span>}
                        <CustomComponent
                            config={config}
                            updateConfig={updateConfig}
                            widgetHeight={widgetHeight}
                        />
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
    // Supports optional integrationGroups for custom grouping (e.g., media-search)
    const renderMultiIntegrationSelector = () => {
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

        // If NO integration types have instances, show empty state (same as single-integration)
        if (groupsWithInstances.length === 0) {
            const compatNames = configUI.compatibleIntegrationTypes.map(t => schemas?.[t]?.name || t.charAt(0).toUpperCase() + t.slice(1));
            return (
                <div className="flex flex-col items-center pb-4 border-b border-theme mb-2" data-walkthrough="widget-integration-section">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 size={16} className="text-theme-secondary" />
                        <span className="text-sm font-medium text-theme-secondary">Integration(s)</span>
                    </div>
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
                            name: i.displayName || i.type, // Ensure name is always a string
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

    // Single integration selector (for most widgets) - centered at top
    const renderIntegrationSelector = () => {
        if (compatibleTypes.length === 0 || isMultiIntegration) return null;

        const integrationOptions = availableIntegrations.map(i => ({ value: i.id, label: i.displayName }));

        // Validate stored integrationId against available options
        // If the stored ID doesn't match any option (e.g. integration was deleted),
        // treat as unselected so the placeholder shows instead of an empty Select
        const storedId = config.integrationId as string | undefined;
        const isValidId = storedId && integrationOptions.some(opt => opt.value === storedId);
        const selectValue = isValidId ? storedId : '';

        /**
         * Handle integration selection — auto-fill title and icon if not overridden.
         */
        const handleIntegrationChange = (newId: string | undefined) => {
            updateConfig('integrationId', newId || undefined);

            if (!newId) return;

            // Find the selected integration's display name
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

        return (
            <div className="flex flex-col items-center pb-4 border-b border-theme mb-2" data-walkthrough="widget-integration-section">
                <div className="flex items-center gap-2 mb-3">
                    <Link2 size={16} className="text-theme-secondary" />
                    <span className="text-sm font-medium text-theme-secondary">Integration</span>
                </div>

                {loading ? (
                    <div className="p-4 text-center text-theme-secondary">Loading integrations...</div>
                ) : availableIntegrations.length === 0 ? (
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
                                        {compatibleTypes.map(type => {
                                            const name = schemas?.[type]?.name || type.charAt(0).toUpperCase() + type.slice(1);
                                            return (
                                                <li key={type} className="text-xs text-theme-primary flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                                                    {name}
                                                </li>
                                            );
                                        })}
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
                                    value={(config.title as string) || metadata?.name || ''}
                                    onChange={(e) => {
                                        updateConfig('title', e.target.value);
                                        updateConfig('titleOverridden', true);
                                    }}
                                    placeholder={metadata?.name || 'Widget'}
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
