/**
 * Color Theme Controller Hook
 *
 * Manages color/theme state and handlers for the Customization Settings page.
 * Extracted from useCustomizationState as part of S-X5-04.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CustomColors, ColorThemeState } from '../types';
import {
    defaultColors,
    getCurrentThemeColors,
    applyColorsToDOM,
    removeColorsFromDOM
} from '../utils/colorUtils';
import logger from '../../../utils/logger';

interface UseColorThemeControllerParams {
    userConfig: {
        theme?: {
            mode?: string;
            preset?: string;
            customColors?: Partial<CustomColors> | null;
            lastSelectedTheme?: string;
        };
    } | undefined;
    initialized: boolean;
    theme: string;
    changeTheme: (themeId: string) => Promise<void>;
    saveThemeMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> };
    showError: (title: string, message: string) => void;
}

export function useColorThemeController({
    userConfig,
    initialized,
    theme,
    changeTheme,
    saveThemeMutation,
    showError,
}: UseColorThemeControllerParams): ColorThemeState {
    // Local form state
    const [customColors, setCustomColors] = useState<CustomColors>(defaultColors);
    const [useCustomColors, setUseCustomColors] = useState<boolean>(false);
    const [customColorsEnabled, setCustomColorsEnabled] = useState<boolean>(false);
    const [lastSelectedTheme, setLastSelectedTheme] = useState<string>('dark-pro');
    const [autoSaving, setAutoSaving] = useState<boolean>(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    // Collapsible UI state (color-domain view state, per F4)
    const [statusColorsExpanded, setStatusColorsExpanded] = useState<boolean>(false);
    const [advancedExpanded, setAdvancedExpanded] = useState<boolean>(false);

    // Initialize from server data
    useEffect(() => {
        if (!userConfig || !initialized) return;

        if (userConfig.theme?.customColors) {
            const mergedColors: CustomColors = {
                ...defaultColors,
                ...userConfig.theme.customColors as CustomColors
            };

            if (userConfig.theme.mode === 'custom') {
                setCustomColorsEnabled(true);
                setCustomColors(mergedColors);
                setUseCustomColors(true);
                applyColorsToDOM(mergedColors);

                if (userConfig.theme.lastSelectedTheme) {
                    setLastSelectedTheme(userConfig.theme.lastSelectedTheme);
                }
            } else {
                setCustomColorsEnabled(false);
                if (userConfig.theme.preset) {
                    setLastSelectedTheme(userConfig.theme.preset);
                } else if (userConfig.theme.mode && userConfig.theme.mode !== 'custom') {
                    setLastSelectedTheme(userConfig.theme.mode);
                }
                const themeColors = getCurrentThemeColors();
                setCustomColors(themeColors);
            }
        } else {
            setCustomColorsEnabled(false);
            const themeColors = getCurrentThemeColors();
            setCustomColors(themeColors);
        }
    }, [userConfig, initialized]);

    // Update color pickers when theme changes (if custom colors are disabled)
    useEffect(() => {
        if (!customColorsEnabled && initialized) {
            const timer = setTimeout(() => {
                const themeColors = getCurrentThemeColors();
                setCustomColors(themeColors);
            }, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [theme, customColorsEnabled, initialized]);

    // Reset to theme colors helper
    const resetToThemeColors = useCallback(async (themeId: string): Promise<CustomColors> => {
        removeColorsFromDOM();
        await changeTheme(themeId);
        document.documentElement.offsetHeight;
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        const themeColors = getCurrentThemeColors();
        setCustomColors(themeColors);
        return themeColors;
    }, [changeTheme]);

    // Color change handler with debounced auto-save
    // [F2 Bug Fix] Fixed dep array: uses saveThemeMutation instead of updateUserMutation
    const handleColorChange = useCallback((key: string, value: string): void => {
        if (!customColorsEnabled) return;

        setCustomColors(prev => {
            const updated = { ...prev, [key]: value };

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            setAutoSaving(true);

            saveTimerRef.current = setTimeout(async () => {
                try {
                    applyColorsToDOM(updated);
                    await saveThemeMutation.mutateAsync({
                        mode: 'custom',
                        customColors: updated,
                        lastSelectedTheme: lastSelectedTheme
                    });
                    setUseCustomColors(true);
                } catch (error) {
                    logger.error('Failed to auto-save custom colors:', error);
                } finally {
                    setAutoSaving(false);
                }
            }, 500);

            return updated;
        });
    }, [customColorsEnabled, lastSelectedTheme, saveThemeMutation]);

    // Toggle custom colors on/off
    const handleToggleCustomColors = useCallback(async (enabled: boolean): Promise<void> => {
        if (enabled) {
            setCustomColorsEnabled(true);
            setLastSelectedTheme(theme);
            setUseCustomColors(false);
        } else {
            setCustomColorsEnabled(false);
            setUseCustomColors(false);
            try {
                await resetToThemeColors(lastSelectedTheme);
            } catch (error) {
                logger.error('Failed to revert to theme:', error);
            }
        }
    }, [theme, lastSelectedTheme, resetToThemeColors]);

    // Save custom colors
    // [F2 Bug Fix] Fixed dep array: uses saveThemeMutation instead of updateUserMutation
    const handleSaveCustomColors = useCallback(async (): Promise<void> => {
        if (!customColorsEnabled) return;

        setSaving(true);
        try {
            await saveThemeMutation.mutateAsync({
                mode: 'custom',
                customColors: customColors,
                lastSelectedTheme: lastSelectedTheme
            });
            setUseCustomColors(true);
            applyColorsToDOM(customColors);
        } catch (error) {
            logger.error('Failed to save custom colors:', error);
            showError('Save Failed', 'Failed to save custom colors. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [customColorsEnabled, customColors, lastSelectedTheme, saveThemeMutation, showError]);

    // Reset colors to default
    // [F2 Bug Fix] Fixed dep array: uses saveThemeMutation instead of updateUserMutation
    const handleResetColors = useCallback(async (): Promise<void> => {
        try {
            setCustomColors(defaultColors);
            setUseCustomColors(false);
            await saveThemeMutation.mutateAsync({
                preset: 'dark-pro',
                mode: 'dark-pro',
                customColors: defaultColors
            });
            Object.keys(customColors).forEach(key => {
                document.documentElement.style.removeProperty(`--${key}`);
            });
        } catch (error) {
            logger.error('Failed to reset colors:', error);
            showError('Reset Failed', 'Failed to reset colors. Please try again.');
        }
    }, [customColors, saveThemeMutation, showError]);

    return {
        customColors,
        useCustomColors,
        customColorsEnabled,
        lastSelectedTheme,
        autoSaving,
        saving,
        statusColorsExpanded,
        setStatusColorsExpanded,
        advancedExpanded,
        setAdvancedExpanded,
        handleColorChange,
        handleToggleCustomColors,
        handleSaveCustomColors,
        handleResetColors,
        resetToThemeColors,
        setUseCustomColors,
        setCustomColorsEnabled,
        setLastSelectedTheme,
        setCustomColors,
    };
}
