/**
 * Customization Settings Type Definitions
 * 
 * Shared types for the customization feature extracted from CustomizationSettings.tsx
 */

export type SubTabId = 'general' | 'colors' | 'favicon';

export interface CustomColors {
    'bg-primary': string;
    'bg-secondary': string;
    'bg-tertiary': string;
    'accent': string;
    'accent-secondary': string;
    'text-primary': string;
    'text-secondary': string;
    'text-tertiary': string;
    'border': string;
    'border-light': string;
    'success': string;
    'warning': string;
    'error': string;
    'info': string;
    'bg-hover': string;
    'accent-hover': string;
    'accent-light': string;
    'border-accent': string;
    [key: string]: string;
}

export interface OriginalGreeting {
    enabled: boolean;
    mode: 'auto' | 'manual';
    text: string;
    headerVisible: boolean;
    taglineEnabled: boolean;
    taglineText: string;
    tones: string[];
    loadingMessages: boolean;
}

export interface ThemeDefinition {
    id: string;
    name: string;
    description: string;
}

export interface CustomizationSettingsProps {
    activeSubTab?: string | null;
}

/**
 * State returned by useCustomizationState hook
 */
export interface CustomizationState {
    // Sub-tab Navigation
    activeSubTab: SubTabId;
    setActiveSubTab: (id: SubTabId) => void;

    // Color Theme State
    customColors: CustomColors;
    useCustomColors: boolean;
    customColorsEnabled: boolean;
    lastSelectedTheme: string;
    autoSaving: boolean;
    saving: boolean;
    loading: boolean;

    // Application Branding State (Admin only)
    applicationName: string;
    setApplicationName: (name: string) => void;
    applicationIcon: string;
    setApplicationIcon: (icon: string) => void;
    savingAppName: boolean;
    hasAppNameChanges: boolean;

    // Flatten UI State
    flattenUI: boolean;
    savingFlattenUI: boolean;

    // Greeting State
    greetingMode: 'auto' | 'manual';
    setGreetingMode: (mode: 'auto' | 'manual') => void;
    greetingText: string;
    setGreetingText: (text: string) => void;
    headerVisible: boolean;
    setHeaderVisible: (visible: boolean) => void;
    taglineEnabled: boolean;
    setTaglineEnabled: (enabled: boolean) => void;
    taglineText: string;
    setTaglineText: (text: string) => void;
    tones: string[];
    setTones: (tones: string[]) => void;
    loadingMessagesEnabled: boolean;
    setLoadingMessagesEnabled: (enabled: boolean) => void;
    savingGreeting: boolean;
    hasGreetingChanges: boolean;

    // Collapsible Sections
    statusColorsExpanded: boolean;
    setStatusColorsExpanded: (expanded: boolean) => void;
    advancedExpanded: boolean;
    setAdvancedExpanded: (expanded: boolean) => void;

    // Handlers
    handleColorChange: (key: string, value: string) => void;
    handleToggleCustomColors: (enabled: boolean) => Promise<void>;
    handleSaveCustomColors: () => Promise<void>;
    handleResetColors: () => Promise<void>;
    handleSaveApplicationName: () => Promise<void>;
    handleToggleFlattenUI: (value: boolean) => Promise<void>;
    handleSaveGreeting: () => Promise<void>;
    handleResetGreeting: () => void;
    resetToThemeColors: (themeId: string) => Promise<CustomColors>;

    // Internal state setters (for section components)
    setUseCustomColors: (value: boolean) => void;
    setCustomColorsEnabled: (value: boolean) => void;
    setLastSelectedTheme: (themeId: string) => void;
    setCustomColors: (colors: CustomColors) => void;
}
