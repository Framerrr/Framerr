/**
 * Linked Accounts Database Module
 * Manages user's linked external service accounts (Plex, Overseerr, etc.)
 */
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

interface LinkedAccountRow {
    id: string;
    user_id: string;
    service: string;
    external_id: string;
    external_username: string | null;
    external_email: string | null;
    metadata: string | null;
    linked_at: number;
}

interface LinkedAccount {
    id: string;
    userId: string;
    service: string;
    externalId: string;
    externalUsername: string | null;
    externalEmail: string | null;
    metadata: Record<string, unknown>;
    linkedAt: number;
}

interface AccountData {
    externalId: string;
    externalUsername?: string;
    externalEmail?: string;
    metadata?: Record<string, unknown>;
}

interface UserServiceLink {
    userId: string;
    externalId: string;
}

/**
 * Link an external account to a Framerr user
 */
export function linkAccount(userId: string, service: string, accountData: AccountData): LinkedAccount {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    try {
        const existing = getDb().prepare(`
            SELECT id FROM linked_accounts WHERE user_id = ? AND service = ?
        `).get(userId, service) as { id: string } | undefined;

        if (existing) {
            getDb().prepare(`
                UPDATE linked_accounts 
                SET external_id = ?, external_username = ?, external_email = ?, 
                    metadata = ?, linked_at = ?
                WHERE user_id = ? AND service = ?
            `).run(
                accountData.externalId,
                accountData.externalUsername || null,
                accountData.externalEmail || null,
                JSON.stringify(accountData.metadata || {}),
                now,
                userId,
                service
            );

            logger.info(`[LinkedAccounts] Updated: user=${userId} service=${service}`);
            return getLinkedAccount(userId, service)!;
        }

        getDb().prepare(`
            INSERT INTO linked_accounts (id, user_id, service, external_id, external_username, external_email, metadata, linked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            userId,
            service,
            accountData.externalId,
            accountData.externalUsername || null,
            accountData.externalEmail || null,
            JSON.stringify(accountData.metadata || {}),
            now
        );

        logger.info(`[LinkedAccounts] Created: user=${userId} service=${service}`);

        return {
            id,
            userId,
            service,
            externalId: accountData.externalId,
            externalUsername: accountData.externalUsername || null,
            externalEmail: accountData.externalEmail || null,
            metadata: accountData.metadata || {},
            linkedAt: now
        };
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to link: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get a linked account for a user and service
 */
export function getLinkedAccount(userId: string, service: string): LinkedAccount | null {
    try {
        const row = getDb().prepare(`
            SELECT * FROM linked_accounts WHERE user_id = ? AND service = ?
        `).get(userId, service) as LinkedAccountRow | undefined;

        if (!row) return null;

        return {
            id: row.id,
            userId: row.user_id,
            service: row.service,
            externalId: row.external_id,
            externalUsername: row.external_username,
            externalEmail: row.external_email,
            metadata: JSON.parse(row.metadata || '{}'),
            linkedAt: row.linked_at
        };
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to get: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Get all linked accounts for a user
 */
export function getLinkedAccountsForUser(userId: string): LinkedAccount[] {
    try {
        const rows = getDb().prepare(`
            SELECT * FROM linked_accounts WHERE user_id = ? ORDER BY service
        `).all(userId) as LinkedAccountRow[];

        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            service: row.service,
            externalId: row.external_id,
            externalUsername: row.external_username,
            externalEmail: row.external_email,
            metadata: JSON.parse(row.metadata || '{}'),
            linkedAt: row.linked_at
        }));
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to get accounts: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Find Framerr user by external ID
 */
export function findUserByExternalId(service: string, externalId: string): string | null {
    try {
        const row = getDb().prepare(`
            SELECT user_id FROM linked_accounts WHERE service = ? AND external_id = ?
        `).get(service, externalId) as { user_id: string } | undefined;

        return row ? row.user_id : null;
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to find user: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Unlink an external account
 */
export function unlinkAccount(userId: string, service: string): boolean {
    try {
        const result = getDb().prepare(`
            DELETE FROM linked_accounts WHERE user_id = ? AND service = ?
        `).run(userId, service);

        if (result.changes > 0) {
            logger.info(`[LinkedAccounts] Unlinked: user=${userId} service=${service}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to unlink: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Get all users linked to a specific service
 * Useful for notification targeting
 */
export function getUsersLinkedToService(service: string): UserServiceLink[] {
    try {
        const rows = getDb().prepare(`
            SELECT user_id, external_id FROM linked_accounts WHERE service = ?
        `).all(service) as { user_id: string; external_id: string }[];

        return rows.map(row => ({
            userId: row.user_id,
            externalId: row.external_id
        }));
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to get users: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Get all Plex-linked users with their Plex usernames.
 * Used by bulk auto-match at startup.
 */
export function getPlexLinkedUsers(): { userId: string; plexUsername: string }[] {
    try {
        const rows = getDb().prepare(`
            SELECT user_id, external_username FROM linked_accounts 
            WHERE service = 'plex' AND external_username IS NOT NULL AND external_username != ''
        `).all() as { user_id: string; external_username: string }[];

        return rows.map(row => ({
            userId: row.user_id,
            plexUsername: row.external_username
        }));
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to get Plex users: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Update metadata for an existing linked account (e.g., refresh permissions)
 */
export function updateLinkedAccountMetadata(userId: string, service: string, metadata: Record<string, unknown>): boolean {
    try {
        const result = getDb().prepare(`
            UPDATE linked_accounts SET metadata = ? WHERE user_id = ? AND service = ?
        `).run(JSON.stringify(metadata), userId, service);

        if (result.changes > 0) {
            logger.debug(`[LinkedAccounts] Updated metadata: user=${userId} service=${service}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to update metadata: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Get the stored Plex auth token for a user (if any).
 * Used by the recommendations endpoint to make personalized Plex API calls.
 */
export function getPlexTokenForUser(userId: string): string | null {
    const account = getLinkedAccount(userId, 'plex');
    if (!account?.metadata) return null;
    const token = account.metadata.plexToken;
    return typeof token === 'string' ? token : null;
}
