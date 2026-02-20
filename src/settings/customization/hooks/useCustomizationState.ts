/**
 * Customization State Hook
 * 
 * Manages all state and handlers for the Customization Settings page.
 * 
 * P2 Migration: Thin Orchestrator with Form Pattern
 * - Server state: useUserPreferences + system config queries
 * - Local state: Form values, UI state (tabs, collapsibles)
 * - Mutations: useUpdateUserPreferences for saves
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { configApi } from '../../../api/endpoints';
import { useUserPreferences, useUpdateUserPreferences } from '../../../api/hooks/useDashboard';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { isAdmin } from '../../../utils/permissions';
import logger from '../../../utils/logger';
import { ApiError } from '../../../api/errors';
import type { SubTabId, CustomColors, OriginalGreeting, CustomizationState } from '../types';
import {
    defaultColors,
    getCurrentThemeColors,
    applyColorsToDOM,
    removeColorsFromDOM
} from '../utils/colorUtils';

interface UseCustomizationStateOptions {
    propSubTab?: string | null;
}

export function useCustomizationState(options: UseCustomizationStateOptions = {}): CustomizationState {
    const { propSubTab } = options;

    const { theme, changeTheme } = useTheme();
    const { user } = useAuth();
    const { error: showError, success: showSuccess } = useNotifications();
    const userIsAdmin = isAdmin(user);

    // ========================================================================
    // Server State (React Query)
    // ========================================================================

    const {
        data: userConfig,
        isLoading: userConfigLoading,
    } = useUserPreferences();

    const updateUserMutation = useUpdateUserPreferences();

    // ========================================================================
    // Local UI State
    // ========================================================================

    // Sub-tab Navigation
    const [internalSubTab, setInternalSubTab] = useState<SubTabId>('general');
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || internalSubTab;
    const setActiveSubTab = useCallback((id: SubTabId) => setInternalSubTab(id), []);

    // Color Theme State (local form state)
    const [customColors, setCustomColors] = useState<CustomColors>(defaultColors);
    const [useCustomColors, setUseCustomColors] = useState<boolean>(false);
    const [customColorsEnabled, setCustomColorsEnabled] = useState<boolean>(false);
    const [lastSelectedTheme, setLastSelectedTheme] = useState<string>('dark-pro');
    const [autoSaving, setAutoSaving] = useState<boolean>(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [initialized, setInitialized] = useState<boolean>(false);

    // Application Branding State (admin only)
    const [applicationName, setApplicationName] = useState<string>('Framerr');
    const [applicationIcon, setApplicationIcon] = useState<string>('Server');
    const [savingAppName, setSavingAppName] = useState<boolean>(false);
    const [originalAppName, setOriginalAppName] = useState<string>('Framerr');
    const [originalAppIcon, setOriginalAppIcon] = useState<string>('Server');
    const [hasAppNameChanges, setHasAppNameChanges] = useState<boolean>(false);

    // Flatten UI State
    const [flattenUI, setFlattenUI] = useState<boolean>(false);
    const [savingFlattenUI, setSavingFlattenUI] = useState<boolean>(false);

    // Greeting State
    const [greetingMode, setGreetingMode] = useState<'auto' | 'manual'>('auto');
    const [greetingText, setGreetingText] = useState<string>('Welcome back, {user}');
    const [headerVisible, setHeaderVisible] = useState<boolean>(true);
    const [taglineEnabled, setTaglineEnabled] = useState<boolean>(true);
    const [taglineText, setTaglineText] = useState<string>('Your personal dashboard');
    const [tones, setTones] = useState<string[]>(['standard', 'witty', 'nerdy']);
    const [loadingMessagesEnabled, setLoadingMessagesEnabled] = useState<boolean>(true);
    const [savingGreeting, setSavingGreeting] = useState<boolean>(false);
    const [originalGreeting, setOriginalGreeting] = useState<OriginalGreeting>({
        enabled: true,
        mode: 'auto',
        text: 'Welcome back, {user}',
        headerVisible: true,
        taglineEnabled: true,
        taglineText: 'Your personal dashboard',
        tones: ['standard', 'witty', 'nerdy'],
        loadingMessages: true
    });
    const [hasGreetingChanges, setHasGreetingChanges] = useState<boolean>(false);

    // Collapsible Sections
    const [statusColorsExpanded, setStatusColorsExpanded] = useState<boolean>(false);
    const [advancedExpanded, setAdvancedExpanded] = useState<boolean>(false);

    // Derived loading state
    const loading = userConfigLoading && !initialized;

    // ========================================================================
    // Initialize from Server Data
    // ========================================================================

    // Initialize form state from server data when it loads
    useEffect(() => {
        if (!userConfig || initialized) return;

        // Theme/colors initialization
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

        // Solid UI initialization (stored as flattenUI for backward compat)
        const prefs = userConfig.preferences as { ui?: { flattenUI?: boolean }; dashboardGreeting?: { enabled?: boolean; mode?: string; text?: string; headerVisible?: boolean; taglineEnabled?: boolean; taglineText?: string } } | undefined;
        if (prefs?.ui?.flattenUI !== undefined) {
            const shouldFlatten = prefs.ui.flattenUI;
            setFlattenUI(shouldFlatten);
            if (shouldFlatten) {
                document.documentElement.classList.add('solid-ui');
            }
        }

        // Greeting initialization
        if (prefs?.dashboardGreeting) {
            const greeting = prefs.dashboardGreeting as typeof prefs.dashboardGreeting & { tones?: string[]; loadingMessages?: boolean };
            const mode = greeting.mode || 'auto';
            const text = greeting.text || 'Welcome back, {user}';
            const displayName = user?.displayName || user?.username || 'User';
            const resolvedText = text.replace(/\{user\}/gi, displayName);
            const hdrVisible = greeting.headerVisible ?? true;
            const tEnabled = greeting.taglineEnabled ?? greeting.enabled ?? true;
            const tText = greeting.taglineText || greeting.text || 'Your personal dashboard';
            setGreetingMode(mode as 'auto' | 'manual');
            setGreetingText(resolvedText);
            setHeaderVisible(hdrVisible);
            setTaglineEnabled(tEnabled);
            setTaglineText(tText);
            const gTones = greeting.tones || ['standard', 'witty', 'nerdy'];
            const gLoadingMsgs = greeting.loadingMessages ?? true;
            setTones(gTones);
            setLoadingMessagesEnabled(gLoadingMsgs);
            setOriginalGreeting({
                enabled: tEnabled,
                mode: mode as 'auto' | 'manual',
                text: resolvedText,
                headerVisible: hdrVisible,
                taglineEnabled: tEnabled,
                taglineText: tText,
                tones: gTones,
                loadingMessages: gLoadingMsgs
            });
        }

        setInitialized(true);
    }, [userConfig, initialized]);

    // Load system config for admin (separate from user config)
    useEffect(() => {
        if (!userIsAdmin || !initialized) return;

        const loadSystemConfig = async () => {
            try {
                const systemConfig = await configApi.getSystem();

                if (systemConfig?.server?.name) {
                    const name = systemConfig.server.name;
                    setApplicationName(name);
                    setOriginalAppName(name);
                }

                if (systemConfig?.server?.icon) {
                    const icon = systemConfig.server.icon;
                    setApplicationIcon(icon);
                    setOriginalAppIcon(icon);
                }
            } catch (error) {
                // Silently ignore 403 errors (non-admin users)
                if (!(error instanceof ApiError && error.status === 403)) {
                    logger.error('Failed to load system config:', error);
                }
            }
        };

        loadSystemConfig();
    }, [userIsAdmin, initialized]);

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

    // Track changes for Application Name & Icon
    useEffect(() => {
        setHasAppNameChanges(
            applicationName !== originalAppName ||
            applicationIcon !== originalAppIcon
        );
    }, [applicationName, applicationIcon, originalAppName, originalAppIcon]);

    // Track changes for Greeting
    useEffect(() => {
        setHasGreetingChanges(
            greetingMode !== originalGreeting.mode ||
            greetingText !== originalGreeting.text ||
            headerVisible !== originalGreeting.headerVisible ||
            taglineEnabled !== originalGreeting.taglineEnabled ||
            taglineText !== originalGreeting.taglineText ||
            JSON.stringify(tones) !== JSON.stringify(originalGreeting.tones) ||
            loadingMessagesEnabled !== originalGreeting.loadingMessages
        );
    }, [greetingMode, greetingText, headerVisible, taglineEnabled, taglineText, tones, loadingMessagesEnabled, originalGreeting]);

    // ========================================================================
    // Helpers
    // ========================================================================

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

    // ========================================================================
    // Handlers
    // ========================================================================

    // Color change handler with debounced auto-save
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
                    await updateUserMutation.mutateAsync({
                        theme: {
                            mode: 'custom',
                            customColors: updated,
                            lastSelectedTheme: lastSelectedTheme
                        }
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
    }, [customColorsEnabled, lastSelectedTheme, updateUserMutation]);

    // Toggle custom colors on/off
    const handleToggleCustomColors = useCallback(async (enabled: boolean): Promise<void> => {
        if (enabled) {
            setCustomColorsEnabled(true);
            setLastSelectedTheme(theme);
            setUseCustomColors(false);
        } else {
            setCustomColorsEnabled(false);
            setUseCustomColors(false);
            await resetToThemeColors(lastSelectedTheme);
            try {
                await updateUserMutation.mutateAsync({
                    theme: { mode: lastSelectedTheme }
                });
            } catch (error) {
                logger.error('Failed to revert to theme:', error);
            }
        }
    }, [theme, lastSelectedTheme, resetToThemeColors, updateUserMutation]);

    // Save custom colors
    const handleSaveCustomColors = useCallback(async (): Promise<void> => {
        if (!customColorsEnabled) return;

        setSaving(true);
        try {
            await updateUserMutation.mutateAsync({
                theme: {
                    mode: 'custom',
                    customColors: customColors,
                    lastSelectedTheme: lastSelectedTheme
                }
            });
            setUseCustomColors(true);
            applyColorsToDOM(customColors);
        } catch (error) {
            logger.error('Failed to save custom colors:', error);
            showError('Save Failed', 'Failed to save custom colors. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [customColorsEnabled, customColors, lastSelectedTheme, updateUserMutation, showError]);

    // Reset colors to default
    const handleResetColors = useCallback(async (): Promise<void> => {
        try {
            setCustomColors(defaultColors);
            setUseCustomColors(false);
            await updateUserMutation.mutateAsync({
                theme: {
                    mode: 'dark-pro',
                    customColors: defaultColors
                }
            });
            Object.keys(customColors).forEach(key => {
                document.documentElement.style.removeProperty(`--${key}`);
            });
        } catch (error) {
            logger.error('Failed to reset colors:', error);
            showError('Reset Failed', 'Failed to reset colors. Please try again.');
        }
    }, [customColors, updateUserMutation, showError]);

    // Save application name and icon (admin only)
    const handleSaveApplicationName = useCallback(async (): Promise<void> => {
        setSavingAppName(true);
        try {
            await configApi.updateSystem({
                server: {
                    name: applicationName,
                    icon: applicationIcon
                }
            });

            window.dispatchEvent(new CustomEvent('appNameUpdated', {
                detail: { appName: applicationName }
            }));
            window.dispatchEvent(new Event('systemConfigUpdated'));

            setOriginalAppName(applicationName);
            setOriginalAppIcon(applicationIcon);

            logger.info('Application name and icon saved successfully');
            showSuccess('Settings Saved', 'Application name and icon updated');
        } catch (error) {
            logger.error('Failed to save application name:', error);
            showError('Save Failed', 'Failed to save application name. Please try again.');
        } finally {
            setSavingAppName(false);
        }
    }, [applicationName, applicationIcon, showSuccess, showError]);

    // Toggle solid UI mode (optimistic update)
    const handleToggleFlattenUI = useCallback(async (value: boolean): Promise<void> => {
        const previousValue = flattenUI;

        // Optimistic update
        setFlattenUI(value);
        if (value) {
            document.documentElement.classList.add('solid-ui');
        } else {
            document.documentElement.classList.remove('solid-ui');
        }

        setSavingFlattenUI(true);
        try {
            await updateUserMutation.mutateAsync({
                preferences: { ui: { flattenUI: value } }
            });
            logger.info('Solid UI preference saved');
        } catch (error) {
            // Rollback on error
            logger.error('Failed to save solid UI preference:', error);
            showError('Save Failed', 'Failed to save solid UI preference.');

            setFlattenUI(previousValue);
            if (previousValue) {
                document.documentElement.classList.add('solid-ui');
            } else {
                document.documentElement.classList.remove('solid-ui');
            }
        } finally {
            setSavingFlattenUI(false);
        }
    }, [flattenUI, updateUserMutation, showError]);

    // Save greeting
    const handleSaveGreeting = useCallback(async (): Promise<void> => {
        setSavingGreeting(true);
        try {
            await updateUserMutation.mutateAsync({
                preferences: {
                    dashboardGreeting: {
                        enabled: taglineEnabled,
                        mode: greetingMode,
                        text: greetingText,
                        headerVisible,
                        taglineEnabled,
                        taglineText,
                        tones,
                        loadingMessages: loadingMessagesEnabled
                    }
                }
            });

            setOriginalGreeting({
                enabled: taglineEnabled,
                mode: greetingMode,
                text: greetingText,
                headerVisible,
                taglineEnabled,
                taglineText,
                tones,
                loadingMessages: loadingMessagesEnabled
            });

            window.dispatchEvent(new CustomEvent('greetingUpdated', {
                detail: {
                    mode: greetingMode,
                    text: greetingText,
                    headerVisible,
                    taglineEnabled,
                    taglineText,
                    tones,
                    loadingMessages: loadingMessagesEnabled
                }
            }));

            // Persist to localStorage for instant splash screen preference on next load
            localStorage.setItem('framerr-loading-messages', String(loadingMessagesEnabled));

            logger.info('Greeting saved successfully');
            showSuccess('Greeting Saved', 'Dashboard greeting updated');
        } catch (error) {
            logger.error('Failed to save greeting:', error);
            showError('Save Failed', 'Failed to save greeting. Please try again.');
        } finally {
            setSavingGreeting(false);
        }
    }, [greetingMode, greetingText, headerVisible, taglineEnabled, taglineText, tones, loadingMessagesEnabled, updateUserMutation, showSuccess, showError]);

    // Reset greeting
    const handleResetGreeting = useCallback((): void => {
        setGreetingMode('auto');
        const displayName = user?.displayName || user?.username || 'User';
        setGreetingText(`Welcome back, ${displayName}`);
        setHeaderVisible(true);
        setTaglineEnabled(true);
        setTaglineText('Your personal dashboard');
        setTones(['standard', 'witty', 'nerdy']);
        setLoadingMessagesEnabled(true);
    }, []);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // Sub-tab Navigation
        activeSubTab,
        setActiveSubTab,

        // Color Theme State
        customColors,
        useCustomColors,
        customColorsEnabled,
        lastSelectedTheme,
        autoSaving,
        saving,
        loading,

        // Application Branding State
        applicationName,
        setApplicationName,
        applicationIcon,
        setApplicationIcon,
        savingAppName,
        hasAppNameChanges,

        // Flatten UI State
        flattenUI,
        savingFlattenUI,

        // Greeting State
        greetingMode,
        setGreetingMode,
        greetingText,
        setGreetingText,
        headerVisible,
        setHeaderVisible,
        taglineEnabled,
        setTaglineEnabled,
        taglineText,
        setTaglineText,
        tones,
        setTones,
        loadingMessagesEnabled,
        setLoadingMessagesEnabled,
        savingGreeting,
        hasGreetingChanges,

        // Collapsible Sections
        statusColorsExpanded,
        setStatusColorsExpanded,
        advancedExpanded,
        setAdvancedExpanded,

        // Handlers
        handleColorChange,
        handleToggleCustomColors,
        handleSaveCustomColors,
        handleResetColors,
        handleSaveApplicationName,
        handleToggleFlattenUI,
        handleSaveGreeting,
        handleResetGreeting,
        resetToThemeColors,

        // Internal state setters (for section components)
        setUseCustomColors,
        setCustomColorsEnabled,
        setLastSelectedTheme,
        setCustomColors,
    };
}
