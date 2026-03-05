/**
 * Customization State Hook — Thin Orchestrator
 *
 * Composes domain-specific controller hooks and returns the unified
 * CustomizationState interface. Consumers (ColorsPage, GeneralPage)
 * are unaffected — the return shape is identical.
 *
 * Split from monolithic 571-line hook as part of S-X5-04.
 *
 * TODO (F5): Both ColorsPage and GeneralPage instantiate all 4 controllers
 * via this orchestrator. Per-page direct controller usage is a future
 * optimization when consumers are updated to import controllers directly.
 */

import { useState, useCallback, useEffect } from 'react';
import { useUserPreferences, useUpdateUserPreferences } from '../../../api/hooks/useDashboard';
import { useSaveTheme } from '../../../api/hooks/useConfig';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { isAdmin } from '../../../utils/permissions';
import type { SubTabId, CustomizationState } from '../types';
import { useColorThemeController } from './useColorThemeController';
import { useBrandingController } from './useBrandingController';
import { useFlattenUIController } from './useFlattenUIController';
import { useGreetingController } from './useGreetingController';

interface UseCustomizationStateOptions {
    propSubTab?: string | null;
}

export function useCustomizationState(options: UseCustomizationStateOptions = {}): CustomizationState {
    const { propSubTab } = options;

    // ========================================================================
    // Shared Dependencies
    // ========================================================================

    const { theme, changeTheme } = useTheme();
    const { user } = useAuth();
    const { error: showError, success: showSuccess } = useNotifications();
    const userIsAdmin = isAdmin(user);

    const {
        data: userConfig,
        isLoading: userConfigLoading,
    } = useUserPreferences();

    const updateUserMutation = useUpdateUserPreferences();
    const saveThemeMutation = useSaveTheme();

    // ========================================================================
    // Orchestrator-Level State
    // ========================================================================

    // Sub-tab Navigation (trivial — 3 lines)
    const [internalSubTab, setInternalSubTab] = useState<SubTabId>('general');
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || internalSubTab;
    const setActiveSubTab = useCallback((id: SubTabId) => setInternalSubTab(id), []);

    // Initialization tracking
    const [initialized, setInitialized] = useState<boolean>(false);

    // Derived loading state
    const loading = userConfigLoading && !initialized;

    // Mark initialized once userConfig loads
    // (Controllers depend on initialized flag — set it here once)
    useEffect(() => {
        if (userConfig && !initialized) {
            setInitialized(true);
        }
    }, [userConfig, initialized]);

    // ========================================================================
    // Domain Controllers
    // ========================================================================

    const colorTheme = useColorThemeController({
        userConfig,
        initialized,
        theme,
        changeTheme,
        saveThemeMutation,
        showError,
    });

    const branding = useBrandingController({
        userIsAdmin,
        initialized,
        showSuccess,
        showError,
    });

    const flattenUI = useFlattenUIController({
        userConfig,
        initialized,
        updateUserMutation,
        showError,
    });

    const greeting = useGreetingController({
        userConfig,
        initialized,
        user,
        updateUserMutation,
        showSuccess,
        showError,
    });

    // ========================================================================
    // Compose Return — exact same shape as before
    // ========================================================================

    return {
        // Sub-tab Navigation
        activeSubTab,
        setActiveSubTab,

        // Color Theme State
        customColors: colorTheme.customColors,
        useCustomColors: colorTheme.useCustomColors,
        customColorsEnabled: colorTheme.customColorsEnabled,
        lastSelectedTheme: colorTheme.lastSelectedTheme,
        autoSaving: colorTheme.autoSaving,
        saving: colorTheme.saving,
        loading,

        // Application Branding State
        applicationName: branding.applicationName,
        setApplicationName: branding.setApplicationName,
        applicationIcon: branding.applicationIcon,
        setApplicationIcon: branding.setApplicationIcon,
        savingAppName: branding.savingAppName,
        hasAppNameChanges: branding.hasAppNameChanges,

        // Flatten UI State
        flattenUI: flattenUI.flattenUI,
        savingFlattenUI: flattenUI.savingFlattenUI,

        // Greeting State
        greetingMode: greeting.greetingMode,
        setGreetingMode: greeting.setGreetingMode,
        greetingText: greeting.greetingText,
        setGreetingText: greeting.setGreetingText,
        headerVisible: greeting.headerVisible,
        setHeaderVisible: greeting.setHeaderVisible,
        taglineEnabled: greeting.taglineEnabled,
        setTaglineEnabled: greeting.setTaglineEnabled,
        taglineText: greeting.taglineText,
        setTaglineText: greeting.setTaglineText,
        tones: greeting.tones,
        setTones: greeting.setTones,
        loadingMessagesEnabled: greeting.loadingMessagesEnabled,
        setLoadingMessagesEnabled: greeting.setLoadingMessagesEnabled,
        savingGreeting: greeting.savingGreeting,
        hasGreetingChanges: greeting.hasGreetingChanges,

        // Collapsible Sections
        statusColorsExpanded: colorTheme.statusColorsExpanded,
        setStatusColorsExpanded: colorTheme.setStatusColorsExpanded,
        advancedExpanded: colorTheme.advancedExpanded,
        setAdvancedExpanded: colorTheme.setAdvancedExpanded,

        // Handlers
        handleColorChange: colorTheme.handleColorChange,
        handleToggleCustomColors: colorTheme.handleToggleCustomColors,
        handleSaveCustomColors: colorTheme.handleSaveCustomColors,
        handleResetColors: colorTheme.handleResetColors,
        handleSaveApplicationName: branding.handleSaveApplicationName,
        handleToggleFlattenUI: flattenUI.handleToggleFlattenUI,
        handleSaveGreeting: greeting.handleSaveGreeting,
        handleResetGreeting: greeting.handleResetGreeting,
        resetToThemeColors: colorTheme.resetToThemeColors,

        // Internal state setters (for section components)
        setUseCustomColors: colorTheme.setUseCustomColors,
        setCustomColorsEnabled: colorTheme.setCustomColorsEnabled,
        setLastSelectedTheme: colorTheme.setLastSelectedTheme,
        setCustomColors: colorTheme.setCustomColors,
    };
}
