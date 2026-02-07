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
import logger from '../utils/logger';
import axios from 'axios';

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

        const overseerrUrl = instance.config.url as string;
        const baseUrl = overseerrUrl.replace(/\/$/, '');

        // Authenticate against Overseerr's local auth endpoint
        try {
            const authResponse = await axios.post<OverseerrAuthResponse>(
                `${baseUrl}/api/v1/auth/local`,
                { email: username, password },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            const overseerrUser = authResponse.data;

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
            const err = authError as { response?: { status: number; data?: { message?: string } } };

            if (err.response?.status === 401 || err.response?.status === 403) {
                res.status(401).json({ error: 'Invalid username or password' });
                return;
            }

            logger.error(`[LinkedAccounts] Overseerr auth error: error="${(authError as Error).message}" status=${err.response?.status}`);
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
