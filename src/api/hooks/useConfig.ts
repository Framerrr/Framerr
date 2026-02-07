/**
 * Config React Query Hooks
 * 
 * Hooks for system config, user config, and theme
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { configApi, type GlobalSystemConfig, type UserConfig, type ThemeConfig } from '../endpoints/config';
import { themeApi, type ThemeResponse, type ThemePreset } from '../endpoints/theme';
import { queryKeys } from '../queryKeys';


// ============================================================================
// SYSTEM CONFIG (Admin only)
// ============================================================================

/**
 * Fetch system-wide configuration (admin only)
 * Returns empty config for non-admins
 */
export function useSystemConfigQuery() {
    const { user, isAuthenticated } = useAuth();
    const canAccess = isAuthenticated && user && isAdmin(user);

    return useQuery({
        queryKey: queryKeys.system.config(),
        queryFn: async () => {
            if (!canAccess) {
                // Return empty config for non-admins
                return { groups: [], tabGroups: [] } as GlobalSystemConfig;
            }
            return configApi.getSystem();
        },
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });
}

/**
 * Update system-wide configuration
 */
export function useUpdateSystemConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<GlobalSystemConfig>) => configApi.updateSystem(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.config() });
            // Dispatch event for backwards compatibility with existing listeners
            window.dispatchEvent(new CustomEvent('systemConfigUpdated'));
        },
    });
}


// ============================================================================
// THEME
// ============================================================================

/**
 * Fetch current user's theme settings
 */
export function useThemeQuery() {
    const { isAuthenticated } = useAuth();

    return useQuery({
        queryKey: queryKeys.theme.current(),
        queryFn: () => themeApi.getTheme(),
        enabled: isAuthenticated,
        staleTime: Infinity, // Theme rarely changes
        refetchOnWindowFocus: false,
    });
}

/**
 * Save user theme settings
 */
export function useSaveTheme() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (theme: ThemePreset) => themeApi.saveTheme(theme),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.theme.current() });
        },
    });
}


// ============================================================================
// USER CONFIG
// ============================================================================

/**
 * Fetch current user's config/preferences
 */
export function useUserConfigQuery() {
    const { isAuthenticated } = useAuth();

    return useQuery({
        queryKey: queryKeys.config.user(),
        queryFn: () => configApi.getUser(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Update current user's config/preferences
 */
export function useUpdateUserConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { theme?: ThemeConfig; preferences?: Parameters<typeof configApi.updateUser>[0]['preferences'] }) =>
            configApi.updateUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.config.user() });
        },
    });
}
