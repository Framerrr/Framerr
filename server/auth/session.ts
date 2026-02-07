import { Request } from 'express';
import { createSession, getSession } from '../db/users';
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
