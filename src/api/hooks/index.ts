/**
 * Hooks Barrel Export
 */

// Centralized query keys (single source of truth)
export { queryKeys } from '../queryKeys';

// Auth hooks
export { useSession, useSetupStatus, useLogin, useLogout } from './useAuth';

// Users hooks  
export { useUsers, useUser, useCreateUser, useUpdateUser, useDeleteUser } from './useUsers';

// Integrations hooks
export {
    useIntegrations,
    useRoleAwareIntegrations,
    useIntegrationSchemas,
    useAccessibleIntegrations,
    useIntegration,
    useCreateIntegration,
    useUpdateIntegration,
    useDeleteIntegration,
    useTestConnection,
    useSharedIntegrations,
    useIntegrationsByType,
} from './useIntegrations';

// Dashboard hooks
export {
    useWidgets,
    useSaveWidgets,
    useAddWidget,
    useRemoveWidget,
    useWidgetAccess,
    useUserPreferences,
    useUpdateUserPreferences,
    useDebugOverlay,
    useUpdateDebugConfig,
    useDebugConfig,
    useLogs,
    useSetLogLevel,
    useClearLogs,
    // System diagnostics
    useSystemInfo,
    useSystemResources,
    useSseStatus,
    useApiHealth,
} from './useDashboard';


// Settings hooks
export {
    // Backup
    useBackupList,
    useBackupSchedule,
    useCreateBackup,
    useDeleteBackup,
    useUpdateBackupSchedule,
    // User Groups
    useUserGroupsList,
    useUserGroup,
    useCreateUserGroup,
    useUpdateUserGroup,
    useDeleteUserGroup,
    // Tabs
    useTabsList,
    useCreateTab,
    useUpdateTab,
    useDeleteTab,
    useReorderTabs,
    // Tab Groups (per-user)
    useTabGroupsList,
    useUpdateTabGroups,
} from './useSettings';

// Widget & Template hooks
export {
    // Widget Shares
    useMyWidgetAccess,
    useUsersAndGroups,
    useWidgetSharesFor,
    useSaveWidgetShares,
    // Templates
    useTemplates,
    useTemplate,
    useCreateTemplate,
    useUpdateTemplate,
    useDeleteTemplate,
    useApplyTemplate,
    useTemplateShares,
    useShareTemplate,
    useUnshareTemplate,
} from './useWidgetQueries';

// Profile hooks
export {
    useProfile,
    useUpdateProfile,
    useChangePassword,
    useUploadProfilePicture,
    useRemoveProfilePicture,
} from './useProfile';

// Config hooks (system config, theme, user config)
export {
    useSystemConfigQuery,
    useUpdateSystemConfig,
    useThemeQuery,
    useSaveTheme,
    useUserConfigQuery,
    useUpdateUserConfig,
} from './useConfig';
