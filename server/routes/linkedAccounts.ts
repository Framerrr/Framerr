/**
 * Linked Accounts Routes
 * API endpoints for user linked account management
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
    getLinkedAccountsForUser,
    linkAccount,
    unlinkAccount,
    findUserByExternalId
} from '../db/linkedAccounts';
import { setHasLocalPassword } from '../db/users';
import { hashPassword } from '../auth/password';
import { getSystemConfig } from '../db/systemConfig';
import { checkPlexLibraryAccess } from '../utils/plexLibraryAccess';
import logger from '../utils/logger';
import axios from 'axios'; // Kept for plex.tv external API call (Tier 2)
import { OverseerrAdapter } from '../integrations/overseerr/adapter';
import { AdapterError } from '../integrations/errors';
import { toPluginInstance } from '../integrations/utils';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface LinkedAccountInfo {
    linked: boolean;
    externalId: string;
    externalUsername: string | null;
    externalEmail: string | null;
    linkedAt: number;
    metadata: Record<string, unknown>;
}

interface PlexLinkBody {
    plexToken: string;
}

interface SetupPasswordBody {
    password: string;
    confirmPassword: string;
}

interface PlexUserResponse {
    id: number;
    username: string;
    email?: string;
    thumb?: string;
}

/**
 * GET /api/linked-accounts/me
 * Get current user's linked accounts (from database - SSO links, etc.)
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        // Get all linked accounts from database (includes Plex SSO links)
        const dbLinkedAccounts = getLinkedAccountsForUser(userId);

        // Convert to object keyed by service for easier frontend use
        const accountsByService: Record<string, LinkedAccountInfo> = {};
        for (const account of dbLinkedAccounts) {
            accountsByService[account.service] = {
                linked: true,
                externalId: account.externalId,
                externalUsername: account.externalUsername,
                externalEmail: account.externalEmail,
                linkedAt: account.linkedAt,
                metadata: account.metadata || {}
            };
        }

        logger.debug(`[LinkedAccounts] Fetched: user=${userId} services=[${Object.keys(accountsByService).join(',')}]`);

        res.json({
            accounts: accountsByService
        });
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to fetch: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch linked accounts' });
    }
});

/**
 * POST /api/linked-accounts/plex
 * Link Plex account to current user (manual linking via PIN token)
 */
router.post('/plex', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { plexToken } = req.body as PlexLinkBody;

        if (!plexToken) {
            res.status(400).json({ error: 'Plex token is required' });
            return;
        }

        // Get Plex user info from token
        const userResponse = await axios.get<PlexUserResponse>('https://plex.tv/api/v2/user', {
            headers: {
                'Accept': 'application/json',
                'X-Plex-Token': plexToken,
                'X-Plex-Client-Identifier': 'framerr-dashboard'
            }
        });

        const plexUser = userResponse.data;

        // Check if this is a managed/Home user (they don't have a real Plex ID)
        if (!plexUser.id) {
            res.status(400).json({
                error: 'Unable to connect. Managed Plex accounts (Plex Home) cannot be connected. Only users with their own Plex.tv account can use this feature.'
            });
            return;
        }

        // Verify library access on admin's Plex server (security fix - matches SSO flow)
        const systemConfig = await getSystemConfig();
        const ssoConfig = systemConfig.plexSSO;
        if (ssoConfig?.machineId && ssoConfig?.adminToken) {
            try {
                const { hasAccess } = await checkPlexLibraryAccess(
                    plexUser.id.toString(),
                    {
                        adminToken: ssoConfig.adminToken as string,
                        machineId: ssoConfig.machineId as string,
                        clientIdentifier: (ssoConfig.clientIdentifier as string) || 'framerr-dashboard',
                        adminPlexId: ssoConfig.adminPlexId as string,
                    }
                );
                if (!hasAccess) {
                    res.status(403).json({
                        error: 'This Plex account does not have access to the server library. Only users with library access can link their account.'
                    });
                    return;
                }
            } catch (accessError) {
                logger.error(`[LinkedAccounts] Failed to verify library access: error="${(accessError as Error).message}"`);
                res.status(500).json({ error: 'Failed to verify library access' });
                return;
            }
        }

        // Check if this Plex account is already linked to another user
        const existingLink = findUserByExternalId('plex', plexUser.id.toString());
        if (existingLink && existingLink !== userId) {
            res.status(409).json({ error: 'This Plex account is already connected to another user' });
            return;
        }

        // Link the account
        linkAccount(userId, 'plex', {
            externalId: plexUser.id.toString(),
            externalUsername: plexUser.username,
            externalEmail: plexUser.email,
            metadata: {
                thumb: plexUser.thumb,
                linkedVia: 'manual'
            }
        });

        logger.info(`[LinkedAccounts] Plex linked: user=${userId} plexUser="${plexUser.username}"`);

        // Fire-and-forget: try to auto-match/refresh Overseerr account
        import('../services/overseerrAutoMatch').then(m => m.tryAutoMatchSingleUser(userId)).catch(() => { });

        res.json({
            success: true,
            link: {
                service: 'plex',
                externalUsername: plexUser.username,
                externalEmail: plexUser.email
            }
        });
    } catch (error) {
        const err = error as { response?: { status: number } };
        logger.error(`[LinkedAccounts] Failed to link Plex: error="${(error as Error).message}"`);

        if (err.response?.status === 401) {
            res.status(401).json({ error: 'Invalid Plex token' });
            return;
        }

        res.status(500).json({ error: 'Failed to link Plex account' });
    }
});

/**
 * DELETE /api/linked-accounts/plex
 * Unlink Plex account from current user
 */
router.delete('/plex', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        const success = unlinkAccount(userId, 'plex');

        if (success) {
            logger.info(`[LinkedAccounts] Plex unlinked: user=${userId}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'No Plex account linked' });
        }
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to unlink Plex: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to unlink Plex account' });
    }
});

/**
 * POST /api/linked-accounts/setup-password
 * Set up local password for users who don't have one (migration)
 */
router.post('/setup-password', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { password, confirmPassword } = req.body as SetupPasswordBody;

        if (!password || !confirmPassword) {
            res.status(400).json({ error: 'Password and confirmation are required' });
            return;
        }

        if (password !== confirmPassword) {
            res.status(400).json({ error: 'Passwords do not match' });
            return;
        }

        if (password.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters' });
            return;
        }

        // Hash and update password
        const passwordHash = await hashPassword(password);

        // Import getDb to update password directly
        const { getDb } = await import('../database/db');
        getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, userId);

        // Mark that user now has a local password
        setHasLocalPassword(userId, true);

        logger.info(`[LinkedAccounts] Password setup complete: user=${userId}`);

        res.json({ success: true });
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to setup password: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to set up password' });
    }
});

// =============================================================================
// OVERSEERR LINKING
// =============================================================================

interface OverseerrLinkBody {
    username: string;
    password: string;
}

interface OverseerrAuthResponse {
    id: number;
    email: string;
    plexUsername?: string;
    username?: string;
    displayName?: string;
}

/**
 * POST /api/linked-accounts/overseerr
 * Link Overseerr account to current user by verifying credentials
 * Credentials are NOT stored - only used for verification
 */
router.post('/overseerr', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;
        const { username, password } = req.body as OverseerrLinkBody;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Get Overseerr config from integration_instances
        const { getFirstEnabledByType } = await import('../db/integrationInstances');
        const instance = getFirstEnabledByType('overseerr');

        if (!instance || !instance.enabled) {
            res.status(400).json({ error: 'Overseerr is not configured' });
            return;
        }

        // Authenticate against Overseerr's local auth endpoint
        try {
            const adapter = new OverseerrAdapter();
            const pluginInstance = toPluginInstance(instance);
            const authResponse = await adapter.post(pluginInstance, '/api/v1/auth/local',
                { email: username, password },
                { timeout: 10000 }
            );

            const overseerrUser = authResponse.data as OverseerrAuthResponse;

            // Check if this Overseerr account is already linked to another user
            const existingLink = findUserByExternalId('overseerr', overseerrUser.id.toString());
            if (existingLink && existingLink !== userId) {
                res.status(409).json({ error: 'This Overseerr account is already connected to another user' });
                return;
            }

            // Determine the display username (prefer displayName, then username, then email)
            const displayUsername = overseerrUser.displayName || overseerrUser.username || overseerrUser.email;

            // Link the account
            linkAccount(userId, 'overseerr', {
                externalId: overseerrUser.id.toString(),
                externalUsername: displayUsername,
                externalEmail: overseerrUser.email,
                metadata: {
                    plexUsername: overseerrUser.plexUsername,
                    linkedVia: 'credentials'
                }
            });

            logger.info(`[LinkedAccounts] Overseerr linked: user=${userId} overseerrUser="${displayUsername}"`);

            res.json({
                success: true,
                link: {
                    service: 'overseerr',
                    externalUsername: displayUsername,
                    externalEmail: overseerrUser.email
                }
            });
        } catch (authError) {
            if (authError instanceof AdapterError && authError.code === 'AUTH_FAILED') {
                res.status(401).json({ error: 'Invalid username or password' });
                return;
            }

            logger.error(`[LinkedAccounts] Overseerr auth error: error="${(authError as Error).message}"`);
            res.status(500).json({ error: 'Failed to verify Overseerr credentials' });
        }
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to link Overseerr: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to link Overseerr account' });
    }
});

/**
 * DELETE /api/linked-accounts/overseerr
 * Unlink Overseerr account from current user
 */
router.delete('/overseerr', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user!.id;

        const success = unlinkAccount(userId, 'overseerr');

        if (success) {
            logger.info(`[LinkedAccounts] Overseerr unlinked: user=${userId}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'No Overseerr account linked' });
        }
    } catch (error) {
        logger.error(`[LinkedAccounts] Failed to unlink Overseerr: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to unlink Overseerr account' });
    }
});

export default router;
