import { getSystemConfig } from '../db/systemConfig';
import logger from './logger';
import type { PermissionGroup } from '../types/config';

interface User {
    username: string;
    group: string;
}

interface SystemConfigWithGroups {
    groups: PermissionGroup[] | Record<string, PermissionGroup>;
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(user: User | null | undefined, permission: string): Promise<boolean> {
    if (!user || !user.group) return false;

    try {
        const config = await getSystemConfig() as SystemConfigWithGroups;

        // Handle both array format (new) and object format (legacy)
        // Array: [{id: 'admin', ...}, {id: 'user', ...}]
        // Object: {'admin': {...}, 'user': {...}}
        let group: PermissionGroup | undefined;
        if (Array.isArray(config.groups)) {
            group = config.groups.find(g => g.id === user.group);
        } else {
            group = (config.groups as Record<string, PermissionGroup>)[user.group];
        }

        if (!group) {
            logger.warn(`User ${user.username} belongs to unknown group ${user.group}`);
            return false;
        }

        // Ensure permissions array exists
        if (!group.permissions || !Array.isArray(group.permissions)) {
            logger.warn(`Group ${user.group} has invalid permissions array`);
            return false;
        }

        // Admin superuser check
        if (group.permissions.includes('*')) return true;

        // Check specific permission
        return group.permissions.includes(permission);
    } catch (error) {
        logger.error(`[Permissions] Check failed: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(user: User | null | undefined): Promise<string[]> {
    if (!user || !user.group) return [];

    try {
        const config = await getSystemConfig() as SystemConfigWithGroups;

        // Handle both array format (new) and object format (legacy)
        let group: PermissionGroup | undefined;
        if (Array.isArray(config.groups)) {
            group = config.groups.find(g => g.id === user.group);
        } else {
            group = (config.groups as Record<string, PermissionGroup>)[user.group];
        }

        return group && group.permissions ? group.permissions : [];
    } catch (error) {
        logger.error(`[Permissions] Failed to get user permissions: error="${(error as Error).message}"`);
        return [];
    }
}
