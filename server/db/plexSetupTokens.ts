/**
 * Plex Setup Tokens Database Module
 * Manages temporary tokens for Plex account setup flow
 */
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

interface PlexSetupTokenRow {
    token: string;
    plex_id: string;
    plex_username: string;
    plex_email: string | null;
    plex_thumb: string | null;
    expires_at: number;
    used: number;
    created_at: number;
}

export interface PlexSetupToken {
    token: string;
    plexId: string;
    plexUsername: string;
    plexEmail: string | null;
    plexThumb: string | null;
    expiresAt: number;
    used: boolean;
    createdAt: number;
}

export interface PlexUserInfo {
    plexId: string;
    plexUsername: string;
    plexEmail?: string;
    plexThumb?: string;
}

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a new setup token for Plex user
 */
export function createPlexSetupToken(plexUser: PlexUserInfo): string {
    const token = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.floor(TOKEN_EXPIRY_MS / 1000);

    try {
        getDb().prepare(`
            INSERT INTO plex_setup_tokens 
            (token, plex_id, plex_username, plex_email, plex_thumb, expires_at, used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
            token,
            plexUser.plexId,
            plexUser.plexUsername,
            plexUser.plexEmail || null,
            plexUser.plexThumb || null,
            expiresAt,
            now
        );

        logger.debug(`[PlexSetupTokens] Created: user="${plexUser.plexUsername}"`);
        return token;
    } catch (error) {
        logger.error(`[PlexSetupTokens] Failed to create: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Validate and retrieve a setup token
 * Returns null if token doesn't exist, is expired, or already used
 */
export function validatePlexSetupToken(token: string): PlexSetupToken | null {
    try {
        const now = Math.floor(Date.now() / 1000);
        const row = getDb().prepare(`
            SELECT * FROM plex_setup_tokens 
            WHERE token = ? AND used = 0 AND expires_at > ?
        `).get(token, now) as PlexSetupTokenRow | undefined;

        if (!row) {
            logger.debug(`[PlexSetupTokens] Token invalid or expired: prefix=${token.substring(0, 8)}`);
            return null;
        }

        return {
            token: row.token,
            plexId: row.plex_id,
            plexUsername: row.plex_username,
            plexEmail: row.plex_email,
            plexThumb: row.plex_thumb,
            expiresAt: row.expires_at,
            used: row.used === 1,
            createdAt: row.created_at
        };
    } catch (error) {
        logger.error(`[PlexSetupTokens] Failed to validate: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Mark a token as used (invalidates it)
 */
export function markTokenUsed(token: string): boolean {
    try {
        const result = getDb().prepare(`
            UPDATE plex_setup_tokens SET used = 1 WHERE token = ?
        `).run(token);

        return result.changes > 0;
    } catch (error) {
        logger.error(`[PlexSetupTokens] Failed to mark used: error="${(error as Error).message}"`);
        return false;
    }
}

/**
 * Cleanup expired tokens (optional maintenance function)
 */
export function cleanupExpiredTokens(): number {
    try {
        const now = Math.floor(Date.now() / 1000);
        const result = getDb().prepare(`
            DELETE FROM plex_setup_tokens WHERE expires_at < ? OR used = 1
        `).run(now - 3600); // Keep used tokens for 1 hour for debugging

        if (result.changes > 0) {
            logger.debug(`[PlexSetupTokens] Cleaned up expired: count=${result.changes}`);
        }
        return result.changes;
    } catch (error) {
        logger.error(`[PlexSetupTokens] Failed to cleanup: error="${(error as Error).message}"`);
        return 0;
    }
}
