/**
 * Plex Proxy Routes
 * 
 * Handles all Plex-related API proxying:
 * - /sessions - Get active sessions
 * - /image - Proxy Plex images
 * - /terminate - Terminate session (admin only)
 * - /proxy - Generic Plex API proxy
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

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

/**
 * GET /:id/proxy/sessions - Get active Plex sessions
 */
router.get('/:id/proxy/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'plex') {
        res.status(404).json({ error: 'Plex integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('plex', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const token = instance.config.token as string;

    if (!url || !token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const response = await axios.get(`${translatedUrl}/status/sessions`, {
            headers: {
                'X-Plex-Token': token,
                'Accept': 'application/json'
            },
            httpsAgent,
            timeout: 10000
        });

        const sessions = Array.isArray(response.data)
            ? response.data
            : response.data?.MediaContainer?.Metadata || [];

        const formattedSessions = sessions.map((session: Record<string, unknown>) => ({
            sessionKey: session.sessionKey || session.key,
            type: session.type,
            title: session.title,
            grandparentTitle: session.grandparentTitle,
            parentIndex: session.parentIndex,
            index: session.index,
            year: session.year,
            thumb: session.thumb,
            art: session.art,
            grandparentThumb: session.grandparentThumb,
            grandparentArt: session.grandparentArt,
            parentThumb: session.parentThumb,
            ratingKey: session.ratingKey,
            grandparentRatingKey: session.grandparentRatingKey,
            parentRatingKey: session.parentRatingKey,
            duration: session.duration,
            viewOffset: session.viewOffset,
            // Include full Media object with additional metadata
            Media: {
                ...(session.Media || {}),
                // These fields come directly from the session, not nested in Media
                year: session.year,
                rating: session.rating,
                contentRating: session.contentRating,
                studio: session.studio,
                summary: session.summary,
                tagline: session.tagline,
            },
            Player: session.Player,
            Session: session.Session,
            TranscodeSession: session.TranscodeSession,
            Role: session.Role || [],
            Genre: Array.isArray(session.Genre) ? session.Genre.map((g: { tag?: string }) => g.tag) : [],
            Director: Array.isArray(session.Director) ? session.Director.map((d: { tag?: string }) => d.tag) : [],
            Writer: Array.isArray(session.Writer) ? session.Writer.map((w: { tag?: string }) => w.tag) : [],
            user: { title: (session.User as { title?: string })?.title || 'Unknown' }
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
router.get('/:id/proxy/image', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;

    // Check if this is a Plex integration FIRST — if not, pass to next router
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'plex') {
        next();
        return;
    }

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

    const url = instance.config.url as string;
    const token = instance.config.token as string;

    if (!url || !token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const imageUrl = `${translatedUrl}${imagePath}?X-Plex-Token=${token}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 15000
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] Image error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

/**
 * POST /:id/proxy/terminate - Terminate a Plex session (ADMIN ONLY)
 */
router.post('/:id/proxy/terminate', requireAuth, async (req: Request, res: Response): Promise<void> => {
    if (req.user!.group !== 'admin') {
        res.status(403).json({ error: 'Admin access required to terminate sessions' });
        return;
    }

    const { id } = req.params;
    const { sessionKey } = req.body;

    if (!sessionKey) {
        res.status(400).json({ error: 'Session key required' });
        return;
    }

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'plex') {
        res.status(404).json({ error: 'Plex integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const token = instance.config.token as string;

    if (!url || !token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const { transcodeSessionKey, clientIdentifier, sessionId, reason } = req.body;
        // URL-encode the reason message for Plex API
        const terminateReason = encodeURIComponent(reason || 'The server owner has ended this stream');
        logger.info(`[Plex Proxy] Terminate body received: sessionKey=${sessionKey} sessionId=${sessionId || 'none'} transcodeSessionKey=${transcodeSessionKey || 'none'} clientIdentifier=${clientIdentifier || 'none'} reason="${reason || '(default)'}"`);


        // Try 1: Player control via client identifier (most reliable for direct play)
        if (clientIdentifier) {
            logger.info(`[Plex Proxy] Trying player stop: clientIdentifier=${clientIdentifier}`);
            try {
                await axios.get(`${translatedUrl}/player/playback/stop`, {
                    headers: {
                        'X-Plex-Token': token,
                        'X-Plex-Target-Client-Identifier': clientIdentifier
                    },
                    httpsAgent,
                    timeout: 10000
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
                await axios.delete(`${translatedUrl}/transcode/sessions/${transcodeSessionKey}`, {
                    headers: { 'X-Plex-Token': token },
                    httpsAgent,
                    timeout: 10000
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
        const terminateUrl = `${translatedUrl}/status/sessions/terminate?sessionId=${terminateId}&reason=${terminateReason}`;
        logger.info(`[Plex Proxy] Trying session termination via relay: terminateId=${terminateId}`);

        try {
            await axios.get(terminateUrl, {
                headers: { 'X-Plex-Token': token },
                httpsAgent,
                timeout: 10000
            });
            logger.info(`[Plex Proxy] Session terminated via relay: terminateId=${terminateId}`);
            res.json({ success: true });
            return;
        } catch (relayError) {
            logger.warn(`[Plex Proxy] Relay termination failed: error="${(relayError as Error).message}"`);
        }

        // Try 4: Session termination via local IP (plex.direct may not support this endpoint)
        const localUrl = extractLocalUrlFromPlexDirect(url);
        if (localUrl) {
            const localTerminateUrl = `${localUrl}/status/sessions/terminate?sessionId=${terminateId}&reason=${terminateReason}`;
            logger.info(`[Plex Proxy] Trying session termination via local IP: ${localUrl}`);

            await axios.get(localTerminateUrl, {
                headers: { 'X-Plex-Token': token },
                httpsAgent,
                timeout: 10000
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

/**
 * GET /:id/proxy/machineId - Get Plex server machine identifier
 */
router.get('/:id/proxy/machineId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'plex') {
        res.status(404).json({ error: 'Plex integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const token = instance.config.token as string;

    if (!url || !token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const response = await axios.get(`${translatedUrl}/`, {
            headers: {
                'X-Plex-Token': token,
                'Accept': 'application/xml'
            },
            httpsAgent,
            timeout: 10000
        });

        // Return raw XML for machine ID extraction
        res.set('Content-Type', 'application/xml');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] MachineId error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Plex info' });
    }
});

/**
 * GET /:id/proxy/* - Wildcard route for Plex image paths (art, thumb, etc.)
 */
router.get('/:id/proxy/*', requireAuth, async (req: Request, res: Response, next): Promise<void> => {
    const { id } = req.params;
    const path = '/' + (req.params[0] || '');

    // FIRST check if this is a Plex integration - if not, pass to next router
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'plex') {
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

    const url = instance.config.url as string;
    const token = instance.config.token as string;

    if (!url || !token) {
        res.status(400).json({ error: 'Invalid Plex configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);
        const imageUrl = `${translatedUrl}${path}?X-Plex-Token=${token}`;

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 15000
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(response.data);
    } catch (error) {
        logger.error(`[Plex Proxy] Wildcard image error: path="${path}" error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

export default router;
