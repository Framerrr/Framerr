/**
 * Password Operations
 * 
 * Password reset, force-change-on-login, and local password flag management.
 */

import logger from '../../utils/logger';
import { getDb } from '../../database/db';
import { getUserById } from './crud';
import { revokeAllUserSessions } from './sessions';

/**
 * Reset user password to temporary password.
 * Also sets the require_password_reset flag and revokes all sessions.
 */
export async function resetUserPassword(userId: string): Promise<{ success: boolean; tempPassword: string }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { hashPassword } = require('../../auth/password');
        const user = await getUserById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const tempPassword = 'temp' + Math.random().toString(36).substr(2, 8);
        const passwordHash = await hashPassword(tempPassword);

        getDb().prepare(`
            UPDATE users 
            SET password = ?, require_password_reset = 1, has_local_password = 1
            WHERE id = ?
        `).run(passwordHash, userId);

        // Revoke all sessions so user must log in with temp password
        await revokeAllUserSessions(userId);

        logger.info(`[Users] Password reset: username="${user.username}" requirePasswordReset=true sessionsRevoked=true`);

        return {
            success: true,
            tempPassword
        };
    } catch (error) {
        logger.error(`[Users] Failed to reset password: id=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Check if user is required to change password on next login
 */
export function getRequirePasswordReset(userId: string): boolean {
    try {
        const row = getDb().prepare(`
            SELECT require_password_reset FROM users WHERE id = ?
        `).get(userId) as { require_password_reset: number } | undefined;

        return row ? row.require_password_reset === 1 : false;
    } catch (error) {
        logger.error(`[Users] Failed to check require_password_reset: id=${userId} error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Set or clear the require_password_reset flag
 */
export function setRequirePasswordReset(userId: string, required: boolean): boolean {
    try {
        const result = getDb().prepare(`
            UPDATE users SET require_password_reset = ? WHERE id = ?
        `).run(required ? 1 : 0, userId);

        if (result.changes > 0) {
            logger.info(`[Users] Updated require_password_reset: user=${userId} required=${required}`);
        }
        return result.changes > 0;
    } catch (error) {
        logger.error(`[Users] Failed to set require_password_reset: id=${userId} error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Check if user has a local password set
 */
export function hasLocalPassword(userId: string): boolean {
    try {
        const row = getDb().prepare(`
            SELECT has_local_password FROM users WHERE id = ?
        `).get(userId) as { has_local_password: number } | undefined;

        // Default to true for backwards compatibility (existing users assumed to have password)
        return row ? row.has_local_password === 1 : true;
    } catch (error) {
        logger.error(`[Users] Failed to check has_local_password: id=${userId} error="${(error as Error).message}"`);
        return true; // Assume true on error to avoid blocking login
    }
}

/**
 * Set the has_local_password flag for a user
 */
export function setHasLocalPassword(userId: string, hasPassword: boolean): boolean {
    try {
        const result = getDb().prepare(`
            UPDATE users SET has_local_password = ? WHERE id = ?
        `).run(hasPassword ? 1 : 0, userId);

        if (result.changes > 0) {
            logger.info(`[Users] Updated has_local_password: user=${userId} hasPassword=${hasPassword}`);
        }
        return result.changes > 0;
    } catch (error) {
        logger.error(`[Users] Failed to set has_local_password: id=${userId} error="${(error as Error).message}"`);
        return false;
    }
}
