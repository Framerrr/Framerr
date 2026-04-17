import { Request } from 'express';
import { createSession, getSession } from '../db/users';
import { getSystemConfig } from '../db/systemConfig';
import logger from '../utils/logger';

interface User {
    id: string;
    username: string;
}

interface Session {
    id: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: number;
    expiresAt: number;
}

/**
 * Named session durations resolved from system config.
 * All callsites use this instead of hardcoding millisecond values so that
 * future per-user duration preferences only need to change this one function.
 */
export interface SessionDurations {
    /** Local login without "Remember me", proxy auth session handoff */
    default: number;
    /** Local login with "Remember me" checked */
    rememberMe: number;
    /** SSO logins (Plex, OIDC, SSO setup) — user has no duration choice */
    sso: number;
}

export async function getSessionDurations(): Promise<SessionDurations> {
    const config = await getSystemConfig();
    const session = config.auth?.session;
    const rememberMe = session?.rememberMeDuration ?? 2592000000; // 30 days
    return {
        default: session?.timeout ?? 604800000,  // 7 days
        rememberMe,
        sso: rememberMe,
    };
}

/**
 * Create a new user session
 */
export async function createUserSession(user: User, req: Request, expiresIn: number): Promise<Session> {
    const sessionData = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    };

    try {
        const session = await createSession(user.id, sessionData, expiresIn);
        return session;
    } catch (error) {
        logger.error(`[Session] Failed to create: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Validate a session
 */
export async function validateSession(sessionId: string): Promise<Session | null> {
    try {
        return await getSession(sessionId);
    } catch (error) {
        logger.error(`[Session] Failed to validate: error="${(error as Error).message}"`);
        return null;
    }
}
