/**
 * Emby Authentication Route
 * 
 * Authenticates with an Emby server using username/password.
 * Returns an access token + userId for integration setup.
 * 
 * Endpoint:
 * - POST /authenticate - Authenticate with Emby credentials (admin only)
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth, requireAdmin } from '../../../middleware/auth';
import { translateHostUrl } from '../../../utils/urlHelper';
import { httpsAgent } from '../../../utils/httpsAgent';
import logger from '../../../utils/logger';

const router = Router();

interface AuthenticateByNameResponse {
    AccessToken: string;
    User: {
        Id: string;
        Name: string;
        Policy: {
            IsAdministrator: boolean;
        };
    };
}

/**
 * POST /emby/authenticate
 * 
 * Authenticate with an Emby server using username + password.
 * Returns the access token and userId for integration config.
 * Requires Framerr admin to call (only admins set up integrations).
 */
router.post('/emby/authenticate', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const { url, username, password } = req.body as {
        url?: string;
        username?: string;
        password?: string;
    };

    if (!url || !username) {
        res.status(400).json({ success: false, error: 'Server URL and username are required' });
        return;
    }

    try {
        const baseUrl = translateHostUrl(url).replace(/\/$/, '');
        const authHeader = 'MediaBrowser Client="Framerr", Device="Server", DeviceId="framerr-setup", Version="0.1.6"';

        logger.info(`[Emby Auth] Authenticating: url="${baseUrl}" username="${username}"`);

        const response = await axios.post<AuthenticateByNameResponse>(
            `${baseUrl}/Users/AuthenticateByName`,
            { Username: username, Pw: password || '' },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                httpsAgent,
                timeout: 15000,
            }
        );

        const { AccessToken, User } = response.data;

        // Verify the user is an administrator
        if (!User.Policy.IsAdministrator) {
            logger.warn(`[Emby Auth] Non-admin login attempt: username="${username}"`);
            res.status(403).json({
                success: false,
                error: 'Admin account required. Please use an Emby administrator account.',
            });
            return;
        }

        logger.info(`[Emby Auth] Success: username="${User.Name}" userId="${User.Id}" isAdmin=true`);

        res.json({
            success: true,
            accessToken: AccessToken,
            userId: User.Id,
            username: User.Name,
        });
    } catch (error) {
        const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
        const status = axiosError.response?.status;

        if (status === 401) {
            logger.warn(`[Emby Auth] Invalid credentials: username="${username}"`);
            res.status(401).json({ success: false, error: 'Invalid username or password' });
        } else {
            logger.error(`[Emby Auth] Failed: status=${status} error="${axiosError.message}"`);
            res.status(500).json({
                success: false,
                error: `Failed to connect to Emby server: ${axiosError.message}`,
            });
        }
    }
});

export default router;
