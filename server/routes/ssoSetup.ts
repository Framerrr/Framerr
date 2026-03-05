/**
 * SSO Setup Routes
 * Handles account creation/linking flow for new SSO users (Plex, OIDC, etc.)
 */
import { Router, Request, Response } from 'express';
import {
    validateSSOSetupToken,
    consumeSSOSetupToken,
} from '../db/ssoSetupTokens';
import {
    getUser,
    createUser,
    setHasLocalPassword
} from '../db/users';
import { linkAccount, findUserByExternalId } from '../db/linkedAccounts';
import { verifyPassword } from '../auth/password';
import { createUserSession } from '../auth/session';
import logger from '../utils/logger';
import { importSsoProfilePicture } from '../utils/importSsoProfilePicture';

const router = Router();

interface ValidateTokenBody {
    token: string;
}

interface LinkExistingBody {
    setupToken: string;
    username: string;
    password: string;
}

interface CreateAccountBody {
    setupToken: string;
    username: string;
}

/**
 * POST /api/auth/sso-setup/validate
 * Validate setup token and return SSO user info
 * No auth required - token provides authorization
 */
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body as ValidateTokenBody;

        if (!token) {
            res.status(400).json({ error: 'Token is required' });
            return;
        }

        const tokenData = validateSSOSetupToken(token);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }

        logger.debug(`[SSOSetup] Token validated: provider="${tokenData.provider}" username="${tokenData.externalUsername}"`);

        res.json({
            valid: true,
            provider: tokenData.provider,
            ssoUser: {
                username: tokenData.externalUsername,
                email: tokenData.externalEmail,
                avatar: tokenData.externalAvatar
            }
        });
    } catch (error) {
        logger.error(`[SSOSetup] Validate token error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to validate token' });
    }
});

/**
 * POST /api/auth/sso-setup/link-existing
 * Link SSO account to existing Framerr account
 * Verifies local credentials, links SSO, returns session
 */
router.post('/link-existing', async (req: Request, res: Response): Promise<void> => {
    try {
        const { setupToken, username, password } = req.body as LinkExistingBody;

        // Validate inputs
        if (!setupToken || !username || !password) {
            res.status(400).json({ error: 'Setup token, username, and password are required' });
            return;
        }

        // Atomically consume setup token (validate + mark used in one step)
        const tokenData = consumeSSOSetupToken(setupToken);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired setup token' });
            return;
        }

        // Check if SSO account is already linked to another user
        const existingLink = findUserByExternalId(tokenData.provider, tokenData.externalId);
        if (existingLink) {
            res.status(409).json({ error: 'This account is already connected to another user' });
            return;
        }

        // Find the local user
        const user = await getUser(username);
        if (!user) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        // Verify password
        const isValid = await verifyPassword(password, user.passwordHash || '');
        if (!isValid) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        // Link SSO account to user
        linkAccount(user.id, tokenData.provider, {
            externalId: tokenData.externalId,
            externalUsername: tokenData.externalUsername,
            externalEmail: tokenData.externalEmail || undefined,
            metadata: {
                avatar: tokenData.externalAvatar,
                linkedVia: 'sso-link-existing'
            }
        });

        // Fire-and-forget: try to auto-match Overseerr account if Plex
        if (tokenData.provider === 'plex') {
            import('../services/overseerrAutoMatch').then(m => m.tryAutoMatchSingleUser(user.id)).catch(() => { });
        }

        // Import SSO profile picture if available (awaited — ready before app loads)
        if (tokenData.externalAvatar) {
            await importSsoProfilePicture(user.id, tokenData.externalAvatar);
        }

        // Token already consumed atomically above

        // Create session
        const session = await createUserSession(user, req, 86400000);

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: 86400000
        });

        logger.info(`[SSOSetup] Linked to existing: user=${user.id} username="${user.username}" provider="${tokenData.provider}" external="${tokenData.externalUsername}"`);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName || user.username,
                group: user.group
            }
        });
    } catch (error) {
        logger.error(`[SSOSetup] Link existing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to link account' });
    }
});

/**
 * POST /api/auth/sso-setup/create-account
 * Create new Framerr account with SSO link (username only, no password)
 * Creates SSO-only account, links SSO, returns session
 */
router.post('/create-account', async (req: Request, res: Response): Promise<void> => {
    try {
        const { setupToken, username } = req.body as CreateAccountBody;

        // Validate inputs — username only, no password
        if (!setupToken || !username) {
            res.status(400).json({ error: 'Setup token and username are required' });
            return;
        }

        if (username.length < 3) {
            res.status(400).json({ error: 'Username must be at least 3 characters' });
            return;
        }

        // Atomically consume setup token (validate + mark used in one step)
        const tokenData = consumeSSOSetupToken(setupToken);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired setup token' });
            return;
        }

        // Check if SSO account is already linked
        const existingLink = findUserByExternalId(tokenData.provider, tokenData.externalId);
        if (existingLink) {
            res.status(409).json({ error: 'This account is already connected to another user' });
            return;
        }

        // Check if username already exists
        const existingUser = await getUser(username);
        if (existingUser) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        // Create SSO-only account — no password
        const user = await createUser({
            username,
            passwordHash: '',
            email: tokenData.externalEmail || undefined,
            group: 'user',
            hasLocalPassword: false
        });

        // Link SSO account to user
        linkAccount(user.id, tokenData.provider, {
            externalId: tokenData.externalId,
            externalUsername: tokenData.externalUsername,
            externalEmail: tokenData.externalEmail || undefined,
            metadata: {
                avatar: tokenData.externalAvatar,
                linkedVia: 'sso-create-account'
            }
        });

        // Fire-and-forget: try to auto-match Overseerr account if Plex
        if (tokenData.provider === 'plex') {
            import('../services/overseerrAutoMatch').then(m => m.tryAutoMatchSingleUser(user.id)).catch(() => { });
        }

        // Import SSO profile picture if available (awaited — ready before app loads)
        if (tokenData.externalAvatar) {
            await importSsoProfilePicture(user.id, tokenData.externalAvatar);
        }

        // Token already consumed atomically above

        // Create session using the full user object with required fields
        const fullUser = await getUser(username);
        if (!fullUser) {
            throw new Error('Failed to retrieve created user');
        }

        const session = await createUserSession(fullUser, req, 86400000);

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'lax',
            maxAge: 86400000
        });

        logger.info(`[SSOSetup] Created new account: user=${user.id} username="${user.username}" provider="${tokenData.provider}" external="${tokenData.externalUsername}"`);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName || user.username,
                group: user.group
            }
        });
    } catch (error) {
        const err = error as Error;
        logger.error(`[SSOSetup] Create account error: error="${err.message}"`);

        if (err.message === 'User already exists') {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        res.status(500).json({ error: 'Failed to create account' });
    }
});

export default router;
