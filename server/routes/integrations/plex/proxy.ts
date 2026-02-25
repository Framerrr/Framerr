/**
 * Plex Proxy Routes
 * 
 * Handles all Plex-related API proxying:
 * - /sessions - Get active sessions
 * - /image - Proxy Plex images
 * - /terminate - Terminate session (admin only)
 * - /machineId - Get server machine identifier
 * - /* wildcard - Proxy Plex image paths
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';
import { PluginInstance } from '../../../integrations/types';

const router = Router();
const adapter = getPlugin('plex')!.adapter;

/**
 * Extract local IP URL from plex.direct URL
 * Example: https://192-168-6-141.hash.plex.direct:32400 -> https://192.168.6.141:32400
 */
function extractLocalUrlFromPlexDirect(url: string): string | null {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        // Check if this is a plex.direct URL with embedded IP
        // Format: 192-168-6-141.{hash}.plex.direct
        if (hostname.endsWith('.plex.direct')) {
            const ipMatch = hostname.match(/^(\d+-\d+-\d+-\d+)\./);
            if (ipMatch) {
                const localIp = ipMatch[1].replace(/-/g, '.');
                parsed.hostname = localIp;
                return parsed.toString().replace(/\/$/, '');
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Validate Plex path for security
 */
function validatePlexPath(path: string): { valid: boolean; error?: string } {
    // Allow standard Plex paths
    const allowedPatterns = [
        /^\/library\//,
        /^\/photo\//,
        /^\/status\//,
        /^\/:/,          // Metadata paths like /:key
    ];

    const blockedPatterns = [
        /\.\./,          // Path traversal
        /\/\//,          // Double slashes
        /<script/i,      // XSS attempt
    ];

    for (const pattern of blockedPatterns) {
        if (pattern.test(path)) {
            return { valid: false, error: 'Invalid path' };
        }
    }

    for (const pattern of allowedPatterns) {
        if (pattern.test(path)) {
            return { valid: true };
        }
    }

    return { valid: false, error: 'Path not allowed' };
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

interface PlexSession {
    instance: PluginInstance;
    instanceId: string;
}

/**
 * Validates integration access and returns Plex connection details.
 * Sends appropriate error responses and returns null if access is denied.
 */
async function withPlexSession(
    req: Request,
    res: Response,
    next: NextFunction,
    opts: { adminOnly?: boolean } = {}
): Promise<PlexSession | null> {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    // Type-mismatch: let Express try the next matching router
    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'plex') {
        next();
        return null;
    }

    if (opts.adminOnly && !isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('plex', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return null;
        }
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return null;
    }

    return { instance, instanceId: id };
}

// ============================================================================
// READ ENDPOINTS
// ============================================================================

/**
 * GET /:id/proxy/sessions - Get active Plex sessions
 */
router.get('/:id/proxy/sessions', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withPlexSession(req, res, next);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/status/sessions', {
            timeout: 10000,
        });

        const sessions = Array.isArray(response.data)
            ? response.data
            : response.data?.MediaContainer?.Metadata || [];

        const formattedSessions = sessions.map((s: Record<string, unknown>) => ({
            sessionKey: s.sessionKey || s.key,
            type: s.type,
            title: s.title,
            grandparentTitle: s.grandparentTitle,
            parentIndex: s.parentIndex,
            index: s.index,
            year: s.year,
            thumb: s.thumb,
            art: s.art,
            grandparentThumb: s.grandparentThumb,
            grandparentArt: s.grandparentArt,
            parentThumb: s.parentThumb,
            ratingKey: s.ratingKey,
            grandparentRatingKey: s.grandparentRatingKey,
            parentRatingKey: s.parentRatingKey,
            duration: s.duration,
            viewOffset: s.viewOffset,
            // Include full Media object with additional metadata
            Media: {
                ...(s.Media || {}),
                year: s.year,
                rating: s.rating,
                contentRating: s.contentRating,
                studio: s.studio,
                summary: s.summary,
                tagline: s.tagline,
            },
            Player: s.Player,
            Session: s.Session,
            TranscodeSession: s.TranscodeSession,
            Role: s.Role || [],
            Genre: Array.isArray(s.Genre) ? s.Genre.map((g: { tag?: string }) => g.tag) : [],
            Director: Array.isArray(s.Director) ? s.Director.map((d: { tag?: string }) => d.tag) : [],
            Writer: Array.isArray(s.Writer) ? s.Writer.map((w: { tag?: string }) => w.tag) : [],
            user: { title: (s.User as { title?: string })?.title || 'Unknown' }
        }));

        const activeSessions = formattedSessions.filter(
            (s: { Player?: { state?: string } }) => s.Player && s.Player.state !== 'stopped'
        );

        res.json({ sessions: activeSessions });
    } catch (error) {
        logger.error(`[Plex Proxy] Sessions error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Plex sessions' });
    }
});

/**
 * GET /:id/proxy/image - Proxy Plex images
 */
router.get('/:id/proxy/image', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withPlexSession(req, res, next);
    if (!session) return;

    const { path: imagePath } = req.query;

    if (!imagePath || typeof imagePath !== 'string') {
        res.status(400).json({ error: 'Image path required' });
        return;
    }

    const pathValidation = validatePlexPath(imagePath);
    if (!pathValidation.valid) {
        res.status(400).json({ error: pathValidation.error });
        return;
    }

    try {
        const response = await adapter.get!(session.instance, imagePath, {
            responseType: 'arraybuffer',
            timeout: 15000,
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=14400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] Image error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

/**
 * GET /:id/proxy/machineId - Get Plex server machine identifier
 */
router.get('/:id/proxy/machineId', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withPlexSession(req, res, next);
    if (!session) return;

    try {
        const response = await adapter.get!(session.instance, '/', {
            headers: { 'Accept': 'application/xml' },
            timeout: 10000,
        });

        // Return raw XML for machine ID extraction
        res.set('Content-Type', 'application/xml');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] MachineId error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Plex info' });
    }
});

// ============================================================================
// ACTION ENDPOINTS (admin-only)
// ============================================================================

/**
 * POST /:id/proxy/terminate - Terminate a Plex session (ADMIN ONLY)
 */
router.post('/:id/proxy/terminate', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await withPlexSession(req, res, next, { adminOnly: true });
    if (!session) return;

    const { sessionKey } = req.body;

    if (!sessionKey) {
        res.status(400).json({ error: 'Session key required' });
        return;
    }

    try {
        const { transcodeSessionKey, clientIdentifier, sessionId, reason } = req.body;
        // URL-encode the reason message for Plex API
        const terminateReason = encodeURIComponent(reason || 'The server owner has ended this stream');
        logger.info(`[Plex Proxy] Terminate body received: sessionKey=${sessionKey} sessionId=${sessionId || 'none'} transcodeSessionKey=${transcodeSessionKey || 'none'} clientIdentifier=${clientIdentifier || 'none'} reason="${reason || '(default)'}"`);


        // Try 1: Player control via client identifier (most reliable for direct play)
        if (clientIdentifier) {
            logger.info(`[Plex Proxy] Trying player stop: clientIdentifier=${clientIdentifier}`);
            try {
                await adapter.get!(session.instance, '/player/playback/stop', {
                    headers: { 'X-Plex-Target-Client-Identifier': clientIdentifier },
                    timeout: 10000,
                });
                logger.info(`[Plex Proxy] Player stopped: clientIdentifier=${clientIdentifier}`);
                res.json({ success: true });
                return;
            } catch (playerError) {
                logger.warn(`[Plex Proxy] Player stop failed: error="${(playerError as Error).message}"`);
            }
        }

        // Try 2: Kill transcode session (for transcoding streams)
        if (transcodeSessionKey) {
            logger.info(`[Plex Proxy] Trying transcode termination: transcodeSessionKey=${transcodeSessionKey}`);
            try {
                await adapter.request!(session.instance, 'DELETE', `/transcode/sessions/${transcodeSessionKey}`, undefined, {
                    timeout: 10000,
                });
                logger.info(`[Plex Proxy] Transcode session terminated: transcodeSessionKey=${transcodeSessionKey}`);
                res.json({ success: true });
                return;
            } catch (transcodeError) {
                logger.warn(`[Plex Proxy] Transcode termination failed: error="${(transcodeError as Error).message}"`);
            }
        }

        // Try 3: Session termination via status endpoint on relay URL
        // Use sessionId (string) if available, fall back to sessionKey (number)
        const terminateId = sessionId || sessionKey;
        logger.info(`[Plex Proxy] Trying session termination via relay: terminateId=${terminateId}`);

        try {
            await adapter.get!(session.instance, '/status/sessions/terminate', {
                params: { sessionId: terminateId, reason: terminateReason },
                timeout: 10000,
            });
            logger.info(`[Plex Proxy] Session terminated via relay: terminateId=${terminateId}`);
            res.json({ success: true });
            return;
        } catch (relayError) {
            logger.warn(`[Plex Proxy] Relay termination failed: error="${(relayError as Error).message}"`);
        }

        // Try 4: Session termination via local IP (plex.direct may not support this endpoint)
        const originalUrl = session.instance.config.url as string;
        const localUrl = extractLocalUrlFromPlexDirect(originalUrl);
        if (localUrl) {
            // Create a temporary instance with the local URL for adapter routing
            const localInstance: PluginInstance = {
                ...session.instance,
                config: { ...session.instance.config, url: localUrl },
            };
            logger.info(`[Plex Proxy] Trying session termination via local IP: ${localUrl}`);

            await adapter.get!(localInstance, '/status/sessions/terminate', {
                params: { sessionId: terminateId, reason: terminateReason },
                timeout: 10000,
            });

            logger.info(`[Plex Proxy] Session terminated via local IP: sessionKey=${sessionKey}`);
            res.json({ success: true });
            return;
        }

        // All methods failed
        throw new Error('All termination methods exhausted');
    } catch (error) {
        logger.error(`[Plex Proxy] All terminate methods failed: error="${(error as Error).message}" sessionKey=${sessionKey}`);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// ============================================================================
// IMAGE PROXY (wildcard)
// ============================================================================

/**
 * GET /:id/proxy/* - Wildcard route for Plex image paths (art, thumb, etc.)
 */
router.get('/:id/proxy/*', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const path = '/' + (req.params[0] || '');

    // FIRST check if this is a Plex integration - if not, pass to next router
    const dbInstance = integrationInstancesDb.getInstanceById(id);
    if (!dbInstance || dbInstance.type !== 'plex') {
        // Not a Plex integration - let the next router handle it
        next();
        return;
    }

    // Only handle image paths
    const isImagePath = path.includes('/thumb') || path.includes('/art') ||
        path.includes('/photo') || path.includes('/poster') ||
        path.includes('/banner') || path.includes('/library/');

    if (!isImagePath) {
        res.status(404).json({ error: 'Not found' });
        return;
    }

    const instance = toPluginInstance(dbInstance);

    if (!instance.config.url || !instance.config.token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const response = await adapter.get!(instance, path, {
            responseType: 'arraybuffer',
            timeout: 15000,
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=14400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] Wildcard image error: path="${path}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

export default router;
