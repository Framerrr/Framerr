/**
 * SSO Setup Tokens Database Module
 * Manages temporary tokens for SSO account setup flow (Plex, OIDC, etc.)
 */
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

interface SSOSetupTokenRow {
    token: string;
    provider: string;
    external_id: string;
    external_username: string;
    external_email: string | null;
    external_avatar: string | null;
    expires_at: number;
    used: number;
    created_at: number;
}

export interface SSOSetupToken {
    token: string;
    provider: string;
    externalId: string;
    externalUsername: string;
    externalEmail: string | null;
    externalAvatar: string | null;
    expiresAt: number;
    used: boolean;
    createdAt: number;
}

export interface SSOUserInfo {
    externalId: string;
    externalUsername: string;
    externalEmail?: string;
    externalAvatar?: string;
}

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a new setup token for an SSO user
 */
export function createSSOSetupToken(provider: string, userInfo: SSOUserInfo): string {
    const token = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.floor(TOKEN_EXPIRY_MS / 1000);

    try {
        getDb().prepare(`
            INSERT INTO sso_setup_tokens 
            (token, provider, external_id, external_username, external_email, external_avatar, expires_at, used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
            token,
            provider,
            userInfo.externalId,
            userInfo.externalUsername,
            userInfo.externalEmail || null,
            userInfo.externalAvatar || null,
            expiresAt,
            now
        );

        logger.debug(`[SSOSetupTokens] Created: provider="${provider}" user="${userInfo.externalUsername}"`);
        return token;
    } catch (error) {
        logger.error(`[SSOSetupTokens] Failed to create: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Validate and retrieve a setup token
 * Returns null if token doesn't exist, is expired, or already used
 */
export function validateSSOSetupToken(token: string): SSOSetupToken | null {
    try {
        const now = Math.floor(Date.now() / 1000);
        const row = getDb().prepare(`
            SELECT * FROM sso_setup_tokens 
            WHERE token = ? AND used = 0 AND expires_at > ?
        `).get(token, now) as SSOSetupTokenRow | undefined;

        if (!row) {
            logger.debug(`[SSOSetupTokens] Token invalid or expired: prefix=${token.substring(0, 8)}`);
            return null;
        }

        return {
            token: row.token,
            provider: row.provider,
            externalId: row.external_id,
            externalUsername: row.external_username,
            externalEmail: row.external_email,
            externalAvatar: row.external_avatar,
            expiresAt: row.expires_at,
            used: row.used === 1,
            createdAt: row.created_at
        };
    } catch (error) {
        logger.error(`[SSOSetupTokens] Failed to validate: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Mark a token as used (invalidates it)
 */
export function markTokenUsed(token: string): boolean {
    try {
        const result = getDb().prepare(`
            UPDATE sso_setup_tokens SET used = 1 WHERE token = ?
        `).run(token);

        return result.changes > 0;
    } catch (error) {
        logger.error(`[SSOSetupTokens] Failed to mark used: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Atomically consume a setup token — validates AND marks used in one step.
 * Returns the token data if valid, or null if already used/expired/invalid.
 * This prevents TOCTOU races where two requests could validate the same token.
 */
export function consumeSSOSetupToken(token: string): SSOSetupToken | null {
    try {
        const now = Math.floor(Date.now() / 1000);

        // Atomic: mark used only if currently valid
        const result = getDb().prepare(`
            UPDATE sso_setup_tokens SET used = 1
            WHERE token = ? AND used = 0 AND expires_at > ?
        `).run(token, now);

        if (result.changes === 0) {
            logger.debug(`[SSOSetupTokens] Consume failed (invalid/expired/used): prefix=${token.substring(0, 8)}`);
            return null;
        }

        // Token was successfully consumed — now read the data
        const row = getDb().prepare(`
            SELECT * FROM sso_setup_tokens WHERE token = ?
        `).get(token) as SSOSetupTokenRow | undefined;

        if (!row) return null;

        return {
            token: row.token,
            provider: row.provider,
            externalId: row.external_id,
            externalUsername: row.external_username,
            externalEmail: row.external_email,
            externalAvatar: row.external_avatar,
            expiresAt: row.expires_at,
            used: true,
            createdAt: row.created_at
        };
    } catch (error) {
        logger.error(`[SSOSetupTokens] Failed to consume: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Cleanup expired tokens (optional maintenance function)
 */
export function cleanupExpiredTokens(): number {
    try {
        const now = Math.floor(Date.now() / 1000);
        const result = getDb().prepare(`
            DELETE FROM sso_setup_tokens WHERE expires_at < ? OR used = 1
        `).run(now - 3600); // Keep used tokens for 1 hour for debugging

        if (result.changes > 0) {
            logger.debug(`[SSOSetupTokens] Cleaned up expired: count=${result.changes}`);
        }
        return result.changes;
    } catch (error) {
        logger.error(`[SSOSetupTokens] Failed to cleanup: error="${(error as Error).message}"`);
        return 0;
    }
}
