/**
 * Theme API Endpoints
 * Public theme endpoints (unauthenticated)
 */
import { api } from '../client';

// Types
export interface ThemePreset {
    preset?: string;
    mode?: string;
}

export interface ThemeResponse {
    theme?: ThemePreset;
}

export interface DefaultThemeResponse {
    theme: string;
}

// Endpoints
export const themeApi = {
    /**
     * Get current user's theme settings
     */
    getTheme: () =>
        api.get<ThemeResponse>('/api/theme'),

    /**
     * Get admin's default theme (public endpoint, no auth required)
     */
    getDefaultTheme: () =>
        api.get<DefaultThemeResponse>('/api/theme/default'),

    /**
     * Save user theme settings
     */
    saveTheme: (theme: ThemePreset) =>
        api.put<void>('/api/theme', { theme }),
};

export default themeApi;
