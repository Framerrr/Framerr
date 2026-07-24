/**
 * Settings Navigation Module — Public API
 * 
 * Re-exports config data, types, helpers, and context.
 * Does NOT re-export settingsComponentRegistry (internal to SettingsPage).
 */

// Config data and helpers
export {
    userSettingsCategories,
    adminSettingsCategories,
    getSettingsCategories,
    getVisibleChildren,
    getFirstVisibleChild,
    getSegmentLabels,
    guardedNavigate,
} from './settingsConfig';

// Config types
export type {
    SettingsSubTab,
    SidebarSettingsCategory,
} from './settingsConfig';

// Navigation context
export { SettingsNavProvider } from './SettingsNavContext';
export { useSettingsNav } from './useSettingsNav';

// Navigation types
export type {
    SettingsNavPath,
    AnimationDirection,
    SettingsNavContextValue,
} from './SettingsNavContext';

export { default as SettingsNavContext } from './SettingsNavContext';
