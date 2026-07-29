/**
 * Dashboard React Query Hooks
 *
 * Hooks for dashboard data: widgets, user preferences, debug settings
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { widgetsApi, SaveWidgetsData, WidgetsResponse } from '../endpoints/widgets';
import { configApi } from '../endpoints/config';
import { systemApi, SystemConfigResponse } from '../endpoints/system';
import { queryKeys } from '../queryKeys';
import { filterRegisteredWidgets } from '../../widgets/registry';

// ============================================================================
// WIDGETS
// ============================================================================

/**
 * Fetch widgets for a specific dashboard
 */
export function useWidgets(dashboardId: string) {
    return useQuery({
        queryKey: queryKeys.widgets.dashboard(dashboardId),
        queryFn: async (): Promise<WidgetsResponse> => {
            const data = await widgetsApi.getAll(dashboardId);
            return {
                ...data,
                widgets: filterRegisteredWidgets(data.widgets || [], 'dashboard'),
                mobileWidgets: data.mobileWidgets
                    ? filterRegisteredWidgets(data.mobileWidgets, 'dashboard-mobile')
                    : data.mobileWidgets,
            };
        },
        enabled: !!dashboardId,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Save widgets for a specific dashboard
 */
export function useSaveWidgets(dashboardId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SaveWidgetsData) => widgetsApi.saveAll(dashboardId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard(dashboardId) });
        },
    });
}

/**
 * Get widget access for current user
 */
export function useWidgetAccess() {
    return useQuery({
        queryKey: queryKeys.widgets.access(),
        queryFn: () => widgetsApi.getMyAccess(),
        staleTime: 5 * 60 * 1000,
    });
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Fetch current user's preferences (greeting, mobile disclaimer, etc.)
 */
export function useUserPreferences() {
    return useQuery({
        queryKey: queryKeys.config.user(),
        queryFn: () => configApi.getUser(),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Update user preferences
 */
export function useUpdateUserPreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Parameters<typeof configApi.updateUser>[0]) =>
            configApi.updateUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.config.user() });
        },
    });
}

// ============================================================================
// DEBUG OVERLAY (Admin only)
// ============================================================================

/**
 * Fetch debug overlay setting (admin only)
 */
export function useDebugOverlay(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.system.debug(),
        queryFn: () => systemApi.getFullConfig(),
        staleTime: 5 * 60 * 1000,
        select: (data: SystemConfigResponse) => data.config?.debug?.overlayEnabled ?? false,
        enabled: options?.enabled ?? true,
    });
}

/**
 * Update debug config (admin only)
 */
export function useUpdateDebugConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (config: Parameters<typeof systemApi.updateFullConfig>[0]) =>
            systemApi.updateFullConfig(config),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.debug() });
        },
    });
}

// ============================================================================
// DEBUG LOGS (Admin only - with polling)
// ============================================================================

export function useDebugConfig() {
    return useQuery({
        queryKey: queryKeys.system.debug(),
        queryFn: () => systemApi.getFullConfig(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useLogs(options?: { enabled?: boolean; refetchInterval?: number | false }) {
    return useQuery({
        queryKey: queryKeys.system.logs(),
        queryFn: async () => {
            const response = await systemApi.getAdvancedLogs();
            return response.logs || [];
        },
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval ?? false,
        staleTime: 0,
    });
}

export function useSetLogLevel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (level: string) => systemApi.setLogLevel(level),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.debug() });
        },
    });
}

export function useClearLogs() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => systemApi.clearAdvancedLogs(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.logs() });
        },
    });
}

// ============================================================================
// SYSTEM INFO & HEALTH (Admin diagnostics)
// ============================================================================

export function useSystemInfo() {
    return useQuery({
        queryKey: queryKeys.system.info(),
        queryFn: () => systemApi.getSystemInfo(),
        staleTime: 30 * 1000,
    });
}

export function useSystemResources() {
    return useQuery({
        queryKey: queryKeys.system.resources(),
        queryFn: () => systemApi.getResources(),
        staleTime: 10 * 1000,
    });
}

export function useSseStatus() {
    return useQuery({
        queryKey: queryKeys.system.sseStatus(),
        queryFn: () => systemApi.getSseStatus(),
        staleTime: 30 * 1000,
    });
}

export function useApiHealth() {
    return useQuery({
        queryKey: queryKeys.system.apiHealth(),
        queryFn: () => systemApi.testApiHealth(),
        staleTime: 30 * 1000,
    });
}
