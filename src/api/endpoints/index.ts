/**
 * Endpoints Barrel Export
 * Central export point for all API endpoints
 */

export { authApi } from './auth';
export type { User, LoginCredentials, LoginResponse, SessionResponse, SetupStatusResponse, PlexLoginCredentials, PlexLoginResponse } from './auth';

export { usersApi } from './users';
export type { CreateUserData, UpdateUserData } from './users';

export { integrationsApi } from './integrations';
export type { IntegrationInstance, IntegrationConfig, CreateIntegrationData, UpdateIntegrationData, TestConnectionResult, IntegrationShareRecord } from './integrations';

export { widgetsApi } from './widgets';
export type { Widget, WidgetLayout, WidgetConfig, DashboardLayout, UpdateWidgetData, MobileLayoutMode, WidgetsResponse, SaveWidgetsData } from './widgets';

export { systemApi } from './system';
export type {
    SystemConfig,
    DiagnosticsInfo,
    SystemInfo,
    Resources,
    SseStatus,
    DbStatus,
    ApiHealth,
    LogEntry,
    LogsResponse,
    SystemConfigResponse
} from './system';

export { plexApi } from './plex';
export type { PlexSSOStatusResponse, PlexPinResponse, PlexTokenResponse, PlexServer, PlexTestResponse } from './plex';

export { themeApi } from './theme';
export type { DefaultThemeResponse, ThemePreset, ThemeResponse } from './theme';

export { userGroupsApi } from './userGroups';
export type { UserGroup } from './userGroups';

export { backupApi } from './backup';
export type { BackupInfo, BackupListResponse, ScheduleConfig, ScheduleResponse } from './backup';

export { configApi } from './config';
export type { UserConfig, UserPreferences, NotificationPreferences, GlobalSystemConfig } from './config';

export { notificationsApi } from './notifications';
export type { CreateNotificationData, NotificationsResponse } from './notifications';

export { templatesApi } from './templates';
export type {
    Template,
    TemplateWidget,
    Category,
    BackupData,
    TemplatesResponse,
    CategoriesResponse,
    TemplateSharesResponse,
    CreateTemplateData,
    UpdateTemplateData,
    SaveDraftData
} from './templates';

export { tabsApi } from './tabs';
export type { Tab, CreateTabData, UpdateTabData } from './tabs';

export { tabGroupsApi } from './tabGroups';
export type { TabGroup as UserTabGroup, CreateTabGroupData, UpdateTabGroupData } from './tabGroups';

export { profileApi } from './profile';
export type { ProfileData, UpdateProfileData, ChangePasswordData } from './profile';

export { linkedAccountsApi } from './linkedAccounts';
export type { LinkedAccount, LinkedAccounts } from './linkedAccounts';

export { widgetSharesApi } from './widgetShares';
export type { UserShareState, UserData, GroupData, UsersAndGroupsResponse, ExistingSharesResponse, MyAccessResponse, SaveSharesData } from './widgetShares';
