/**
 * Settings React Query Hooks
 * 
 * Hooks for settings pages: backup, user groups, tabs, tab groups
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi, BackupListResponse, ScheduleConfig, ScheduleResponse } from '../endpoints/backup';
import { userGroupsApi, UserGroup } from '../endpoints/userGroups';
import { tabsApi } from '../endpoints/tabs';
import { tabGroupsApi } from '../endpoints/tabGroups';
import { configApi } from '../endpoints/config';
import { integrationsApi } from '../endpoints/integrations';
import { systemApi } from '../endpoints/system';
import { queryKeys } from '../queryKeys';

// ============================================================================
// BACKUP
// ============================================================================

/**
 * Fetch backup list
 */
export function useBackupList() {
    return useQuery({
        queryKey: queryKeys.backup.list(),
        queryFn: () => backupApi.list(),
        staleTime: 1 * 60 * 1000, // 1 minute - backups can change
    });
}

/**
 * Fetch backup schedule configuration
 */
export function useBackupSchedule() {
    return useQuery({
        queryKey: queryKeys.backup.schedule(),
        queryFn: () => backupApi.getSchedule(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Create a new backup
 */
export function useCreateBackup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => backupApi.create(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.backup.list() });
        },
    });
}

/**
 * Delete a backup
 */
export function useDeleteBackup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (filename: string) => backupApi.delete(filename),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.backup.list() });
        },
    });
}

/**
 * Update backup schedule
 */
export function useUpdateBackupSchedule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (config: ScheduleConfig) => backupApi.updateSchedule(config),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.backup.schedule() });
        },
    });
}

// ============================================================================
// USER GROUPS
// ============================================================================

/**
 * Fetch all user groups
 */
export function useUserGroupsList() {
    return useQuery({
        queryKey: queryKeys.userGroups.list(),
        queryFn: () => userGroupsApi.getAll(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch single user group
 */
export function useUserGroup(id: string) {
    return useQuery({
        queryKey: queryKeys.userGroups.detail(id),
        queryFn: () => userGroupsApi.getById(id),
        enabled: !!id,
    });
}

/**
 * Create user group
 */
export function useCreateUserGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { name: string; description?: string }) =>
            userGroupsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userGroups.list() });
        },
    });
}

/**
 * Update user group
 */
export function useUpdateUserGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
            userGroupsApi.update(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userGroups.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.userGroups.detail(variables.id) });
        },
    });
}

/**
 * Delete user group
 */
export function useDeleteUserGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => userGroupsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userGroups.list() });
        },
    });
}

// ============================================================================
// TABS
// ============================================================================

/**
 * Fetch all tabs
 */
export function useTabsList() {
    return useQuery({
        queryKey: queryKeys.tabs.list(),
        queryFn: () => tabsApi.getAll(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Create a new tab
 */
export function useCreateTab() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Parameters<typeof tabsApi.create>[0]) =>
            tabsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tabs.list() });
        },
    });
}

/**
 * Update a tab
 */
export function useUpdateTab() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tabsApi.update>[1] }) =>
            tabsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tabs.list() });
        },
    });
}

/**
 * Delete a tab
 */
export function useDeleteTab() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => tabsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tabs.list() });
        },
    });
}

/**
 * Reorder tabs
 */
export function useReorderTabs() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (orderedIds: string[]) => tabsApi.reorder(orderedIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tabs.list() });
        },
    });
}

// ============================================================================
// TAB GROUPS (Per-User)
// ============================================================================

/** Tab group type */
export interface TabGroup {
    id: string;
    name: string;
    order?: number;
    icon?: string | null;
}

/**
 * Fetch all tab groups for current user
 */
export function useTabGroupsList() {
    return useQuery({
        queryKey: queryKeys.tabs.groups(),
        queryFn: async () => {
            const response = await tabGroupsApi.getAll();
            return (response.tabGroups || []).sort((a, b) =>
                (a.order ?? 0) - (b.order ?? 0)
            ) as TabGroup[];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Update tab groups (batch update - create, update, delete, reorder)
 */
export function useUpdateTabGroups() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tabGroups: TabGroup[]) =>
            tabGroupsApi.batchUpdate(tabGroups.map((g, idx) => ({
                id: g.id,
                name: g.name,
                order: g.order ?? idx
            }))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tabs.groups() });
        },
    });
}

// ============================================================================
// AUTH CONFIG
// ============================================================================

/** Re-export AuthConfig type from endpoint */
export type { AuthConfig } from '../endpoints/config';

/**
 * Fetch auth configuration (proxy + iframe settings)
 */
export function useAuthConfig() {
    return useQuery({
        queryKey: queryKeys.auth.config(),
        queryFn: () => configApi.getAuth(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Update auth configuration
 */
export function useUpdateAuthConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Parameters<typeof configApi.updateAuth>[0]) =>
            configApi.updateAuth(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.config() });
        },
    });
}

// ============================================================================
// PERMISSION GROUPS
// ============================================================================

/** Permission group type */
export interface PermissionGroup {
    id: string;
    name: string;
    permissions: string[];
}

/** Permission groups response shape from system config */
interface PermissionGroupsWithDefault {
    groups: PermissionGroup[];
    defaultGroup: string;
}

/**
 * Fetch permission groups from system config
 */
export function usePermissionGroups() {
    return useQuery({
        queryKey: queryKeys.system.permissionGroups(),
        queryFn: async (): Promise<PermissionGroupsWithDefault> => {
            const config = await configApi.getSystem();
            const groupsData = (config as { groups?: Record<string, Omit<PermissionGroup, 'id'>> }).groups || {};
            const defaultGroup = (config as { defaultGroup?: string }).defaultGroup || 'user';
            // Convert object to array
            const groups = Object.entries(groupsData).map(([id, group]) => ({
                id,
                ...group
            })) as PermissionGroup[];
            return { groups, defaultGroup };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Update permission groups (batch save)
 */
export function useUpdatePermissionGroups() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (groups: PermissionGroup[]) => {
            // Convert array to object for backend
            const groupsObject = groups.reduce<Record<string, Omit<PermissionGroup, 'id'>>>((acc, { id, ...rest }) => {
                acc[id] = rest;
                return acc;
            }, {});
            return configApi.updateSystem({ groups: groupsObject });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.permissionGroups() });
        },
    });
}

/**
 * Update default permission group
 */
export function useUpdateDefaultGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (defaultGroup: string) =>
            configApi.updateSystem({ defaultGroup }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.system.permissionGroups() });
        },
    });
}

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

/** Notification preferences from user config */
export interface NotificationPreferences {
    enabled: boolean;
    sound: boolean;
    receiveUnmatched: boolean;
    integrations: Record<string, {
        enabled?: boolean;
        selectedEvents?: string[];
    }>;
}

/** Admin notification config response */
export interface AdminNotificationConfig {
    integrations: Record<string, unknown>;
    webhookBaseUrl: string;
}

/**
 * Fetch user notification preferences
 */
export function useNotificationPreferences() {
    return useQuery({
        queryKey: queryKeys.notifications.preferences(),
        queryFn: async (): Promise<NotificationPreferences> => {
            const config = await configApi.getUser();
            const notifPrefs = (config as { preferences?: { notifications?: NotificationPreferences } })?.preferences?.notifications;
            return {
                enabled: notifPrefs?.enabled ?? true,
                sound: notifPrefs?.sound ?? false,
                receiveUnmatched: notifPrefs?.receiveUnmatched ?? true,
                integrations: notifPrefs?.integrations ?? {}
            };
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Update user notification preferences
 */
export function useUpdateNotificationPreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (preferences: NotificationPreferences) =>
            configApi.updateUser({ preferences: { notifications: preferences } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
        },
    });
}

/**
 * Fetch admin notification config (integrations + webhookBaseUrl)
 * Only enabled for admin users
 */
export function useAdminNotificationConfig(enabled = true) {
    return useQuery({
        queryKey: queryKeys.notifications.adminConfig(),
        queryFn: async (): Promise<AdminNotificationConfig> => {
            const [integrations, sysConfig] = await Promise.all([
                integrationsApi.getLegacyConfig(),
                configApi.getSystem()
            ]);
            return {
                integrations: (integrations || {}) as Record<string, unknown>,
                webhookBaseUrl: (sysConfig?.webhookBaseUrl as string) || window.location.origin
            };
        },
        staleTime: 5 * 60 * 1000,
        enabled,
    });
}

/**
 * Update admin webhook config for integrations
 */
export function useUpdateAdminWebhookConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { integrations: Record<string, unknown> }) =>
            integrationsApi.updateAll(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.adminConfig() });
            window.dispatchEvent(new CustomEvent('integrationsUpdated'));
        },
    });
}

/**
 * Update webhook base URL
 */
export function useUpdateWebhookBaseUrl() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (webhookBaseUrl: string) =>
            systemApi.updateSystemConfig({ webhookBaseUrl }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.adminConfig() });
        },
    });
}
