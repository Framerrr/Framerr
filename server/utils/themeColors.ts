/**
 * Theme Color Map — shared between splash injection and manifest endpoint
 *
 * Extracted from server/index.ts to prevent duplication and circular imports.
 * Each theme maps to its primary background, text, and accent colors.
 */

import { getUserConfig } from '../db/userConfig';
import { getSystemConfig } from '../db/systemConfig';
import logger from './logger';

export interface ThemeColors {
    bg: string;
    text: string;
    accent: string;
}

export const THEME_SPLASH_COLORS: Record<string, ThemeColors> = {
    'dark-pro': { bg: '#0a0e1a', text: '#94a3b8', accent: '#3b82f6' },
    'light': { bg: '#ffffff', text: '#6b7280', accent: '#3b82f6' },
    'nord': { bg: '#2e3440', text: '#81a1c1', accent: '#88c0d0' },
    'catppuccin': { bg: '#1e1e2e', text: '#bac2de', accent: '#89b4fa' },
    'dracula': { bg: '#282a36', text: '#e6e6e6', accent: '#bd93f9' },
    'noir': { bg: '#0f0f12', text: '#888888', accent: '#8a9ba8' },
    'nebula': { bg: '#0d0d1a', text: '#94a3b8', accent: '#a855f7' },
};

export const DEFAULT_SPLASH_COLORS = THEME_SPLASH_COLORS['dark-pro'];

/**
 * Resolve theme colors for a given request context.
 *
 * Resolution chain:
 * 1. Authenticated user → user config → preset or custom colors
 * 2. Not authenticated → loginTheme from system config
 * 3. Final fallback → dark-pro defaults
 *
 * Mirrors the splash injection logic in server/index.ts to prevent drift.
 */
export async function resolveThemeColors(
    user: { id?: string } | undefined,
): Promise<ThemeColors> {
    try {
        if (user?.id) {
            // Authenticated — use the user's personal theme
            const config = await getUserConfig(user.id);
            const userTheme = config?.theme as {
                preset?: string;
                mode?: string;
                customColors?: Record<string, string>;
            } | undefined;

            const preset = userTheme?.preset || userTheme?.mode || 'dark-pro';

            if (preset === 'custom' && userTheme?.customColors?.['bg-primary']) {
                return {
                    bg: userTheme.customColors['bg-primary'],
                    text: userTheme.customColors['text-secondary'] || DEFAULT_SPLASH_COLORS.text,
                    accent: userTheme.customColors['accent'] || DEFAULT_SPLASH_COLORS.accent,
                };
            }

            return THEME_SPLASH_COLORS[preset] || DEFAULT_SPLASH_COLORS;
        }

        // Not authenticated — use loginTheme from system config
        const sysConfig = await getSystemConfig();
        const loginTheme = sysConfig.loginTheme || 'dark-pro';
        return THEME_SPLASH_COLORS[loginTheme] || DEFAULT_SPLASH_COLORS;
    } catch (err) {
        logger.debug(`[ThemeColors] Could not resolve theme colors, using defaults: ${(err as Error).message}`);
        return DEFAULT_SPLASH_COLORS;
    }
}
