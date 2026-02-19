/**
 * Widget Plugin System - Canonical Types
 *
 * These are the TARGET interfaces for all widgets.
 * Every widget (new and existing) will implement this pattern.
 *
 * P4 Phase 4.1: Interface definitions only
 * P4 Phase 4.3: All widgets migrated to this pattern
 */

import { LazyExoticComponent, ComponentType } from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// WIDGET CATEGORIES
// ============================================================================

export type WidgetCategory = 'system' | 'media' | 'downloads' | 'utility';

// ============================================================================
// SIZING
// ============================================================================

export interface WidgetSize {
    w: number;
    h: number;
}

export interface WidgetSizing {
    default: WidgetSize;
    min?: Partial<WidgetSize>;
    max?: Partial<WidgetSize>;
}

// ============================================================================
// WIDGET DATA (runtime state)
// ============================================================================

export interface WidgetData {
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    integrationId?: string;
    config?: Record<string, unknown>;
}

// ============================================================================
// WIDGET PROPS (passed to widget components)
// ============================================================================

/**
 * Canonical widget props interface.
 * 
 * All widgets MUST accept these props. Widgets needing additional props
 * should extend this interface (e.g., PlexWidgetProps extends WidgetProps).
 * 
 * P4 Phase 4.5b: All widgets migrated to this pattern.
 */
export interface WidgetProps {
    /** Widget instance data (id, type, config, position) */
    widget: WidgetData;

    /** Dashboard edit mode state */
    isEditMode: boolean;

    /** Preview mode for template builder (renders with mock data) */
    previewMode?: boolean;

    /** Callback for widget config updates */
    onUpdate?: (updates: Partial<WidgetData>) => void;
}

// ============================================================================
// CONFIG CONSTRAINTS (display behavior)
// ============================================================================

/**
 * Declarative constraints for widget config modal behavior.
 * Allows widgets to specify their display capabilities without hardcoding
 * widget-specific checks throughout the UI codebase.
 */
export interface ConfigConstraints {
    /** 
     * Widget supports header display. 
     * When false, header toggle is hidden in config modals.
     * Default: true
     */
    supportsHeader?: boolean;

    /** 
     * Widget supports flatten mode (removes glassmorphism).
     * When false, flatten toggle is hidden in config modals.
     * Default: true 
     */
    supportsFlatten?: boolean;

    /**
     * Header-height coupling behavior.
     * 
     * DEFAULT ('soft') - Header shows if user preference is ON and h >= minHeightForHeader.
     *                    Toggle always enabled. Resizing doesn't change user preference.
     *                    This is the GLOBAL DEFAULT for all widgets supporting headers.
     * 
     * 'hard' - Header and height are strictly coupled. h:1 = no header, 
     *          h:2+ = header. Toggle changes height. Resize changes toggle.
     *          Use for widgets where content is fixed size (e.g., search bar).
     */
    headerHeightMode?: 'soft' | 'hard';

    /**
     * Minimum height (in grid rows) required to display header.
     * Default: 2
     */
    minHeightForHeader?: number;

    /**
     * Content padding for the widget body.
     * Maps to CSS classes: 'none'=none, 'sm'=compact, 'md'=default, 'lg'=relaxed
     * Default: 'md' (standard padding)
     */
    contentPadding?: 'none' | 'sm' | 'md' | 'lg';

    /**
     * Widget-specific options shown in the "Options" section of config modal.
     * Allows plugins to declaratively define their configuration UI.
     */
    options?: WidgetConfigOption[];
}

// ============================================================================
// WIDGET CONFIG OPTIONS (plugin-driven modal UI)
// ============================================================================

/**
 * Search result shape returned by searchFn.
 * label is displayed to the user; value contains data for linkedFields.
 */
export interface SearchResult {
    /** Display label shown in dropdown */
    label: string;
    /** Data object — properties mapped to config keys via linkedFields */
    value: Record<string, unknown>;
}

/**
 * Defines a single widget configuration option.
 * Used by WidgetConfigModal to render the "Options" section dynamically.
 */
export interface WidgetConfigOption {
    /** Config key (e.g., 'hideWhenEmpty', 'format24h') */
    key: string;

    /** Display label for the option */
    label: string;

    /** UI control type */
    type: 'toggle' | 'toggle-buttons' | 'buttons' | 'select' | 'text' | 'textarea' | 'number' | 'search' | 'component';

    /**
     * For 'component' type: a React component rendered inline.
     * Receives config state and an update callback.
     */
    component?: ComponentType<{
        config: Record<string, unknown>;
        updateConfig: (key: string, value: unknown) => void;
        widgetHeight?: number;
    }>;

    /** Default value if not set in widget config */
    defaultValue?: unknown;

    /** 
     * For 'toggle-buttons': array of {key, label} for independent boolean toggles.
     * For 'buttons'/'select': array of {value, label} for exclusive selection.
     * Each choice can have an optional icon.
     */
    choices?: WidgetConfigChoice[];

    // === TEXT / TEXTAREA / NUMBER / SEARCH PROPERTIES ===

    /** Placeholder text for text/textarea/number/search inputs */
    placeholder?: string;

    /** For 'textarea': number of visible rows (default: 4) */
    rows?: number;

    /** For 'textarea': syntax highlighting language (default: none) */
    syntax?: 'html' | 'css';

    /** For 'number': minimum value */
    min?: number;
    /** For 'number': maximum value */
    max?: number;
    /** For 'number': step increment */
    step?: number;

    /**
     * For 'search': async function that fetches results based on query string.
     * Called with debounce (300ms) as user types. Minimum 2 characters.
     */
    searchFn?: (query: string) => Promise<SearchResult[]>;

    /**
     * For 'search': maps selected result's value properties to other config keys.
     * Keys = config keys to set, Values = property names in SearchResult.value.
     * Example: { latitude: 'latitude', longitude: 'longitude', cityName: 'cityName' }
     */
    linkedFields?: Record<string, string>;

    // === CONDITIONAL VISIBILITY ===

    /**
     * Show this option only when another config key matches a value.
     * value can be a single value or array (matches ANY value in array).
     * Example: { key: 'locationMode', value: 'search' }
     * Example: { key: 'locationMode', value: ['search', 'manual'] }
     */
    visibleWhen?: { key: string; value: unknown | unknown[] };

    /**
     * Make this option read-only/disabled when another config key matches a value.
     * Same format as visibleWhen.
     */
    readOnlyWhen?: { key: string; value: unknown | unknown[] };
}

/**
 * A single choice for select/buttons/toggle-buttons options.
 */
export interface WidgetConfigChoice {
    /** 
     * For 'buttons'/'select': value stored in config under parent option's key.
     * For 'toggle-buttons': config key for this individual toggle (value is boolean).
     */
    value: string;

    /** Display label */
    label: string;

    /** Optional icon (defaults to none) */
    icon?: LucideIcon;

    /** Default value for toggle-buttons (defaults to false) */
    defaultValue?: boolean;
}

// ============================================================================
// WIDGET PLUGIN (the main interface)
// ============================================================================

export interface WidgetPlugin {
    // === METADATA (required) ===
    id: string; // 'plex', 'clock', etc.
    name: string; // Display name
    description: string; // Short description
    category: WidgetCategory;
    icon: LucideIcon;

    // === SIZING (required) ===
    sizing: WidgetSizing;

    // === COMPONENT (required) ===
    // NOTE: Using flexible type to accommodate existing widget prop variations.
    // Full prop normalization (all widgets using WidgetProps) planned for Phase 4.5.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: LazyExoticComponent<ComponentType<any>>;

    // === INTEGRATION BINDING (optional) ===
    compatibleIntegrations?: string[]; // ['plex'], ['sonarr', 'radarr']
    multiIntegration?: boolean; // True = calendar uses multiple

    /**
     * Custom grouping for multi-integration dropdowns in config modal.
     * If defined, groups integration types into labeled dropdowns.
     * If not defined, defaults to one dropdown per integration type.
     * 
     * Example: media-search groups plex+jellyfin+emby into "Library Sources"
     * and overseerr into its own "Overseerr" dropdown.
     */
    integrationGroups?: Array<{
        /** Config key for storing selected IDs (e.g., 'libraryIntegrationIds') */
        key: string;
        /** Display label (e.g., 'Library Sources') */
        label: string;
        /** Which integration types belong to this group */
        types: string[];
    }>;

    // === ACCESS MODE (optional) ===
    /**
     * If true, widget is globally available to all users without admin sharing.
     * Default: false (integration widgets must be shared by admin)
     * Set to true for utility widgets (clock, notes, etc.)
     */
    isGlobal?: boolean;

    // === DEFAULTS (optional) ===
    defaultConfig?: Record<string, unknown>;

    // === CONFIG CONSTRAINTS (optional) ===
    /**
     * Declarative display constraints.
     * Used by config modals to determine which toggles to show.
     * If not specified, defaults are: supportsHeader=true, supportsFlatten=true
     */
    configConstraints?: ConfigConstraints;
}
