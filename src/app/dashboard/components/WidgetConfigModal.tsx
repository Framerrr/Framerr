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
 *
 * Sub-components (extracted for maintainability):
 * - DisplaySettings: icon, title, flatten, header toggles
 * - SingleIntegrationSelector / MultiIntegrationSelector: integration binding
 * - OptionsSection: plugin-driven options rendering
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon, getWidgetConfigConstraints } from '../../../widgets/registry';
import { useWidgetConfigUI } from '../../../shared/widgets';
import { useRoleAwareIntegrations, useIntegrationSchemas } from '../../../api/hooks';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import type { WidgetConfigOption, SearchResult } from '../../../widgets/types';
import {
    DisplaySettings,
    SingleIntegrationSelector,
    MultiIntegrationSelector,
    OptionsSection,
} from './widget-config';
import type { IntegrationInstance } from './widget-config';

// ============================================================================
// Types
// ============================================================================

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
    }, [isOpen, currentConfig, configUI.options, allIntegrations, metadata?.name]);

    useEffect(() => {
        const timers = debounceTimers.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
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

    /**
     * Handle search focus — re-open dropdown if results exist.
     */
    const handleSearchFocus = useCallback((optionKey: string) => {
        if ((searchResults[optionKey] || []).length > 0) {
            setSearchOpen(prev => ({ ...prev, [optionKey]: true }));
        }
    }, [searchResults]);

    // Update config value
    const updateConfig = (key: string, value: unknown) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    // Handle save
    const handleSave = () => {
        // Normalize empty title to default widget name
        if (!config.title || (config.title as string).trim() === '') {
            config.title = metadata?.name || 'Widget';
        }

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
                    <SingleIntegrationSelector
                        config={config}
                        updateConfig={updateConfig}
                        configUI={configUI}
                        compatibleTypes={compatibleTypes}
                        availableIntegrations={availableIntegrations}
                        schemas={schemas}
                        userIsAdmin={userIsAdmin}
                        onClose={onClose}
                        loading={loading}
                        compatPopoverOpen={compatPopoverOpen}
                        setCompatPopoverOpen={setCompatPopoverOpen}
                    />

                    {/* Multi-Integration Selector (for Calendar and future multi-source widgets) */}
                    <MultiIntegrationSelector
                        config={config}
                        updateConfig={updateConfig}
                        configUI={configUI}
                        availableIntegrations={availableIntegrations}
                        schemas={schemas}
                        userIsAdmin={userIsAdmin}
                        onClose={onClose}
                        metadata={metadata}
                        compatPopoverOpen={compatPopoverOpen}
                        setCompatPopoverOpen={setCompatPopoverOpen}
                    />

                    {/* Display Settings */}
                    <DisplaySettings
                        config={config}
                        updateConfig={updateConfig}
                        configUI={configUI}
                        widgetType={widgetType}
                        schemas={schemas}
                        metadataName={metadata?.name}
                    />

                    {/* Options (plugin-driven) */}
                    <OptionsSection
                        options={configUI.options}
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
                        onSearchInput={handleSearchInput}
                        onSearchSelect={handleSearchSelect}
                        onSearchFocus={handleSearchFocus}
                    />
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
