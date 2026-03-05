/**
 * OIDC Auth Routes
 * 
 * Handles OpenID Connect authentication flows:
 * - Login: Redirect to IdP for authentication
 * - Callback: Process IdP response, create session or setup token
 * - Connect: Link OIDC account to existing user (account linking)
 * - Disconnect: Unlink OIDC account (with lockout guard)
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { isOidcEnabled, getOidcConfig } from '../db/oidcConfig';
import { buildAuthorizationUrl, handleCallback, OidcError } from '../auth/oidcClient';
import { findUserByExternalId, linkAccount, unlinkAccount, getLinkedAccount } from '../db/linkedAccounts';
import { createSSOSetupToken } from '../db/ssoSetupTokens';
import { createUserSession } from '../auth/session';
import { getUserById, hasLocalPassword } from '../db/users';
import { getSystemConfig } from '../db/systemConfig';
import logger from '../utils/logger';
import { importSsoProfilePicture } from '../utils/importSsoProfilePicture';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

// ============================================================================
// Helper: Build the callback URL from the request
// ============================================================================

function getCallbackUrl(req: Request, path: string): string {
    // Prefer Origin header (reflects user-facing URL, works behind proxies and Vite dev server)
    if (req.headers.origin) {
        return `${req.headers.origin}${path}`;
    }

    // Fallback: construct from x-forwarded-host or host
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001';
    return `${protocol}://${host}${path}`;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/auth/oidc/login
 * Initiate OIDC login — returns redirect URL to IdP
 * Public endpoint (no auth required)
 */
router.post('/login', async (_req: Request, res: Response): Promise<void> => {
    try {
        if (!isOidcEnabled()) {
            res.status(403).json({ error: 'OpenID Connect is not enabled' });
            return;
        }

        const callbackUrl = getCallbackUrl(_req, '/api/auth/oidc/callback');
        const { url } = await buildAuthorizationUrl(callbackUrl);

        res.json({ redirectUrl: url });
    } catch (error) {
        const message = (error as Error).message;
        if (error instanceof OidcError && error.code === 'discovery_failed') {
            logger.error(`[OIDC] Login initiation failed (IdP unreachable): error="${message}"`);
            res.status(502).json({ error: 'Could not reach your identity provider. Check that it\'s running and the Issuer URL is correct.' });
        } else {
            logger.error(`[OIDC] Login initiation failed: error="${message}"`);
            res.status(500).json({ error: 'Failed to initiate OIDC login' });
        }
    }
});

/**
 * GET /api/auth/oidc/callback
 * Handle IdP callback — validate tokens, resolve user, redirect
 * Public endpoint (IdP redirects here)
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
    try {
        const state = req.query.state as string;
        if (!state) {
            res.redirect('/login?error=missing_state');
            return;
        }

        // Check for error from IdP
        if (req.query.error) {
            const errorDesc = req.query.error_description || req.query.error;
            logger.warn(`[OIDC] IdP returned error: error="${req.query.error}" description="${errorDesc}"`);
            // Can't know intent from error alone — redirect to login with error
            res.redirect(`/login?error=${encodeURIComponent(String(errorDesc))}`);
            return;
        }

        // Build the full callback URL for openid-client validation
        const callbackUrl = getCallbackUrl(req, '/api/auth/oidc/callback');
        const currentUrl = new URL(`${callbackUrl}?${new URLSearchParams(req.query as Record<string, string>).toString()}`);

        // Exchange code, validate ID Token, get claims
        // userId is populated for account-linking flows, undefined for login flows
        const { claims, userId: connectUserId } = await handleCallback(currentUrl, state);

        // ================================================================
        // Account-linking flow (user was already authenticated)
        // ================================================================
        if (connectUserId) {
            // Check if this OIDC account is already linked to another user
            const existingLink = findUserByExternalId('oidc', claims.sub);
            if (existingLink && existingLink !== connectUserId) {
                res.redirect('/#settings/account/connected?error=already_linked_other');
                return;
            }

            // Link the account
            linkAccount(connectUserId, 'oidc', {
                externalId: claims.sub,
                externalUsername: claims.preferredUsername || claims.name || claims.email,
                externalEmail: claims.email,
                metadata: {
                    picture: claims.picture,
                    emailVerified: claims.emailVerified,
                    linkedVia: 'settings',
                },
            });

            logger.info(`[OIDC] Account linked: userId="${connectUserId}" sub="${claims.sub}"`);

            // Import SSO profile picture if user doesn't have one (awaited — ready before redirect)
            await importSsoProfilePicture(connectUserId, claims.picture);

            res.redirect('/#settings/account/connected?oidc_linked=true');
            return;
        }

        // ================================================================
        // Login flow (no existing session)
        // ================================================================

        // Resolve user by OIDC sub claim
        const linkedUserId = findUserByExternalId('oidc', claims.sub);

        if (linkedUserId) {
            // Existing linked user — create session and redirect
            const user = await getUserById(linkedUserId);
            if (!user) {
                logger.error(`[OIDC] Linked user not found: userId="${linkedUserId}" sub="${claims.sub}"`);
                res.redirect('/login?error=account_not_found');
                return;
            }

            // Create session
            const systemConfig = await getSystemConfig();
            const expiresIn = systemConfig.auth?.session?.timeout || 86400000; // 24h
            const session = await createUserSession(user, req, expiresIn);

            res.cookie('sessionId', session.id, {
                httpOnly: true,
                secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
                sameSite: 'lax',
                maxAge: expiresIn,
            });

            // Import SSO profile picture if user doesn't have one (awaited — ready before redirect)
            await importSsoProfilePicture(user.id, claims.picture);

            logger.info(`[OIDC] User logged in: username="${user.username}" sub="${claims.sub}"`);
            res.redirect('/');
            return;
        }

        // No linked user — check auto-create setting
        const oidcConfig = getOidcConfig();

        if (!oidcConfig.autoCreateUsers) {
            logger.info(`[OIDC] Auto-create disabled, rejecting: sub="${claims.sub}" username="${claims.preferredUsername || 'unknown'}"`);
            res.redirect('/login?error=no_account');
            return;
        }

        // Auto-create enabled → redirect to SSO setup page
        const displayName = claims.preferredUsername || claims.name || claims.email || claims.sub;

        const setupToken = createSSOSetupToken('oidc', {
            externalId: claims.sub,
            externalUsername: displayName,
            externalEmail: claims.email,
            externalAvatar: claims.picture,
        });

        logger.info(`[OIDC] New user, redirecting to setup: sub="${claims.sub}" username="${displayName}"`);
        res.redirect(`/sso-setup?token=${setupToken}`);
    } catch (error) {
        if (error instanceof OidcError) {
            logger.error(`[OIDC] Callback failed: code="${error.code}" error="${error.message}"`);
            res.redirect(`/login?error=${error.code}`);
        } else {
            logger.error(`[OIDC] Callback failed: error="${(error as Error).message}"`);
            res.redirect('/login?error=oidc_failed');
        }
    }
});

/**
 * POST /api/auth/oidc/connect
 * Initiate OIDC account linking (authenticated user)
 * Returns redirect URL to IdP
 */
router.post('/connect', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        if (!isOidcEnabled()) {
            res.status(403).json({ error: 'OpenID Connect is not enabled' });
            return;
        }

        // Check if user already has OIDC linked
        const existing = getLinkedAccount(userId, 'oidc');
        if (existing) {
            res.status(409).json({ error: 'OIDC account already linked' });
            return;
        }

        const callbackUrl = getCallbackUrl(req, '/api/auth/oidc/callback');
        const { url } = await buildAuthorizationUrl(callbackUrl, userId);

        res.json({ redirectUrl: url });
    } catch (error) {
        const message = (error as Error).message;
        if (error instanceof OidcError && error.code === 'discovery_failed') {
            logger.error(`[OIDC] Connect initiation failed (IdP unreachable): error="${message}"`);
            res.status(502).json({ error: 'Could not reach your identity provider. Please try again later.' });
        } else {
            logger.error(`[OIDC] Connect initiation failed: error="${message}"`);
            res.status(500).json({ error: 'Failed to initiate OIDC connection' });
        }
    }
});


/**
 * POST /api/auth/oidc/disconnect
 * Unlink OIDC account from current user (with lockout guard)
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        // Disconnect guard: prevent lockout
        const hasPassword = hasLocalPassword(userId);
        const hasPlexLink = getLinkedAccount(userId, 'plex') !== null;
        const hasOidcLink = getLinkedAccount(userId, 'oidc') !== null;

        if (!hasOidcLink) {
            res.status(404).json({ error: 'No OIDC account linked' });
            return;
        }

        // Count remaining auth methods AFTER removing OIDC
        const remainingMethods = (hasPassword ? 1 : 0) + (hasPlexLink ? 1 : 0);

        if (remainingMethods === 0) {
            res.status(400).json({
                error: 'Cannot disconnect — this is your only authentication method. Set up a local password first.'
            });
            return;
        }

        unlinkAccount(userId, 'oidc');
        logger.info(`[OIDC] Account disconnected: userId="${userId}"`);

        res.json({ success: true });
    } catch (error) {
        logger.error(`[OIDC] Disconnect failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to disconnect OIDC account' });
    }
});

export default router;
