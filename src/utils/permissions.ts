/**
 * Frontend Permission Utilities
 * Mirrors backend logic for UI conditional rendering
 */

import type { User } from '../../shared/types/user';

/**
 * Permission group from system config
 */
interface PermissionGroup {
    id: string;
    permissions: string[];
}

/**
 * Minimal system config needed for permission checks
 */
interface SystemConfigWithGroups {
    groups?: PermissionGroup[];
}

/**
 * Check if a user has a specific permission
 * @param user - User object
 * @param permission - Permission to check
 * @param systemConfig - System configuration (containing groups)
 * @returns True if user has permission
 */
export const hasPermission = (
    user: User | null | undefined,
    permission: string,
    systemConfig: SystemConfigWithGroups | null | undefined
): boolean => {
    if (!user || !user.group) return false;
    if (!systemConfig || !systemConfig.groups) return false;

    const group = systemConfig.groups.find(g => g.id === user.group);
    if (!group) return false;

    // Admin superuser check
    if (group.permissions.includes('*')) return true;

    // Check specific permission
    return group.permissions.includes(permission);
};

/**
 * Common permissions constants
 */
export const PERMISSIONS = {
    VIEW_DASHBOARD: 'view_dashboard',
    MANAGE_WIDGETS: 'manage_widgets',
    MANAGE_SYSTEM: 'manage_system',
    MANAGE_USERS: 'manage_users'
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Check if user is admin 
 * @param user - User object
 * @returns True if user is in admin group
 */
export const isAdmin = (user: User | null | undefined): boolean => {
    if (!user || !user.group) return false;
    return user.group === 'admin';
};
