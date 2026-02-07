/**
 * Plex Setup Routes
 * Handles account creation/linking flow for new Plex SSO users
 */
import { Router, Request, Response } from 'express';
import {
    validatePlexSetupToken,
    markTokenUsed,
    PlexSetupToken
} from '../db/plexSetupTokens';
import {
    getUser,
    createUser,
    setHasLocalPassword
} from '../db/users';
import { linkAccount, findUserByExternalId } from '../db/linkedAccounts';
import { hashPassword, verifyPassword } from '../auth/password';
import { createUserSession } from '../auth/session';
import logger from '../utils/logger';

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
    password: string;
    confirmPassword: string;
}

/**
 * POST /api/auth/plex-setup/validate
 * Validate setup token and return Plex user info
 * No auth required - token provides authorization
 */
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body as ValidateTokenBody;

        if (!token) {
            res.status(400).json({ error: 'Token is required' });
            return;
        }

        const tokenData = validatePlexSetupToken(token);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }

        logger.debug(`[PlexSetup] Token validated: plexUsername="${tokenData.plexUsername}"`);

        res.json({
            valid: true,
            plexUser: {
                username: tokenData.plexUsername,
                email: tokenData.plexEmail,
                thumb: tokenData.plexThumb
            }
        });
    } catch (error) {
        logger.error(`[PlexSetup] Validate token error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to validate token' });
    }
});

/**
 * POST /api/auth/plex-setup/link-existing
 * Link Plex account to existing Framerr account
 * Verifies local credentials, links Plex, returns session
 */
router.post('/link-existing', async (req: Request, res: Response): Promise<void> => {
    try {
        const { setupToken, username, password } = req.body as LinkExistingBody;

        // Validate inputs
        if (!setupToken || !username || !password) {
            res.status(400).json({ error: 'Setup token, username, and password are required' });
            return;
        }

        // Validate setup token
        const tokenData = validatePlexSetupToken(setupToken);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired setup token' });
            return;
        }

        // Check if Plex account is already linked to another user
        const existingLink = findUserByExternalId('plex', tokenData.plexId);
        if (existingLink) {
            res.status(409).json({ error: 'This Plex account is already connected to another user' });
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

        // Link Plex account to user
        linkAccount(user.id, 'plex', {
            externalId: tokenData.plexId,
            externalUsername: tokenData.plexUsername,
            externalEmail: tokenData.plexEmail || undefined,
            metadata: {
                thumb: tokenData.plexThumb,
                linkedVia: 'sso-link-existing'
            }
        });

        // Mark token as used
        markTokenUsed(setupToken);

        // Create session
        const session = await createUserSession(user, req, 86400000);

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400000
        });

        logger.info(`[PlexSetup] Linked to existing: user=${user.id} username="${user.username}" plex="${tokenData.plexUsername}"`);

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
        logger.error(`[PlexSetup] Link existing error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to link account' });
    }
});

/**
 * POST /api/auth/plex-setup/create-account
 * Create new Framerr account with Plex link
 * Creates account, links Plex, returns session
 */
router.post('/create-account', async (req: Request, res: Response): Promise<void> => {
    try {
        const { setupToken, username, password, confirmPassword } = req.body as CreateAccountBody;

        // Validate inputs
        if (!setupToken || !username || !password || !confirmPassword) {
            res.status(400).json({ error: 'All fields are required' });
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

        if (username.length < 3) {
            res.status(400).json({ error: 'Username must be at least 3 characters' });
            return;
        }

        // Validate setup token
        const tokenData = validatePlexSetupToken(setupToken);
        if (!tokenData) {
            res.status(401).json({ error: 'Invalid or expired setup token' });
            return;
        }

        // Check if Plex account is already linked
        const existingLink = findUserByExternalId('plex', tokenData.plexId);
        if (existingLink) {
            res.status(409).json({ error: 'This Plex account is already connected to another user' });
            return;
        }

        // Check if username already exists
        const existingUser = await getUser(username);
        if (existingUser) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        // Hash password and create user
        const passwordHash = await hashPassword(password);
        const user = await createUser({
            username,
            passwordHash,
            email: tokenData.plexEmail || undefined,
            group: 'user',
            hasLocalPassword: true  // User set their own password
        });

        // Link Plex account to user
        linkAccount(user.id, 'plex', {
            externalId: tokenData.plexId,
            externalUsername: tokenData.plexUsername,
            externalEmail: tokenData.plexEmail || undefined,
            metadata: {
                thumb: tokenData.plexThumb,
                linkedVia: 'sso-create-account'
            }
        });

        // Mark token as used
        markTokenUsed(setupToken);

        // Create session using the full user object with required fields
        const fullUser = await getUser(username);
        if (!fullUser) {
            throw new Error('Failed to retrieve created user');
        }

        const session = await createUserSession(fullUser, req, 86400000);

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400000
        });

        logger.info(`[PlexSetup] Created new account: user=${user.id} username="${user.username}" plex="${tokenData.plexUsername}"`);

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
        logger.error(`[PlexSetup] Create account error: error="${err.message}"`);

        if (err.message === 'User already exists') {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        res.status(500).json({ error: 'Failed to create account' });
    }
});

export default router;
