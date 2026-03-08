import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useThemeQuery, useSaveTheme, useUserConfigQuery } from '../api/hooks/useConfig';
import { useRealtimeSSE } from '../hooks/useRealtimeSSE';
import logger from '../utils/logger';
import type { ThemeContextValue, ThemeOption } from '../types/context/theme';

// Import all theme CSS files
import '../styles/themes/dark-pro.css';
import '../styles/themes/nord.css';
import '../styles/themes/catppuccin.css';
import '../styles/themes/dracula.css';
import '../styles/themes/light.css';
import '../styles/themes/noir.css';
import '../styles/themes/nebula.css';

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * ThemeProvider - Provides theme state and actions
 * 
 * Modernized in P3 Phase 2 to use React Query for:
 * - Automatic caching
 * - Optimistic updates via mutation
 * - Consistent loading states
 * 
 * Settings SSE: Listens for real-time theme changes from other tabs/sessions
 */
export const ThemeProvider = ({ children }: ThemeProviderProps): React.JSX.Element => {
    const { isAuthenticated } = useAuth();

    // React Query for theme fetching
    const { data: themeData, isLoading: queryLoading } = useThemeQuery();

    // React Query mutation for saving theme
    const saveThemeMutation = useSaveTheme();

    // React Query for user config (provides flattenUI preference)
    // SSE invalidation is handled globally by useSettingsSSE() in App.tsx
    const { data: userConfigData } = useUserConfigQuery();

    // SSE for real-time theme sync across tabs/devices
    const { onThemeChange } = useRealtimeSSE();

    // Local state for optimistic updates (instant UI response)
    const [localTheme, setLocalTheme] = useState<string>(() => {
        // Initialize from localStorage for instant theme on page load
        return localStorage.getItem('framerr-theme') || 'dark-pro';
    });

    // Sync local theme with server data when it loads
    useEffect(() => {
        if (themeData?.theme?.preset) {
            setLocalTheme(themeData.theme.preset);
            // Persist to localStorage so splash screen uses correct theme on refresh
            localStorage.setItem('framerr-theme', themeData.theme.preset);
        }
    }, [themeData]);

    // Ref to skip SSE updates briefly after local changes (prevents self-bounce)
    const skipSSEUntilRef = useRef<number>(0);

    // SSE: Listen for theme changes from other tabs/sessions
    useEffect(() => {
        const unsubscribe = onThemeChange((event) => {
            logger.debug('[Theme] SSE event received', { action: event.action, preset: event.theme?.preset });

            // Skip if this is likely our own change echoing back
            if (Date.now() < skipSSEUntilRef.current) {
                logger.debug('[Theme] SSE skipped (within skip window)');
                return;
            }

            // Update local theme if preset changed
            if (event.theme?.preset && event.theme.preset !== localTheme) {
                setLocalTheme(event.theme.preset);
                localStorage.setItem('framerr-theme', event.theme.preset);
                logger.info('[Theme] Synced from SSE', { preset: event.theme.preset });
            }
        });

        return unsubscribe;
    }, [onThemeChange, localTheme]);

    // Available themes - memoized since it never changes
    const themes: ThemeOption[] = useMemo(() => [
        { id: 'dark-pro', name: 'Dark Pro', description: 'Professional dark with blue accents' },
        { id: 'nord', name: 'Nord', description: 'Nature-inspired teal & green' },
        { id: 'catppuccin', name: 'Catppuccin Mocha', description: 'Cozy pastel colors' },
        { id: 'dracula', name: 'Dracula', description: 'Vibrant purple theme' },
        { id: 'light', name: 'Light Modern', description: 'Clean white & sky blue' },
        { id: 'noir', name: 'Noir', description: 'Premium black with silver accents' },
        { id: 'nebula', name: 'Nebula', description: 'Cosmic purple with cyan glow' }
    ], []);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', localTheme);

        // Sync meta theme-color for browser chrome (address bar, PWA title bar)
        // Uses a static map instead of CSS variables to avoid timing race conditions
        const THEME_BG: Record<string, string> = {
            'dark-pro': '#0a0e1a',
            'light': '#ffffff',
            'nord': '#2e3440',
            'catppuccin': '#1e1e2e',
            'dracula': '#282a36',
            'noir': '#0f0f12',
            'nebula': '#0d0d1a',
        };
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', THEME_BG[localTheme] || '#0a0e1a');
        }
    }, [localTheme]);

    // Apply solid-ui class based on user preference (absorbed from AppDataContext in S-F4-04)
    // Without this, the class is only applied when visiting Customization Settings,
    // causing the sidebar to be semi-transparent (glass mode) until then
    useEffect(() => {
        const prefs = userConfigData?.preferences as { ui?: { flattenUI?: boolean } } | undefined;
        if (prefs?.ui?.flattenUI) {
            document.documentElement.classList.add('solid-ui');
        } else {
            document.documentElement.classList.remove('solid-ui');
        }
    }, [userConfigData]);

    // Change theme with optimistic update
    const changeTheme = useCallback(async (newTheme: string): Promise<void> => {
        const previousTheme = localTheme;

        // Optimistically update UI
        setLocalTheme(newTheme);

        // Save to localStorage for instant theme on next page load
        localStorage.setItem('framerr-theme', newTheme);

        // Save to backend if authenticated
        if (isAuthenticated) {
            // Skip SSE updates for 2 seconds to prevent our own change from bouncing back
            skipSSEUntilRef.current = Date.now() + 2000;

            try {
                await saveThemeMutation.mutateAsync({
                    preset: newTheme,
                    mode: 'dark' // TODO: Make this configurable
                });
            } catch (error) {
                logger.error('Failed to save theme', { error });
                // Revert on error
                setLocalTheme(previousTheme);
                localStorage.setItem('framerr-theme', previousTheme);
            }
        }
    }, [isAuthenticated, localTheme, saveThemeMutation]);

    // Loading state: only show loading on initial query, not during saves
    const loading = queryLoading && !themeData;

    // Memoize context value to prevent unnecessary re-renders
    const value: ThemeContextValue = useMemo(() => ({
        theme: localTheme,
        themes,
        changeTheme,
        loading
    }), [localTheme, themes, changeTheme, loading]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};


export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
