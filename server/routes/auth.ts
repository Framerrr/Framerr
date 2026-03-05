import { Router, Request, Response } from 'express';
import { hashPassword, verifyPassword, validatePassword, getPasswordPolicy } from '../auth/password';
import { createUserSession, validateSession } from '../auth/session';
import { getUser, getUserById, getUserByEmail, listUsers, revokeSession, revokeAllUserSessions, createUser, updateUser, hasLocalPassword, getRequirePasswordReset, setRequirePasswordReset, createSession } from '../db/users';
import { getUserConfig } from '../db/userConfig';
import { getSystemConfig } from '../db/systemConfig';
import { findUserByExternalId, linkAccount, getLinkedAccount, updateLinkedAccountMetadata } from '../db/linkedAccounts';
import { createSSOSetupToken } from '../db/ssoSetupTokens';
import { checkPlexLibraryAccess } from '../utils/plexLibraryAccess';
import logger from '../utils/logger';
import { importSsoProfilePicture } from '../utils/importSsoProfilePicture';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Types for request bodies
interface LoginBody {
    username: string;
    password: string;
    rememberMe?: boolean;
}

interface PlexLoginBody {
    plexToken: string;
    plexUserId: string;
}

interface PlexUserResponse {
    id: number;
    username: string;
    email?: string;
    thumb?: string;
}

interface SessionConfig {
    timeout?: number;
    rememberMeDuration?: number;
}

// Get auth config helper
const getAuthConfig = async () => {
    const config = await getSystemConfig();
    return config.auth;
};

/**
 * GET /api/auth/password-policy
 * Return current password policy for frontend validation (public, no auth required)
 */
router.get('/password-policy', (_req: Request, res: Response): void => {
    const policy = getPasswordPolicy();
    res.json(policy);
});

/**
 * POST /api/auth/login
 * Login with username/password
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password, rememberMe } = req.body as LoginBody;
        const authConfig = await getAuthConfig();

        if (!authConfig.local.enabled) {
            res.status(403).json({ error: 'Local authentication is disabled' });
            return;
        }

        let user = await getUser(username);
        // Fallback: try email if username lookup fails
        if (!user) {
            user = await getUserByEmail(username);
        }
        if (!user) {
            logger.warn(`[Auth] Login failed: User not found username=${username}`);
            res.status(401).json({ error: 'Login failed. Please check your credentials and try again.' });
            return;
        }

        const isValid = await verifyPassword(password, user.passwordHash || '');
        if (!isValid) {
            logger.warn(`[Auth] Login failed: Invalid password username=${username}`);
            res.status(401).json({ error: 'Login failed. Please check your credentials and try again.' });
            return;
        }

        // Create session
        const sessionConfig = authConfig.session as SessionConfig | undefined;
        const expiresIn = rememberMe
            ? (sessionConfig?.rememberMeDuration || 2592000000) // 30 days
            : (sessionConfig?.timeout || 86400000); // 24 hours

        const session = await createUserSession(user, req, expiresIn);

        // Set cookie
        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: expiresIn
        });

        logger.info(`[Auth] User logged in: username=${username}`);

        // Check if user must change password
        const requirePasswordChange = getRequirePasswordReset(user.id);

        // Fetch displayName from preferences
        const config = await getUserConfig(user.id);
        const displayName = config.preferences?.displayName || user.displayName || user.username;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName,
                group: user.group,
                preferences: user.preferences
            },
            requirePasswordChange
        });
    } catch (error) {
        logger.error(`[Auth] Login error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/logout
 * Browser-native logout with HTTP redirect (for auth proxy compatibility)
 * This eliminates race conditions by letting the browser handle the redirect
 */
router.get('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
        const sessionId = req.cookies?.sessionId;
        if (sessionId) {
            await revokeSession(sessionId);
        }
        res.clearCookie('sessionId');

        // Check if proxy auth redirect is configured
        const systemConfig = await getSystemConfig();
        const proxy = systemConfig?.auth?.proxy || {};

        if (proxy.enabled && proxy.overrideLogout && proxy.logoutUrl) {
            logger.info('[Logout] Redirecting to proxy logout URL');
            res.redirect(302, proxy.logoutUrl);
            return;
        }

        // Local auth - redirect to login page
        logger.info('[Logout] Redirecting to login page');
        res.redirect(302, '/login');
    } catch (error) {
        logger.error(`[Auth] Logout error: error="${(error as Error).message}"`);
        res.redirect(302, '/login?error=logout_failed');
    }
});

/**
 * POST /api/auth/logout
 * JSON API logout (kept for backward compatibility)
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
        const sessionId = req.cookies?.sessionId;
        if (sessionId) {
            await revokeSession(sessionId);
        }
        res.clearCookie('sessionId');

        // Check if proxy auth redirect is configured (read fresh config)
        const systemConfig = await getSystemConfig();
        const proxy = systemConfig?.auth?.proxy || {};

        if (proxy.enabled && proxy.overrideLogout && proxy.logoutUrl) {
            res.json({
                success: true,
                redirectUrl: proxy.logoutUrl
            });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        logger.error(`[Auth] Logout error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
    try {
        // Check if user is already authenticated (via session or proxy auth middleware)
        if (req.user) {
            // Log authentication method accurately
            const authMethod = req.proxyAuth ? 'proxy auth' : 'session';
            logger.debug(`[Auth] /me: Authenticated user via ${authMethod}: username=${req.user.username}`);

            // Fetch displayName and profilePicture from preferences
            const config = await getUserConfig(req.user.id);
            const displayName = config.preferences?.displayName || req.user.displayName || req.user.username;
            const profilePicture = config.preferences?.profilePicture || null;

            res.json({
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    email: (req.user as any).email,
                    displayName,
                    profilePicture,
                    group: req.user.group,
                    preferences: req.user.preferences,
                    hasLocalPassword: hasLocalPassword(req.user.id)
                },
                requirePasswordChange: getRequirePasswordReset(req.user.id)
            });
            return;
        }

        // Fall back to session-based auth
        const sessionId = req.cookies?.sessionId;
        if (!sessionId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const session = await validateSession(sessionId);
        if (!session) {
            res.clearCookie('sessionId');
            res.status(401).json({ error: 'Session invalid or expired' });
            return;
        }

        const user = await getUserById(session.userId);
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        // Attach user to request for middleware use (if this was middleware)
        req.user = user as unknown as Express.Request['user'];

        // Fetch displayName and profilePicture from preferences
        const config = await getUserConfig(user.id);
        const displayName = config.preferences?.displayName || user.displayName || user.username;
        const profilePicture = config.preferences?.profilePicture || null;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName,
                profilePicture,
                group: user.group,
                preferences: user.preferences,
                hasLocalPassword: hasLocalPassword(user.id)
            },
            requirePasswordChange: getRequirePasswordReset(user.id)
        });
    } catch (error) {
        logger.error(`[Auth] Auth check error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Auth check failed' });
    }
});

/**
 * POST /api/auth/plex-login
 * Login with Plex SSO
 */
router.post('/plex-login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { plexToken, plexUserId } = req.body as PlexLoginBody;

        if (!plexToken || !plexUserId) {
            res.status(400).json({ error: 'Plex token and user ID are required' });
            return;
        }

        // Get SSO config
        const systemConfig = await getSystemConfig();
        const ssoConfig = systemConfig.plexSSO;

        if (!ssoConfig?.enabled) {
            res.status(403).json({ error: 'Plex SSO is not enabled' });
            return;
        }

        // Get user info from Plex
        const clientId = ssoConfig.clientIdentifier || '';
        const userResponse = await axios.get<PlexUserResponse>('https://plex.tv/api/v2/user', {
            headers: {
                'Accept': 'application/json',
                'X-Plex-Token': plexToken as string,
                'X-Plex-Client-Identifier': clientId as string
            }
        });

        const plexUser = userResponse.data;

        // Check if this Plex user has library access (or is admin)
        logger.info(`[PlexSSO] Checking user access: plexUserId=${plexUser.id} plexUsername=${plexUser.username} adminPlexId=${ssoConfig.adminPlexId} machineId=${ssoConfig.machineId}`);

        let isPlexAdmin = false;
        if (ssoConfig.machineId && ssoConfig.adminToken) {
            try {
                const accessResult = await checkPlexLibraryAccess(
                    plexUser.id.toString(),
                    {
                        adminToken: ssoConfig.adminToken as string,
                        machineId: ssoConfig.machineId as string,
                        clientIdentifier: (ssoConfig.clientIdentifier as string) || '',
                        adminPlexId: ssoConfig.adminPlexId as string,
                    }
                );
                isPlexAdmin = accessResult.isAdmin;
                if (!accessResult.hasAccess) {
                    logger.warn(`[PlexSSO] User does not have library access: plexUserId=${plexUser.id} plexUsername=${plexUser.username}`);
                    res.status(403).json({ error: 'Login failed. Please check your credentials and try again.' });
                    return;
                }
            } catch (accessError) {
                logger.error(`[PlexSSO] Failed to verify library access: error="${(accessError as Error).message}"`);
                res.status(500).json({ error: 'Failed to verify library access' });
                return;
            }
        } else {
            // No machineId/adminToken configured — check admin by plexId only
            isPlexAdmin = plexUser.id.toString() === ssoConfig.adminPlexId?.toString();
            if (!isPlexAdmin) {
                logger.error('[PlexSSO] No machine ID configured for library access check');
                res.status(500).json({ error: 'Plex server not configured' });
                return;
            }
        }

        // Find or create Framerr user for this Plex user
        let user;

        // Check if user already has a linked Plex account
        const linkedUserId = findUserByExternalId('plex', plexUser.id.toString());

        if (linkedUserId) {
            // Existing linked user - use that account
            user = await getUserById(linkedUserId);
            logger.debug(`[PlexSSO] Found existing linked account: plexUsername=${plexUser.username} framerUser=${user?.username}`);

            // Refresh stored Plex token (used for personalized recommendations)
            if (user) {
                const existingLink = getLinkedAccount(user.id, 'plex');
                if (existingLink) {
                    updateLinkedAccountMetadata(user.id, 'plex', {
                        ...existingLink.metadata,
                        plexToken: plexToken,
                        tokenUpdatedAt: Date.now()
                    });
                }
            }

        } else if (isPlexAdmin && ssoConfig.linkedUserId) {
            // Plex admin logging in - map to the configured Framerr admin user
            user = await getUserById(ssoConfig.linkedUserId as string);
            if (user) {
                // Link this Plex account to the Framerr admin
                linkAccount(user.id, 'plex', {
                    externalId: plexUser.id.toString(),
                    externalUsername: plexUser.username,
                    externalEmail: plexUser.email,
                    metadata: {
                        thumb: plexUser.thumb,
                        linkedVia: 'sso-admin',
                        plexToken: plexToken,
                        tokenUpdatedAt: Date.now()
                    }
                });
                logger.info(`[PlexSSO] Linked Plex admin to Framerr user: plexUsername=${plexUser.username} framerUser=${user.username}`);

                // Import Plex avatar if user doesn't have one (awaited — ready before response)
                await importSsoProfilePicture(user.id, plexUser.thumb);
            }
        } else {
            // No linked user found
            // Check autoCreateUsers flag (defaults to true for backward compat)
            const autoCreateEnabled = ssoConfig.autoCreateUsers !== false;

            if (!autoCreateEnabled) {
                logger.info(`[PlexSSO] Auto-create disabled, rejecting new user: plexUsername=${plexUser.username}`);
                res.status(403).json({
                    error: 'No account found. Contact your administrator to get access.'
                });
                return;
            }

            // Redirect to account setup page
            logger.info(`[PlexSSO] No linked account found, redirecting to setup: plexUsername=${plexUser.username}`);

            // Generate setup token for the frontend to use
            const setupToken = createSSOSetupToken('plex', {
                externalId: plexUser.id.toString(),
                externalUsername: plexUser.username,
                externalEmail: plexUser.email,
                externalAvatar: plexUser.thumb
            });

            res.json({
                needsAccountSetup: true,
                setupToken,
                plexUser: {
                    username: plexUser.username,
                    email: plexUser.email,
                    thumb: plexUser.thumb
                }
            });
            return;
        }

        if (!user) {
            logger.warn(`[PlexSSO] No matching user found: plexUsername=${plexUser.username}`);
            res.status(403).json({ error: 'Login failed. Please check your credentials and try again.' });
            return;
        }

        // Create session
        const expiresIn = systemConfig.auth?.session?.timeout || 86400000;
        const session = await createUserSession(user, req, expiresIn);

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: expiresIn
        });

        // Import Plex avatar if user doesn't have one (awaited — ready before response)
        await importSsoProfilePicture(user!.id, plexUser.thumb);

        logger.info(`[PlexSSO] User logged in: ${user.username}`);

        // Fire-and-forget: try to auto-match/refresh Overseerr account
        import('../services/overseerrAutoMatch').then(m => m.tryAutoMatchSingleUser(user.id)).catch(() => { });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName || user.username,
                group: user.group,
                preferences: user.preferences
            }
        });

    } catch (error) {
        logger.error(`[PlexSSO] Login error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Plex login failed' });
    }
});

/**
 * POST /api/auth/change-password
 * Force-change password (used after admin reset)
 * Requires active session (user just logged in with temp password)
 */
router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate session
        const sessionId = req.cookies?.sessionId;
        if (!sessionId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const sessionData = await validateSession(sessionId);
        if (!sessionData) {
            res.status(401).json({ error: 'Invalid session' });
            return;
        }

        const { newPassword } = req.body as { newPassword?: string };

        if (!newPassword || !newPassword.trim()) {
            res.status(400).json({ error: 'Password is required' });
            return;
        }

        const validation = validatePassword(newPassword.trim());
        if (!validation.valid) {
            res.status(400).json({ error: validation.errors[0] });
            return;
        }

        // Verify that this user actually needs a password change
        const requireChange = getRequirePasswordReset(sessionData.userId);
        if (!requireChange) {
            res.status(400).json({ error: 'Password change not required' });
            return;
        }

        // Hash and update password
        const passwordHash = await hashPassword(newPassword);
        await updateUser(sessionData.userId, { passwordHash });

        // Clear the force-change flag
        setRequirePasswordReset(sessionData.userId, false);

        // Revoke all sessions and create a fresh one
        await revokeAllUserSessions(sessionData.userId);

        const user = await getUserById(sessionData.userId);
        if (!user) {
            res.status(500).json({ error: 'User not found after password change' });
            return;
        }

        const newSession = await createSession(user.id, {
            ipAddress: req.ip || undefined,
            userAgent: req.headers['user-agent'] || undefined
        });

        // Set new session cookie (30 day default)
        res.cookie('sessionId', newSession.id, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: 2592000000 // 30 days
        });

        // Fetch displayName
        const config = await getUserConfig(user.id);
        const displayName = config.preferences?.displayName || user.displayName || user.username;

        logger.info(`[Auth] Password changed (force-change): username="${user.username}"`);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName,
                group: user.group,
                preferences: user.preferences
            }
        });
    } catch (error) {
        logger.error(`[Auth] Change password error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// =============================================================================
// SSO Configuration (public — for login page button rendering)
// =============================================================================

/**
 * GET /api/auth/sso-config
 * Returns which SSO methods are available (for login page to render buttons)
 * Public endpoint — no auth required
 */
router.get('/sso-config', async (_req: Request, res: Response): Promise<void> => {
    try {
        const systemConfig = await getSystemConfig();
        const plexSSOEnabled = !!(systemConfig.plexSSO?.enabled);

        // OIDC status
        let oidcEnabled = false;
        let oidcDisplayName = 'SSO';
        let oidcButtonIcon = 'KeyRound';

        try {
            const { isOidcEnabled, getOidcConfigRedacted } = await import('../db/oidcConfig');
            oidcEnabled = isOidcEnabled();
            if (oidcEnabled) {
                const oidcConfig = getOidcConfigRedacted();
                oidcDisplayName = oidcConfig.displayName || 'SSO';
                oidcButtonIcon = oidcConfig.buttonIcon || 'KeyRound';
            }
        } catch {
            // OIDC not available (migration not run yet, etc.)
        }

        res.json({
            plex: { enabled: plexSSOEnabled },
            oidc: { enabled: oidcEnabled, displayName: oidcDisplayName, buttonIcon: oidcButtonIcon },
        });
    } catch (error) {
        logger.error(`[Auth] SSO config fetch error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch SSO configuration' });
    }
});

export default router;
