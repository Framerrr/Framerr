/**
 * Dashboard React Query Hooks
 * 
 * Hooks for dashboard data: widgets, user preferences, debug settings
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { widgetsApi, SaveWidgetsData, WidgetsResponse } from '../endpoints/widgets';
import { configApi, UserConfig } from '../endpoints/config';
import { systemApi, SystemConfigResponse } from '../endpoints/system';
import { queryKeys } from '../queryKeys';

// ============================================================================
// WIDGETS
// ============================================================================

/**
 * Fetch all widgets (desktop + mobile layouts)
 */
export function useWidgets() {
    return useQuery({
        queryKey: queryKeys.widgets.dashboard(),
        queryFn: () => widgetsApi.getAll(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Save widgets (full layout update)
 */
export function useSaveWidgets() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SaveWidgetsData) => widgetsApi.saveAll(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
        },
    });
}

/**
 * Add widget to dashboard
 */
export function useAddWidget() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (widget: Parameters<typeof widgetsApi.addWidget>[0]) =>
            widgetsApi.addWidget(widget),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
        },
    });
}

/**
 * Remove widget from dashboard
 */
export function useRemoveWidget() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => widgetsApi.removeWidget(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
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
        staleTime: 5 * 60 * 1000, // 5 minutes
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
        staleTime: 5 * 60 * 1000, // 5 minutes
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
 * Use enabled: false for non-admin users to prevent 403 errors
 */
export function useDebugOverlay(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.system.debug(),
        queryFn: () => systemApi.getFullConfig(),
        staleTime: 5 * 60 * 1000, // 5 minutes
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

/**
 * Fetch debug config including log level (admin only)
 */
export function useDebugConfig() {
    return useQuery({
        queryKey: queryKeys.system.debug(),
        queryFn: () => systemApi.getFullConfig(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch logs with optional auto-refresh polling (admin only)
 */
export function useLogs(options?: { enabled?: boolean; refetchInterval?: number | false }) {
    return useQuery({
        queryKey: queryKeys.system.logs(),
        queryFn: async () => {
            const response = await systemApi.getAdvancedLogs();
            return response.logs || [];
        },
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval ?? false, // Consumer controls polling
        staleTime: 0, // Logs are always fresh
    });
}

/**
 * Set log level mutation (admin only)
 */
export function useSetLogLevel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (level: string) => systemApi.setLogLevel(level),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.debug() });
        },
    });
}

/**
 * Clear logs mutation (admin only)
 */
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

/**
 * Fetch system info (version, uptime, etc.)
 */
export function useSystemInfo() {
    return useQuery({
        queryKey: queryKeys.system.info(),
        queryFn: () => systemApi.getSystemInfo(),
        staleTime: 30 * 1000, // 30 seconds - relatively fresh
    });
}

/**
 * Fetch system resources (CPU, memory, disk)
 */
export function useSystemResources() {
    return useQuery({
        queryKey: queryKeys.system.resources(),
        queryFn: () => systemApi.getResources(),
        staleTime: 10 * 1000, // 10 seconds - needs to be fresh
    });
}

/**
 * Fetch SSE connection status
 */
export function useSseStatus() {
    return useQuery({
        queryKey: queryKeys.system.sseStatus(),
        queryFn: () => systemApi.getSseStatus(),
        staleTime: 30 * 1000, // 30 seconds
    });
}

/**
 * Fetch API health check
 */
export function useApiHealth() {
    return useQuery({
        queryKey: queryKeys.system.apiHealth(),
        queryFn: () => systemApi.testApiHealth(),
        staleTime: 30 * 1000, // 30 seconds
    });
}
