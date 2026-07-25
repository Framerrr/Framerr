import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware
 *
 * Protects against API abuse and DoS attempts.
 * Uses per-user rate limiting (falls back to IP for unauthenticated requests).
 *
 * Calibrated for self-hosted (1–10 trusted users). Dev is looser so HMR,
 * multi-dashboard keep-alive, and laggy reconnects don't trip 429s mid-test.
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Key generator for per-user rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
const userKeyGenerator = (req: Request): string => {
    return req.user?.id || req.ip || 'unknown';
};

/**
 * Standard rate limit for API endpoints
 * Prod: 900/min · Dev: 2500/min (was 300 — too tight for widget-heavy dashboards)
 */
export const standardRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? 2500 : 900,
    keyGenerator: userKeyGenerator,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limit for proxy endpoints (widget data)
 * Prod: 300/min · Dev: 1000/min
 */
export const proxyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 1000 : 300,
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
