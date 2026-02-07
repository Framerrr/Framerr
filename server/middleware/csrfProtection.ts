import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * CSRF Protection Middleware
 * 
 * Requires a custom header on state-changing requests to prevent CSRF.
 * Browsers won't add custom headers cross-origin, so this blocks CSRF attacks.
 * 
 * Works with auth proxy systems (Authentik/Authelia) - they pass through custom headers.
 */
export function csrfProtection() {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Skip for safe methods (GET, HEAD, OPTIONS)
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }

        // Skip for webhook routes - external services can't add custom headers
        if (req.path.startsWith('/api/webhooks/')) {
            return next();
        }

        // Require custom header for all other methods (POST, PUT, DELETE, PATCH)
        const hasClientHeader = req.headers['x-framerr-client'] === '1';

        if (!hasClientHeader) {
            logger.warn(`[CSRF] Request blocked - missing X-Framerr-Client header: method=${req.method} path=${req.path} origin=${req.headers.origin || req.headers.referer || 'unknown'}`);
            res.status(403).json({
                error: 'Invalid request source',
                code: 'CSRF_PROTECTION'
            });
            return;
        }

        next();
    };
}
