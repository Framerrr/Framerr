import { Request, Response, NextFunction } from 'express';
import { hasPermission } from '../utils/permissions';
import logger from '../utils/logger';

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    if (!user) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }
        });
        return;
    }
    next();
};

/**
 * Middleware to require Admin group specifically
 * (Shortcut for checking '*' permission or 'admin' group)
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    // Check if group is admin OR has wildcard permission
    const isExactAdmin = user.group === 'admin';
    const hasWildcard = await hasPermission(user, '*');

    if (!isExactAdmin && !hasWildcard) {
        logger.debug(`[Auth] Admin access denied, user=${user.username}`);
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};
