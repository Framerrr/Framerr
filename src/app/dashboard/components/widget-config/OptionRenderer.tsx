/**
 * OptionRenderer - Plugin-driven options rendering
 *
 * Extracted from WidgetConfigModal. Renders individual config options based
 * on their type (toggle, buttons, toggle-buttons, select, text, textarea,
 * number, search, component).
 *
 * Also exports OptionsSection which wraps the full options block with
 * visibility filtering and section header.
 */

import React from 'react';
import { Select, Switch, CodeEditor } from '../../../../shared/ui';
import {
    Sliders,
    Search,
    Loader,
    MapPin,
} from 'lucide-react';
import type { WidgetConfigOption, SearchResult } from '../../../../widgets/types';
import { getMetricsForIntegration, METRIC_REGISTRY } from '../../../../widgets/system-status/hooks/useMetricConfig';

// ============================================================================
// Types
// ============================================================================

export interface OptionRendererProps {
    option: WidgetConfigOption;
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
    checkCondition: (condition: { key: string; value: unknown | unknown[] } | undefined) => boolean;
    widgetType: string;
    widgetHeight?: number;
    schemas: Record<string, { name?: string; icon?: string; metrics?: { key: string }[] }> | undefined;
    // Search state
    searchQueries: Record<string, string>;
    searchResults: Record<string, SearchResult[]>;
    searchLoading: Record<string, boolean>;
    searchOpen: Record<string, boolean>;
    onSearchInput: (optionKey: string, query: string, searchFn?: (q: string) => Promise<SearchResult[]>) => void;
    onSearchSelect: (option: WidgetConfigOption, result: SearchResult) => void;
    onSearchFocus: (optionKey: string) => void;
}

export interface OptionsSectionProps {
    options: WidgetConfigOption[];
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
    checkCondition: (condition: { key: string; value: unknown | unknown[] } | undefined) => boolean;
    widgetType: string;
    widgetHeight?: number;
    schemas: Record<string, { name?: string; icon?: string; metrics?: { key: string }[] }> | undefined;
    searchQueries: Record<string, string>;
    searchResults: Record<string, SearchResult[]>;
    searchLoading: Record<string, boolean>;
    searchOpen: Record<string, boolean>;
    onSearchInput: (optionKey: string, query: string, searchFn?: (q: string) => Promise<SearchResult[]>) => void;
    onSearchSelect: (option: WidgetConfigOption, result: SearchResult) => void;
    onSearchFocus: (optionKey: string) => void;
}

// ============================================================================
// OptionRenderer Component
// ============================================================================

const OptionRenderer: React.FC<OptionRendererProps> = ({
    option,
    config,
    updateConfig,
    checkCondition,
    widgetType,
    widgetHeight,
    schemas,
    searchQueries,
    searchResults,
    searchLoading,
    searchOpen,
    onSearchInput,
    onSearchSelect,
    onSearchFocus,
}) => {
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
                            onChange={(e) => onSearchInput(option.key, e.target.value, option.searchFn)}
                            onFocus={() => onSearchFocus(option.key)}
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
                                            onClick={() => onSearchSelect(option, result)}
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

// ============================================================================
// OptionsSection Component
// ============================================================================

export const OptionsSection: React.FC<OptionsSectionProps> = ({
    options,
    config,
    updateConfig,
    checkCondition,
    widgetType,
    widgetHeight,
    schemas,
    searchQueries,
    searchResults,
    searchLoading,
    searchOpen,
    onSearchInput,
    onSearchSelect,
    onSearchFocus,
}) => {
    if (options.length === 0) {
        return null;
    }

    // Filter options by visibleWhen condition
    const visibleOptions = options.filter(option => {
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
                {visibleOptions.map(option => (
                    <OptionRenderer
                        key={option.key}
                        option={option}
                        config={config}
                        updateConfig={updateConfig}
                        checkCondition={checkCondition}
                        widgetType={widgetType}
                        widgetHeight={widgetHeight}
                        schemas={schemas}
                        searchQueries={searchQueries}
                        searchResults={searchResults}
                        searchLoading={searchLoading}
                        searchOpen={searchOpen}
                        onSearchInput={onSearchInput}
                        onSearchSelect={onSearchSelect}
                        onSearchFocus={onSearchFocus}
                    />
                ))}
            </div>
        </div>
    );
};

export default OptionRenderer;
