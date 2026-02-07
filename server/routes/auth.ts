import { Router, Request, Response } from 'express';
import { hashPassword, verifyPassword } from '../auth/password';
import { createUserSession, validateSession } from '../auth/session';
import { getUser, getUserById, listUsers, revokeSession, createUser, hasLocalPassword } from '../db/users';
import { getUserConfig } from '../db/userConfig';
import { getSystemConfig } from '../db/systemConfig';
import { findUserByExternalId, linkAccount } from '../db/linkedAccounts';
import { createPlexSetupToken } from '../db/plexSetupTokens';
import logger from '../utils/logger';
import axios from 'axios';
import xml2js from 'xml2js';
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

interface SharedServer {
    userID?: string;
    invitedId?: string;
    id?: string;
    username?: string;
    email?: string;
}

interface ParsedSharedServersXML {
    MediaContainer?: {
        SharedServer?: SharedServer | SharedServer[];
    };
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

        const user = await getUser(username);
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
            secure: false, // Allow HTTP for Docker/IP access
            sameSite: 'lax',
            maxAge: expiresIn
        });

        logger.info(`[Auth] User logged in: username=${username}`);

        // Fetch displayName from preferences
        const config = await getUserConfig(user.id);
        const displayName = config.preferences?.displayName || user.displayName || user.username;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName,
                group: user.group,
                preferences: user.preferences
            }
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
                    displayName,
                    profilePicture,
                    group: req.user.group,
                    preferences: req.user.preferences
                }
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
                displayName,
                profilePicture,
                group: user.group,
                preferences: user.preferences
            }
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

        // Check if this Plex user is the admin or has library access
        const isPlexAdmin = plexUser.id.toString() === ssoConfig.adminPlexId?.toString();

        logger.info(`[PlexSSO] Checking user access: plexUserId=${plexUser.id} plexUsername=${plexUser.username} adminPlexId=${ssoConfig.adminPlexId} isPlexAdmin=${isPlexAdmin} machineId=${ssoConfig.machineId}`);

        if (!isPlexAdmin) {
            // Verify user has library access on the specific Plex server
            if (!ssoConfig.machineId) {
                logger.error('[PlexSSO] No machine ID configured');
                res.status(500).json({ error: 'Plex server not configured' });
                return;
            }

            let sharedUsers: SharedServer[] = [];
            try {
                const sharedServersResponse = await axios.get<string>(
                    `https://plex.tv/api/servers/${ssoConfig.machineId}/shared_servers`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'X-Plex-Token': ssoConfig.adminToken as string,
                            'X-Plex-Client-Identifier': clientId as string
                        }
                    }
                );

                const responseData = sharedServersResponse.data;
                logger.info(`[PlexSSO] shared_servers raw response: status=${sharedServersResponse.status} dataType=${typeof responseData}`);

                // API returns XML, not JSON - need to parse it
                if (typeof responseData === 'string' && responseData.includes('<?xml')) {
                    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                    const parsed = await parser.parseStringPromise(responseData) as ParsedSharedServersXML;

                    const sharedServers = parsed?.MediaContainer?.SharedServer;
                    if (sharedServers) {
                        sharedUsers = Array.isArray(sharedServers) ? sharedServers : [sharedServers];
                    }

                    logger.info(`[PlexSSO] Parsed XML shared users: count=${sharedUsers.length}`);
                } else if (typeof responseData === 'object' && (responseData as unknown as ParsedSharedServersXML)?.MediaContainer?.SharedServer) {
                    const data = responseData as unknown as ParsedSharedServersXML;
                    const sharedServers = data.MediaContainer!.SharedServer;
                    sharedUsers = Array.isArray(sharedServers) ? sharedServers : [sharedServers!];
                }
            } catch (apiError) {
                const err = apiError as { message: string; response?: { status: number; data: unknown } };
                logger.error(`[PlexSSO] Failed to fetch shared servers: error="${err.message}" status=${err.response?.status}`);
                res.status(500).json({ error: 'Failed to verify library access' });
                return;
            }

            logger.info(`[PlexSSO] Checking library access: machineId=${ssoConfig.machineId} sharedUserCount=${sharedUsers.length} lookingForId=${plexUser.id} lookingForUsername=${plexUser.username}`);

            // Check if logging-in user has library access on this server
            const hasLibraryAccess = sharedUsers.some(sharedUser => {
                const sharedUserId = sharedUser.userID || sharedUser.invitedId || sharedUser.id;
                const matches = sharedUserId?.toString() === plexUser.id.toString();
                if (matches) {
                    logger.debug(`[PlexSSO] Found matching shared user: userId=${sharedUserId} username=${sharedUser.username || sharedUser.email}`);
                }
                return matches;
            });

            if (!hasLibraryAccess) {
                logger.warn(`[PlexSSO] User does not have library access: plexUserId=${plexUser.id} plexUsername=${plexUser.username} machineId=${ssoConfig.machineId}`);
                res.status(403).json({ error: 'Login failed. Please check your credentials and try again.' });
                return;
            }

            logger.info(`[PlexSSO] User has library access: plexUsername=${plexUser.username}`);
        } else {
            logger.info(`[PlexSSO] User is Plex admin, skipping library access check: plexUsername=${plexUser.username}`);
        }

        // Find or create Framerr user for this Plex user
        let user;
        let needsPasswordSetup = false;

        // Check if user already has a linked Plex account
        const linkedUserId = findUserByExternalId('plex', plexUser.id.toString());

        if (linkedUserId) {
            // Existing linked user - use that account
            user = await getUserById(linkedUserId);
            logger.debug(`[PlexSSO] Found existing linked account: plexUsername=${plexUser.username} framerUser=${user?.username}`);

            // Check if user needs to set up a local password (migration)
            if (user && !hasLocalPassword(user.id)) {
                needsPasswordSetup = true;
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
                    metadata: { thumb: plexUser.thumb, linkedVia: 'sso-admin' }
                });
                logger.info(`[PlexSSO] Linked Plex admin to Framerr user: plexUsername=${plexUser.username} framerUser=${user.username}`);
            }
        } else {
            // No linked user found - redirect to account setup page
            // Do NOT auto-link by username match (security) or auto-create (requires local password)
            logger.info(`[PlexSSO] No linked account found, redirecting to setup: plexUsername=${plexUser.username}`);

            // Generate setup token for the frontend to use
            const setupToken = createPlexSetupToken({
                plexId: plexUser.id.toString(),
                plexUsername: plexUser.username,
                plexEmail: plexUser.email,
                plexThumb: plexUser.thumb
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
            secure: false,
            sameSite: 'lax',
            maxAge: expiresIn
        });

        logger.info(`[PlexSSO] User logged in: ${user.username}`);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName || user.username,
                group: user.group,
                preferences: user.preferences
            },
            needsPasswordSetup  // Tell frontend to redirect to password setup if true
        });

    } catch (error) {
        logger.error(`[PlexSSO] Login error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Plex login failed' });
    }
});

export default router;
