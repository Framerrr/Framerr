/**
 * Centralized Query Keys
 * 
 * All React Query cache keys are defined here for consistency.
 * Pattern: [domain, resource, ...params]
 * 
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

import type { IntegrationId, UserId, TemplateId, WidgetId } from './types';

/**
 * Query key factory for the entire application.
 * Use these keys for all useQuery and useMutation operations.
 */
export const queryKeys = {
    // ============================================
    // AUTH
    // ============================================
    auth: {
        all: ['auth'] as const,
        session: () => [...queryKeys.auth.all, 'session'] as const,
        setup: () => [...queryKeys.auth.all, 'setup'] as const,
        config: () => [...queryKeys.auth.all, 'config'] as const,
    },

    // ============================================
    // INTEGRATIONS
    // ============================================
    integrations: {
        all: ['integrations'] as const,
        lists: () => [...queryKeys.integrations.all, 'list'] as const,
        list: () => [...queryKeys.integrations.lists()] as const,
        accessible: () => [...queryKeys.integrations.all, 'accessible'] as const,
        shared: () => [...queryKeys.integrations.all, 'shared'] as const,
        schemas: () => [...queryKeys.integrations.all, 'schemas'] as const,
        details: () => [...queryKeys.integrations.all, 'detail'] as const,
        detail: (id: IntegrationId) => [...queryKeys.integrations.details(), id] as const,
        byType: (type: string) => [...queryKeys.integrations.all, 'type', type] as const,
    },

    // ============================================
    // WIDGETS
    // ============================================
    widgets: {
        all: ['widgets'] as const,
        dashboard: () => [...queryKeys.widgets.all, 'dashboard'] as const,
        gallery: () => [...queryKeys.widgets.all, 'gallery'] as const,
        access: () => [...queryKeys.widgets.all, 'access'] as const,
        shares: (widgetType: string) => [...queryKeys.widgets.all, 'shares', widgetType] as const,
        allShares: () => [...queryKeys.widgets.all, 'allShares'] as const,
    },

    // ============================================
    // USERS
    // ============================================
    users: {
        all: ['users'] as const,
        lists: () => [...queryKeys.users.all, 'list'] as const,
        list: () => [...queryKeys.users.lists()] as const,
        details: () => [...queryKeys.users.all, 'detail'] as const,
        detail: (id: UserId) => [...queryKeys.users.details(), id] as const,
        me: () => [...queryKeys.users.all, 'me'] as const,
    },

    // ============================================
    // USER GROUPS
    // ============================================
    userGroups: {
        all: ['userGroups'] as const,
        list: () => [...queryKeys.userGroups.all, 'list'] as const,
        detail: (id: string) => [...queryKeys.userGroups.all, 'detail', id] as const,
    },

    // ============================================
    // TEMPLATES
    // ============================================
    templates: {
        all: ['templates'] as const,
        list: () => [...queryKeys.templates.all, 'list'] as const,
        detail: (id: TemplateId) => [...queryKeys.templates.all, 'detail', id] as const,
        shares: (id: TemplateId) => [...queryKeys.templates.all, 'shares', id] as const,
    },

    // ============================================
    // SERVICE MONITORS
    // ============================================
    serviceMonitors: {
        all: ['serviceMonitors'] as const,
        list: () => [...queryKeys.serviceMonitors.all, 'list'] as const,
        status: () => [...queryKeys.serviceMonitors.all, 'status'] as const,
    },

    // ============================================
    // TABS
    // ============================================
    tabs: {
        all: ['tabs'] as const,
        list: () => [...queryKeys.tabs.all, 'list'] as const,
        groups: () => [...queryKeys.tabs.all, 'groups'] as const,
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================
    notifications: {
        all: ['notifications'] as const,
        preferences: () => [...queryKeys.notifications.all, 'preferences'] as const,
        adminConfig: () => [...queryKeys.notifications.all, 'adminConfig'] as const,
        list: () => [...queryKeys.notifications.all, 'list'] as const,
    },

    // ============================================
    // BACKUP
    // ============================================
    backup: {
        all: ['backup'] as const,
        list: () => [...queryKeys.backup.all, 'list'] as const,
        schedule: () => [...queryKeys.backup.all, 'schedule'] as const,
    },

    // ============================================
    // METRIC HISTORY
    // ============================================
    metricHistory: {
        all: ['metricHistory'] as const,
        status: () => [...queryKeys.metricHistory.all, 'status'] as const,
        integration: (id: string) => [...queryKeys.metricHistory.all, 'integration', id] as const,
    },

    // ============================================
    // SYSTEM / CONFIG
    // ============================================
    system: {
        all: ['system'] as const,
        config: () => [...queryKeys.system.all, 'config'] as const,
        tabGroups: () => [...queryKeys.system.all, 'tabGroups'] as const,
        permissionGroups: () => [...queryKeys.system.all, 'permissionGroups'] as const,
        health: () => [...queryKeys.system.all, 'health'] as const,
        debug: () => [...queryKeys.system.all, 'debug'] as const,
        logs: () => [...queryKeys.system.all, 'logs'] as const,
        info: () => [...queryKeys.system.all, 'info'] as const,
        resources: () => [...queryKeys.system.all, 'resources'] as const,
        sseStatus: () => [...queryKeys.system.all, 'sseStatus'] as const,
        apiHealth: () => [...queryKeys.system.all, 'apiHealth'] as const,
    },

    // ============================================
    // THEME
    // ============================================
    theme: {
        all: ['theme'] as const,
        current: () => [...queryKeys.theme.all, 'current'] as const,
        default: () => [...queryKeys.theme.all, 'default'] as const,
    },

    // ============================================
    // USER PREFERENCES (per-user config)
    // ============================================
    config: {
        all: ['config'] as const,
        user: () => [...queryKeys.config.all, 'user'] as const,
    },

    // ============================================
    // PROFILE (current user's profile)
    // ============================================
    profile: {
        all: ['profile'] as const,
        me: () => [...queryKeys.profile.all, 'me'] as const,
    },
} as const;

// Export type for query key values
export type QueryKey = ReturnType<
    | typeof queryKeys.auth.session
    | typeof queryKeys.integrations.list
    | typeof queryKeys.widgets.dashboard
    | typeof queryKeys.users.list
>;
