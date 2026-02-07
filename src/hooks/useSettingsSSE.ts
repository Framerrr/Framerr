/**
 * Settings SSE Sync Hook
 * 
 * Central hook that listens for settings:invalidate SSE events
 * and triggers React Query cache invalidation for the appropriate entities.
 * 
 * This hook should be mounted once at the app root (e.g., App.tsx or a layout component).
 * 
 * Entities supported:
 * User-specific:
 * - 'permissions' - Widget shares / access control
 * - 'notifications' - Notification preferences
 * - 'tabs' - User's personal tabs
 * - 'tab-groups' - Tab group organization
 * - 'widgets' - Dashboard layout
 * - 'user-profile' - Display name, picture
 * - 'theme' - Theme settings
 * 
 * System-wide (for admin pages):
 * - 'widget-shares' - Admin Shared Widgets page
 * - 'users' - User management
 * - 'groups' - User groups
 * - 'integrations' - Integration config
 * - 'templates' - Dashboard templates
 * - 'service-monitors' - Uptime monitoring
 * - 'backup' - Backup config and list
 * - 'auth-config' - Authentication settings
 * - 'app-config' - Server name, icon
 * - 'permission-groups' - Permission group definitions
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useRealtimeSSE from './useRealtimeSSE';
import { queryKeys } from '../api/queryKeys';
import logger from '../utils/logger';

/**
 * Entity -> Query keys mapping
 * When an entity is invalidated via SSE, these query keys are invalidated.
 * 
 * Naming convention: entities match backend broadcast calls
 * - User-specific: invalidateUserSettings(userId, 'entity')
 * - System-wide: invalidateSystemSettings('entity')
 */
const ENTITY_QUERY_KEYS: Record<string, (() => readonly unknown[])[]> = {
    // ============================================
    // User-Specific Entities
    // ============================================

    // Permissions - widget access and shared integrations (for non-admin users)
    'permissions': [
        queryKeys.widgets.access,
        queryKeys.integrations.shared,
    ],

    // Notifications - user's notification preferences
    'notifications': [
        queryKeys.notifications.preferences,
        queryKeys.integrations.shared,
    ],

    // Tabs - user's personal tabs
    'tabs': [
        queryKeys.tabs.list,
    ],

    // Tab groups - user's tab group organization
    'tab-groups': [
        queryKeys.tabs.groups,
    ],

    // Widgets - user's dashboard layout
    'widgets': [
        queryKeys.widgets.dashboard,
    ],

    // User profile - displayName, picture
    'user-profile': [
        queryKeys.profile.me,
        queryKeys.config.user,
    ],

    // Theme - user's theme settings
    'theme': [
        queryKeys.theme.current,
    ],

    // ============================================
    // Admin/System-Wide Entities
    // ============================================

    // Widget shares - admin's Shared Widgets page
    'widget-shares': [
        queryKeys.widgets.allShares,
        () => ['admin', 'usersAndGroups'] as const,
    ],

    // Users - admin user management
    'users': [
        queryKeys.users.list,
    ],

    // Groups - user groups (admin-managed social groups)
    'groups': [
        queryKeys.userGroups.list,
    ],

    // Integrations - integration config changes
    'integrations': [
        queryKeys.integrations.list,
        queryKeys.integrations.shared,
        queryKeys.notifications.adminConfig,
    ],

    // Templates - dashboard templates
    'templates': [
        queryKeys.templates.list,
    ],

    // Service monitors - uptime monitoring config
    'service-monitors': [
        queryKeys.serviceMonitors.list,
    ],

    // Backup - backup configuration and list
    'backup': [
        queryKeys.backup.list,
        queryKeys.backup.schedule,
    ],

    // Auth config - authentication settings
    'auth-config': [
        queryKeys.auth.config,
    ],

    // App config - server name, icon, etc.
    'app-config': [
        queryKeys.system.config,
    ],

    // Permission groups - permission group definitions
    'permission-groups': [
        queryKeys.system.permissionGroups,
    ],
};

/**
 * Hook that subscribes to SSE settings invalidation events
 * and automatically invalidates the corresponding React Query caches.
 * 
 * Mount this once at the app root.
 */
export function useSettingsSSE(): void {
    const queryClient = useQueryClient();
    const { onSettingsInvalidate } = useRealtimeSSE();

    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            const queryKeyFns = ENTITY_QUERY_KEYS[event.entity];

            if (queryKeyFns) {
                logger.debug('[SettingsSSE] Invalidating queries for entity', { entity: event.entity });

                for (const keyFn of queryKeyFns) {
                    try {
                        const queryKey = keyFn();
                        queryClient.invalidateQueries({ queryKey });
                    } catch (err) {
                        logger.warn('[SettingsSSE] Failed to invalidate query', { entity: event.entity, error: err });
                    }
                }
            } else {
                logger.debug('[SettingsSSE] No handler for entity, skipping', { entity: event.entity });
            }
        });

        return unsubscribe;
    }, [onSettingsInvalidate, queryClient]);
}

export default useSettingsSSE;
