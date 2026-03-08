/**
 * Session Management
 * 
 * CRUD operations for user sessions (login tokens).
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { getDb } from '../../database/db';
import type { Session, SessionRow, SessionData } from './types';

/**
 * Create a session
 */
export function createSession(userId: string, sessionData: SessionData, expiresIn: number = 86400000): Session {
    try {
        const token = uuidv4();
        const createdAt = Math.floor(Date.now() / 1000);
        const expiresAt = Math.floor((Date.now() + expiresIn) / 1000);

        const stmt = getDb().prepare(`
            INSERT INTO sessions (token, user_id, ip_address, user_agent, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            token,
            userId,
            sessionData.ipAddress || null,
            sessionData.userAgent || null,
            createdAt,
            expiresAt
        );

        return {
            id: token,
            userId,
            ipAddress: sessionData.ipAddress || null,
            userAgent: sessionData.userAgent || null,
            createdAt,
            expiresAt
        };
    } catch (error) {
        logger.error(`[Sessions] Failed to create: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): Session | null {
    try {
        const session = getDb().prepare(`
            SELECT token as id, user_id as userId, ip_address as ipAddress, 
                   user_agent as userAgent, created_at as createdAt, expires_at as expiresAt
            FROM sessions
            WHERE token = ?
        `).get(sessionId) as SessionRow | undefined;

        if (!session) return null;

        const now = Math.floor(Date.now() / 1000);

        if (session.expiresAt < now) {
            revokeSession(sessionId);
            return null;
        }

        // Sliding expiration: extend session when past the halfway point
        // This keeps active users logged in without writing to DB on every request
        const duration = session.expiresAt - session.createdAt;
        const halfwayPoint = session.createdAt + Math.floor(duration / 2);

        if (now > halfwayPoint) {
            const newExpiresAt = now + duration;
            // Update both createdAt and expiresAt so the sliding window stays constant
            getDb().prepare('UPDATE sessions SET created_at = ?, expires_at = ? WHERE token = ?')
                .run(now, newExpiresAt, sessionId);
            session.createdAt = now;
            session.expiresAt = newExpiresAt;
            logger.debug(`[Sessions] Sliding expiration extended: id=${sessionId.slice(0, 8)}... newExpiry=${new Date(newExpiresAt * 1000).toISOString()}`);
        }

        return session;
    } catch (error) {
        logger.error(`[Sessions] Failed to get: id=${sessionId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Revoke a session
 */
export function revokeSession(sessionId: string): void {
    try {
        getDb().prepare('DELETE FROM sessions WHERE token = ?').run(sessionId);
    } catch (error) {
        logger.error(`[Sessions] Failed to revoke: id=${sessionId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Revoke all sessions for a user
 */
export function revokeAllUserSessions(userId: string): void {
    try {
        getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    } catch (error) {
        logger.error(`[Sessions] Failed to revoke all: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get all sessions for a user
 */
export function getUserSessions(userId: string): Session[] {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const sessions = getDb().prepare(`
            SELECT token as id, user_id as userId, ip_address as ipAddress,
                   user_agent as userAgent, created_at as createdAt, expires_at as expiresAt
            FROM sessions
            WHERE user_id = ? AND expires_at > ?
            ORDER BY created_at DESC
        `).all(userId, currentTime) as SessionRow[];

        return sessions;
    } catch (error) {
        logger.error(`[Sessions] Failed to get user sessions: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const result = getDb().prepare(`
            DELETE FROM sessions WHERE expires_at < ?
        `).run(currentTime);

        if (result.changes > 0) {
            logger.debug(`[Sessions] Cleanup: expired=${result.changes}`);
        }
    } catch (error) {
        logger.error(`[Sessions] Failed to cleanup: error="${(error as Error).message}"`);
        throw error;
    }
}
