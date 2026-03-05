import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware
 * 
 * Protects against API abuse and DoS attempts.
 * Uses per-user rate limiting (falls back to IP for unauthenticated requests).
 * Values are easily adjustable - just change the numbers.
 */

/**
 * Key generator for per-user rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
const userKeyGenerator = (req: Request): string => {
    return req.user?.id || req.ip || 'unknown';
};

/**
 * Standard rate limit for API endpoints
 * 300 requests per minute per user
 */
export const standardRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    keyGenerator: userKeyGenerator,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limit for proxy endpoints (widget data)
 * 120 requests per minute per user
 * 
 * Comfortable headroom for:
 * - All widgets polling simultaneously (~50-70/min)
 * - Multiple tabs open (~100/min)
 * - Quick page switching and refreshes
 */
export const proxyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: userKeyGenerator,
    message: { error: 'Too many proxy requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Strict rate limit for auth endpoints
 * 10 attempts per minute per IP (prevents brute force)
 * 
 * Custom handler: browser navigations (OIDC callbacks) get redirected
 * to the login page with a styled error. API calls get standard JSON 429.
 */
export const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
        const accept = _req.headers.accept || '';
        if (accept.includes('text/html')) {
            // Browser navigation (e.g. OIDC callback redirect from IdP)
            res.redirect('/login?error=rate_limited');
        } else {
            // API call (e.g. login form POST, Plex login POST)
            res.status(429).json({ error: 'Too many authentication attempts, please try again later' });
        }
    },
});
