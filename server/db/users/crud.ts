/**
 * User CRUD Operations
 * 
 * Core user management: create, read, update, delete.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { getDb } from '../../database/db';
import * as templateDb from '../templates';
import type { User, UserRow, CreateUserData, UpdateUserData, DEFAULT_PREFERENCES } from './types';

// Re-import constants
const DEFAULT_PREFS = {
    theme: 'dark',
    locale: 'en',
    sidebarCollapsed: false
};

/**
 * Get user by username
 */
export async function getUser(username: string): Promise<User | null> {
    try {
        const user = getDb().prepare(`
            SELECT id, username, password as passwordHash, username as displayName,
                   group_id as "group", is_setup_admin as isSetupAdmin,
                   created_at as createdAt, last_login as lastLogin
            FROM users
            WHERE LOWER(username) = LOWER(?)
        `).get(username) as UserRow | undefined;

        if (!user) return null;

        return {
            ...user,
            isSetupAdmin: Boolean(user.isSetupAdmin),
            preferences: user.preferences ? JSON.parse(user.preferences) : undefined
        };
    } catch (error) {
        logger.error(`[Users] Failed to get by username: username="${username}" error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    try {
        const user = getDb().prepare(`
            SELECT id, username, password as passwordHash, username as displayName,
                   group_id as "group", is_setup_admin as isSetupAdmin,
                   created_at as createdAt, last_login as lastLogin
            FROM users
            WHERE id = ?
        `).get(userId) as UserRow | undefined;

        if (!user) return null;

        return {
            ...user,
            isSetupAdmin: Boolean(user.isSetupAdmin),
            preferences: user.preferences ? JSON.parse(user.preferences) : undefined
        };
    } catch (error) {
        logger.error(`[Users] Failed to get by ID: id=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserData): Promise<Omit<User, 'passwordHash'>> {
    try {
        const existing = getDb().prepare(`
            SELECT id FROM users WHERE LOWER(username) = LOWER(?)
        `).get(userData.username);

        if (existing) {
            throw new Error('User already exists');
        }

        const id = uuidv4();
        const createdAt = Math.floor(Date.now() / 1000);

        const stmt = getDb().prepare(`
            INSERT INTO users (
                id, username, password, email, group_id,
                is_setup_admin, created_at, last_login, has_local_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            userData.username,
            userData.passwordHash,
            userData.email || null,
            userData.group || 'user',
            userData.isSetupAdmin ? 1 : 0,
            createdAt,
            null,
            userData.hasLocalPassword !== false ? 1 : 0  // Default to true unless explicitly false
        );

        logger.info(`[Users] Created: username="${userData.username}" group=${userData.group || 'user'}`);

        // Apply default template for non-admin users
        const isAdmin = userData.group === 'admin' || userData.isSetupAdmin;
        if (!isAdmin) {
            try {
                const defaultTemplate = await templateDb.getDefaultTemplate();
                if (defaultTemplate) {
                    // Use consolidated helper for template sharing
                    // Handles: copy creation, config stripping, integration sharing, dashboard apply
                    const result = await templateDb.shareTemplateWithUser(
                        defaultTemplate,
                        id,
                        defaultTemplate.ownerId,
                        {
                            stripConfigs: true,       // Strip sensitive config (links, custom HTML)
                            shareIntegrations: true,  // Share required integrations
                            applyToDashboard: true,   // Apply to user's dashboard
                            createBackup: false       // No backup for new users
                        }
                    );

                    logger.info(`[Users] Default template applied: user=${id} template=${defaultTemplate.id} copy=${result.templateCopy?.id}`);
                }
            } catch (templateError) {
                // Don't fail user creation if template application fails
                logger.warn(`[Users] Failed to apply default template: user=${id} error="${(templateError as Error).message}"`);
            }
        }

        return {
            id,
            username: userData.username,
            displayName: userData.username,
            group: userData.group || 'user',
            isSetupAdmin: userData.isSetupAdmin || false,
            createdAt,
            lastLogin: null
        };
    } catch (error) {
        logger.error(`[Users] Failed to create: username="${userData.username}" error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Update user
 */
export async function updateUser(userId: string, updates: UpdateUserData): Promise<Omit<User, 'passwordHash'>> {
    try {
        const currentUser = await getUserById(userId);
        if (!currentUser) {
            throw new Error('User not found');
        }

        if (updates.username && updates.username !== currentUser.username) {
            const existing = getDb().prepare(`
                SELECT id FROM users 
                WHERE LOWER(username) = LOWER(?) AND id != ?
            `).get(updates.username, userId);

            if (existing) {
                throw new Error('Username already taken');
            }
        }

        const { id, createdAt, ...allowedUpdates } = updates;

        const fields: string[] = [];
        const values: (string | number | null)[] = [];

        if (allowedUpdates.username !== undefined) {
            fields.push('username = ?');
            values.push(allowedUpdates.username);
        }
        if (allowedUpdates.passwordHash !== undefined) {
            fields.push('password = ?');
            values.push(allowedUpdates.passwordHash);
        }
        if (allowedUpdates.group !== undefined) {
            fields.push('group_id = ?');
            values.push(allowedUpdates.group);
        }
        if (allowedUpdates.lastLogin !== undefined) {
            fields.push('last_login = ?');
            values.push(allowedUpdates.lastLogin);
        }

        if (fields.length === 0) {
            const { passwordHash, ...userWithoutPassword } = currentUser;
            return userWithoutPassword;
        }

        values.push(userId);

        const stmt = getDb().prepare(`
            UPDATE users 
            SET ${fields.join(', ')}
            WHERE id = ?
        `);

        stmt.run(...values);

        const updatedUser = await getUserById(userId);
        if (!updatedUser) throw new Error('User not found after update');

        const { passwordHash, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    } catch (error) {
        logger.error(`[Users] Failed to update: id=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
    try {
        const user = await getUserById(userId);
        if (!user) return false;

        const db = getDb();

        // Clean up widget shares where this user is the target
        const sharesDeleted = db.prepare(
            `DELETE FROM widget_shares WHERE share_type = 'user' AND share_target = ?`
        ).run(userId);

        if (sharesDeleted.changes > 0) {
            logger.info(`[Users] Cleaned up ${sharesDeleted.changes} widget shares for deleted user`);
        }

        // Delete the user
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        logger.info(`[Users] Deleted: username="${user.username}"`);
        return true;
    } catch (error) {
        logger.error(`[Users] Failed to delete: id=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * List all users (without password hashes)
 * Includes profilePicture from user_config preferences via JOIN
 */
export async function listUsers(): Promise<(Omit<User, 'passwordHash'> & { profilePictureUrl?: string })[]> {
    try {
        interface UserWithPictureRow extends UserRow {
            profilePictureUrl?: string;
        }

        const users = getDb().prepare(`
            SELECT 
                u.id, 
                u.username, 
                u.username as displayName,
                u.group_id as "group", 
                u.is_setup_admin as isSetupAdmin,
                u.created_at as createdAt, 
                u.last_login as lastLogin,
                json_extract(p.preferences, '$.profilePicture') as profilePictureUrl
            FROM users u
            LEFT JOIN user_preferences p ON u.id = p.user_id
            ORDER BY u.created_at ASC
        `).all() as UserWithPictureRow[];

        return users.map(user => ({
            ...user,
            isSetupAdmin: Boolean(user.isSetupAdmin),
            preferences: user.preferences ? JSON.parse(user.preferences) : DEFAULT_PREFS,
            profilePictureUrl: user.profilePictureUrl || undefined
        }));
    } catch (error) {
        logger.error(`[Users] Failed to list: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get all users (including password hashes for backend use)
 */
export async function getAllUsers(): Promise<User[]> {
    try {
        const users = getDb().prepare(`
            SELECT id, username, password as passwordHash, username as displayName,
                   group_id as "group", is_setup_admin as isSetupAdmin,
                   created_at as createdAt, last_login as lastLogin
            FROM users
            ORDER BY created_at ASC
        `).all() as UserRow[];

        return users.map(user => ({
            ...user,
            isSetupAdmin: Boolean(user.isSetupAdmin),
            preferences: user.preferences ? JSON.parse(user.preferences) : DEFAULT_PREFS
        }));
    } catch (error) {
        logger.error(`[Users] Failed to get all: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Check if any users exist in the database.
 * Used to determine if setup is complete and services should start.
 */
export function hasUsers(): boolean {
    try {
        const result = getDb().prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        return result.count > 0;
    } catch (error) {
        logger.error(`[Users] Failed to check count: error="${(error as Error).message}"`);
        return false;
    }
}
