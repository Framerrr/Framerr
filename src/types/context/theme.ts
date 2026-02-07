/**
 * ThemeContext Types
 * Types for theme state and management
 */

/**
 * Theme option in theme picker
 */
export interface ThemeOption {
    id: string;
    name: string;
    description?: string;
    colors?: Record<string, string>;
}

/**
 * ThemeContext value provided to consumers
 */
export interface ThemeContextValue {
    /**
     * Current theme ID
     */
    theme: string;

    /**
     * Available themes
     */
    themes: ThemeOption[];

    /**
     * Change to a different theme
     */
    changeTheme: (themeId: string) => Promise<void>;

    /**
     * True while theme is being changed
     */
    loading: boolean;
}

/**
 * ThemeProvider props
 */
export interface ThemeProviderProps {
    children: React.ReactNode;
}

/**
 * Custom theme colors that can override defaults
 */
export interface CustomThemeColors {
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    [key: string]: string | undefined;
}
