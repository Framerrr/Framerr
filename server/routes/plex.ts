/**
 * Plex OAuth Routes
 * Handles Plex PIN-based OAuth authentication flow
 * 
 * Used for:
 * 1. Plex SSO (user login via Plex)
 * 2. Plex Integration setup (getting token for widget)
 */
import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';
import { linkAccount } from '../db/linkedAccounts';
import xml2js from 'xml2js';

// ============================================================================
// Integration Configuration Check
// ============================================================================

/**
 * Check if Plex is properly configured
 * Used by the integration status system to show ✓ or ! in widget gallery
 * 
 * Requirements: URL and token must both be present
 */
export function isConfigured(config: { url?: string; token?: string }): boolean {
    return !!(config.url && config.token);
}

const router = Router();

// Plex API base URLs
const PLEX_TV_API = 'https://plex.tv/api/v2';

// Module-level cache for client identifier (prevents regeneration race condition)
let cachedClientIdentifier: string | null = null;

// Types
interface PlexHeaders {
    [key: string]: string | undefined;
    'Accept': string;
    'Content-Type': string;
    'X-Plex-Product': string;
    'X-Plex-Version': string;
    'X-Plex-Client-Identifier': string;
    'X-Plex-Token'?: string;
}

interface PinBody {
    forwardUrl?: string;
}

interface PinResponse {
    id: number;
    code: string;
    expiresAt: string;
    authToken?: string;
}

interface PlexUser {
    id: number;
    uuid: string;
    username: string;
    email?: string;
    thumb?: string;
}

interface PlexDevice {
    name: string;
    clientIdentifier: string;
    provides?: string;
    owned: boolean;
    connections?: Array<{
        uri: string;
        local: boolean;
        relay: boolean;
    }>;
}

interface PlexMediaContainer {
    friendlyName?: string;
}

interface ParsedXMLUser {
    id?: string;
    username?: string;
    title?: string;
    email?: string;
    thumb?: string;
}

interface ParsedXMLContainer {
    MediaContainer?: {
        User?: ParsedXMLUser | ParsedXMLUser[];
    };
}

interface SSOConfigBody {
    enabled?: boolean;
    adminToken?: string;
    adminEmail?: string;
    adminPlexId?: string;
    machineId?: string;
    autoCreateUsers?: boolean;
    defaultGroup?: string;
    linkedUserId?: string;
}

interface VerifyUserBody {
    plexUserId: string;
    plexToken?: string;
}

// Standard headers for Plex API requests
const getPlexHeaders = (clientId: string, token: string | null = null): PlexHeaders => {
    const headers: PlexHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Plex-Product': 'Framerr',
        'X-Plex-Version': '1.0',
        'X-Plex-Client-Identifier': clientId
    };
    if (token) {
        headers['X-Plex-Token'] = token;
    }
    return headers;
};

/**
 * Get or create a persistent client identifier for this Framerr instance
 * Uses module-level cache to prevent race conditions with DB cache invalidation
 */
async function getClientIdentifier(): Promise<string> {
    // Return cached value if we have it
    if (cachedClientIdentifier) {
        return cachedClientIdentifier;
    }

    const config = await getSystemConfig();

    // Check if we already have a client ID stored in DB
    if (config.plexSSO?.clientIdentifier) {
        cachedClientIdentifier = config.plexSSO.clientIdentifier as string;
        logger.debug('[Plex] Using existing client identifier from DB');
        return cachedClientIdentifier;
    }

    // Generate a new one and store it
    const clientId = `framerr-${uuidv4()}`;

    // Save to DB
    await updateSystemConfig({
        plexSSO: {
            ...(config.plexSSO || {}),
            clientIdentifier: clientId
        }
    });

    // Cache it in memory
    cachedClientIdentifier = clientId;

    logger.info(`[Plex] Generated new client identifier: id=${clientId}`);
    return clientId;
}


/**
 * POST /api/plex/auth/pin
 * Generate a Plex PIN for OAuth
 * Returns: { pinId, code, authUrl }
 */
router.post('/auth/pin', async (req: Request, res: Response): Promise<void> => {
    try {
        const clientId = await getClientIdentifier();
        const { forwardUrl } = req.body as PinBody;

        logger.info(`[Plex] Generating PIN: clientId=${clientId}`);

        // Generate PIN from Plex
        const pinResponse = await axios.post<PinResponse>(
            `${PLEX_TV_API}/pins`,
            { strong: true },
            { headers: getPlexHeaders(clientId) }
        );

        const { id: pinId, code } = pinResponse.data;

        logger.info(`[Plex] PIN generated: pinId=${pinId} code=${code?.substring(0, 4)}...`);

        // Construct the Plex auth URL
        const authParams = new URLSearchParams({
            clientID: clientId,
            code: code,
            'context[device][product]': 'Framerr'
        });

        if (forwardUrl) {
            authParams.append('forwardUrl', forwardUrl);
        }

        const authUrl = `https://app.plex.tv/auth#?${authParams.toString()}`;

        res.json({
            pinId,
            code,
            authUrl,
            expiresIn: 1800 // 30 minutes
        });
    } catch (error) {
        logger.error(`[Plex] Failed to generate PIN: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to generate Plex PIN' });
    }
});


/**
 * GET /api/plex/auth/token
 * Check PIN status and get token if claimed
 * Query: ?pinId=123
 * Returns: { pending: true } or { authToken, user }
 */
router.get('/auth/token', async (req: Request, res: Response): Promise<void> => {
    try {
        const { pinId } = req.query;

        if (!pinId) {
            res.status(400).json({ error: 'pinId is required' });
            return;
        }

        const clientId = await getClientIdentifier();

        logger.debug(`[Plex] Checking PIN: pinId=${pinId}`);

        // Check PIN status from Plex
        const pinResponse = await axios.get<PinResponse>(
            `${PLEX_TV_API}/pins/${pinId}`,
            { headers: getPlexHeaders(clientId) }
        );

        logger.debug(`[Plex] PIN response: hasToken=${!!pinResponse.data.authToken}`);

        const { authToken } = pinResponse.data;

        if (!authToken) {
            // PIN exists but user hasn't authenticated yet
            res.json({ pending: true });
            return;
        }

        // PIN was claimed, get user info
        const userResponse = await axios.get<PlexUser>(
            `${PLEX_TV_API}/user`,
            { headers: getPlexHeaders(clientId, authToken) }
        );

        const user = {
            id: userResponse.data.id,
            uuid: userResponse.data.uuid,
            username: userResponse.data.username,
            email: userResponse.data.email,
            thumb: userResponse.data.thumb
        };

        logger.info(`[Plex] Token obtained: user="${user.username}"`);

        // If user is authenticated (logged in), link their Plex account
        // This enables "My Linked Accounts" functionality when setting up Plex from Service Settings
        if (req.user && req.user.id) {
            try {
                linkAccount(req.user.id, 'plex', {
                    externalId: user.id.toString(),
                    externalUsername: user.username,
                    externalEmail: user.email,
                    metadata: { thumb: user.thumb }
                });
                logger.info(`[Plex] Linked account: user=${req.user.id} plexUser="${user.username}"`);
            } catch (linkError) {
                // Don't fail the request if linking fails - token is still valid
                logger.warn(`[Plex] Failed to link account (non-fatal): error="${(linkError as Error).message}"`);
            }
        }

        res.json({
            authToken,
            user
        });
    } catch (error) {
        const axiosErr = error as AxiosError;
        logger.error(`[Plex] Failed to check PIN: error="${axiosErr.message}" status=${axiosErr.response?.status}`);

        if (axiosErr.response?.status === 404) {
            res.status(404).json({ error: 'PIN expired or invalid' });
            return;
        }

        res.status(500).json({ error: 'Failed to check Plex PIN' });
    }
});


/**
 * GET /api/plex/resources
 * Get user's Plex servers (machines)
 * Query: ?token=xxx
 * Returns: [{ name, machineId, connections }]
 */
router.get('/resources', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.query;

        if (!token) {
            res.status(400).json({ error: 'token is required' });
            return;
        }

        const clientId = await getClientIdentifier();

        const response = await axios.get<PlexDevice[]>(
            `${PLEX_TV_API}/resources`,
            {
                headers: getPlexHeaders(clientId, token as string),
                params: { includeHttps: 1, includeRelay: 1 }
            }
        );

        // Filter to only server devices
        const servers = response.data
            .filter(device => device.provides?.includes('server'))
            .map(device => ({
                name: device.name,
                machineId: device.clientIdentifier,
                owned: device.owned,
                connections: device.connections?.map(conn => ({
                    uri: conn.uri,
                    local: conn.local,
                    relay: conn.relay
                })) || []
            }));

        logger.debug(`[Plex] Found servers: count=${servers.length}`);

        res.json(servers);
    } catch (error) {
        logger.error(`[Plex] Failed to get resources: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get Plex servers' });
    }
});

/**
 * GET /api/plex/admin-resources
 * Get admin's Plex servers using stored token (for UI refresh)
 * Requires admin authentication
 */
router.get('/admin-resources', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const config = await getSystemConfig();
        const ssoConfig = config.plexSSO;

        if (!ssoConfig?.adminToken) {
            res.status(400).json({ error: 'No Plex token configured' });
            return;
        }

        const clientId = await getClientIdentifier();

        const response = await axios.get<PlexDevice[]>(
            `${PLEX_TV_API}/resources`,
            {
                headers: getPlexHeaders(clientId, ssoConfig.adminToken as string),
                params: { includeHttps: 1, includeRelay: 1 }
            }
        );

        // Filter to only server devices
        const servers = response.data
            .filter(device => device.provides?.includes('server'))
            .map(device => ({
                name: device.name,
                machineId: device.clientIdentifier,
                owned: device.owned,
                connections: device.connections?.map(conn => ({
                    uri: conn.uri,
                    local: conn.local,
                    relay: conn.relay
                })) || []
            }));

        logger.debug(`[Plex] Found admin servers: count=${servers.length}`);

        res.json(servers);
    } catch (error) {
        logger.error(`[Plex] Failed to get admin resources: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get Plex servers' });
    }
});

/**
 * GET /api/plex/users
 * Get users with library access on this Plex server
 * Query: ?token=xxx
 * Returns: [{ id, username, email, thumb }]
 */
router.get('/users', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.query;

        if (!token) {
            res.status(400).json({ error: 'token is required' });
            return;
        }

        // Get users with library access from Plex.tv
        // Note: This endpoint returns XML, not JSON
        const response = await axios.get<string>('https://plex.tv/api/users', {
            headers: {
                'X-Plex-Token': token as string
            }
        });

        // Parse XML response
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const parsed = await parser.parseStringPromise(response.data) as ParsedXMLContainer;

        // Extract users from MediaContainer.User
        const rawUsers = parsed?.MediaContainer?.User;
        const usersList = rawUsers ? (Array.isArray(rawUsers) ? rawUsers : [rawUsers]) : [];

        const users = usersList.map(user => ({
            id: user.id,
            username: user.username || user.title,
            email: user.email,
            thumb: user.thumb
        }));

        logger.debug(`[Plex] Found shared users: count=${users.length}`);

        res.json(users);
    } catch (error) {
        logger.error(`[Plex] Failed to get users: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get Plex users' });
    }
});

/**
 * POST /api/plex/verify-user
 * Verify a Plex user has library access on the admin's server
 * Body: { plexUserId }
 * Returns: { valid: boolean, user }
 */
router.post('/verify-user', async (req: Request, res: Response): Promise<void> => {
    try {
        const { plexUserId, plexToken } = req.body as VerifyUserBody;

        if (!plexUserId) {
            res.status(400).json({ error: 'plexUserId is required' });
            return;
        }

        // Get SSO config with admin token
        const config = await getSystemConfig();
        const ssoConfig = config.plexSSO;

        if (!ssoConfig?.enabled || !ssoConfig?.adminToken) {
            res.status(400).json({ error: 'Plex SSO not configured' });
            return;
        }

        const clientId = await getClientIdentifier();

        // Check if the Plex user is the admin themselves
        const isAdmin = plexUserId.toString() === ssoConfig.adminPlexId?.toString();

        let hasLibraryAccess = false;

        if (!isAdmin) {
            // Get users with library access from Plex.tv (XML response)
            const usersResponse = await axios.get<string>('https://plex.tv/api/users', {
                headers: {
                    'X-Plex-Token': ssoConfig.adminToken as string
                }
            });

            // Parse XML response
            const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
            const parsed = await parser.parseStringPromise(usersResponse.data) as ParsedXMLContainer;

            const rawUsers = parsed?.MediaContainer?.User;
            const usersList = rawUsers ? (Array.isArray(rawUsers) ? rawUsers : [rawUsers]) : [];

            hasLibraryAccess = usersList.some(
                sharedUser => sharedUser?.id?.toString() === plexUserId.toString()
            );
        }

        if (!isAdmin && !hasLibraryAccess) {
            logger.warn(`[Plex] User does not have library access: plexUserId=${plexUserId}`);
            res.json({ valid: false, reason: 'User does not have access to this Plex server' });
            return;
        }

        // Get user details if we have their token
        let user = null;
        if (plexToken) {
            const userResponse = await axios.get<PlexUser>(
                `${PLEX_TV_API}/user`,
                { headers: getPlexHeaders(clientId, plexToken) }
            );
            user = {
                id: userResponse.data.id,
                username: userResponse.data.username,
                email: userResponse.data.email,
                thumb: userResponse.data.thumb
            };
        }

        logger.info(`[Plex] User verified: plexUserId=${plexUserId}`);

        res.json({ valid: true, isAdmin, user });
    } catch (error) {
        logger.error(`[Plex] Failed to verify user: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to verify Plex user' });
    }
});

/**
 * POST /api/plex/sso/config
 * Save Plex SSO configuration (admin only)
 * Body: { enabled, adminToken, adminEmail, machineId, autoCreateUsers, defaultGroup, linkedUserId }
 */
router.post('/sso/config', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { enabled, adminToken, adminEmail, adminPlexId, machineId, autoCreateUsers, defaultGroup, linkedUserId } = req.body as SSOConfigBody;

        const config = await getSystemConfig();
        const existingConfig = config.plexSSO || {};

        const newConfig = {
            ...existingConfig,
            enabled: enabled ?? existingConfig.enabled ?? false,
            adminToken: adminToken ?? existingConfig.adminToken,
            adminEmail: adminEmail ?? existingConfig.adminEmail,
            adminPlexId: adminPlexId ?? existingConfig.adminPlexId,
            machineId: machineId ?? existingConfig.machineId,
            autoCreateUsers: autoCreateUsers ?? existingConfig.autoCreateUsers ?? false,
            defaultGroup: defaultGroup ?? existingConfig.defaultGroup ?? 'user',
            linkedUserId: linkedUserId ?? existingConfig.linkedUserId
        };

        await updateSystemConfig({ plexSSO: newConfig });

        logger.info(`[Plex] SSO config updated: enabled=${newConfig.enabled}`);

        // Return config without sensitive token
        res.json({
            ...newConfig,
            adminToken: newConfig.adminToken ? '[CONFIGURED]' : null
        });
    } catch (error) {
        logger.error(`[Plex] Failed to save SSO config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to save Plex SSO configuration' });
    }
});

/**
 * GET /api/plex/sso/config
 * Get Plex SSO configuration (admin only)
 */
router.get('/sso/config', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const config = await getSystemConfig();
        const ssoConfig = config.plexSSO || {};

        // Return config without sensitive token
        res.json({
            enabled: ssoConfig.enabled || false,
            adminEmail: ssoConfig.adminEmail,
            adminPlexId: ssoConfig.adminPlexId,
            machineId: ssoConfig.machineId,
            autoCreateUsers: ssoConfig.autoCreateUsers || false,
            defaultGroup: ssoConfig.defaultGroup || 'user',
            hasToken: !!ssoConfig.adminToken,
            clientIdentifier: ssoConfig.clientIdentifier,
            linkedUserId: ssoConfig.linkedUserId || ''
        });
    } catch (error) {
        logger.error(`[Plex] Failed to get SSO config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get Plex SSO configuration' });
    }
});

/**
 * GET /api/plex/sso/status
 * Check if Plex SSO is enabled (public, for login page)
 */
router.get('/sso/status', async (req: Request, res: Response): Promise<void> => {
    try {
        const config = await getSystemConfig();
        const ssoConfig = config.plexSSO || {};

        res.json({
            enabled: ssoConfig.enabled || false
        });
    } catch (error) {
        logger.error(`[Plex] Failed to get SSO status: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get Plex SSO status' });
    }
});

/**
 * GET /api/plex/test
 * Test Plex server connection
 * Query: ?url=xxx&token=xxx
 */
router.get('/test', async (req: Request, res: Response): Promise<void> => {
    try {
        const { url, token } = req.query;

        if (!url || !token) {
            res.status(400).json({ error: 'url and token are required' });
            return;
        }

        const clientId = await getClientIdentifier();

        // Test connection to the Plex server
        const response = await axios.get<{ MediaContainer?: PlexMediaContainer }>(`${url}/`, {
            headers: {
                'Accept': 'application/json',
                'X-Plex-Token': token as string,
                'X-Plex-Client-Identifier': clientId
            }
        });

        const serverName = response.data?.MediaContainer?.friendlyName || 'Plex Server';

        logger.debug(`[Plex] Test connection successful: server="${serverName}"`);

        res.json({
            success: true,
            serverName
        });
    } catch (error) {
        const axiosErr = error as AxiosError<{ error?: string }>;
        logger.error(`[Plex] Test connection failed: error="${axiosErr.message}"`);
        res.status(500).json({
            success: false,
            error: axiosErr.response?.data?.error || 'Connection failed'
        });
    }
});

export default router;
