/**
 * Realtime SSE Route
 * 
 * Provides Server-Sent Events endpoint for real-time updates.
 * Replaces WebSocket for better reverse proxy compatibility.
 * 
 * Phase 1: Added subscription-based topic management.
 */

import { Router, Request, Response } from 'express';
import {
    addClient,
    removeClient,
    addClientConnection,
    removeClientConnection,
    subscribe,
    unsubscribe,
    getActiveTopics,
    getSubscriberCount
} from '../services/sseStreamService';
import { clientConnections, setPushEndpoint } from '../services/sse/connections';
import { pollerOrchestrator, parseTopic } from '../services/sse/PollerOrchestrator';
import { getInstanceById } from '../db/integrationInstances';
import { userHasIntegrationAccess } from '../db/integrationShares';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

// Burst retry rate limiting: 1 burst per (userId:topic) per 30 s
const retryAttempts: Map<string, number> = new Map();
const RETRY_RATE_WINDOW_MS = 30_000;
const BURST_COUNT = 5;
const BURST_INTERVAL_MS = 5_000;

/**
 * Verify that the authenticated user owns the given SSE connection.
 * Returns true if ownership is confirmed, false if rejected (sends 403).
 */
function verifyConnectionOwnership(connectionId: string, userId: string, res: Response): boolean {
    const connection = clientConnections.get(connectionId);
    if (!connection || connection.userId !== userId) {
        res.status(403).json({
            error: 'Connection does not belong to the authenticated user'
        });
        return false;
    }
    return true;
}

/**
 * Verify the authenticated user is authorized to access the integration
 * instance a topic refers to. Subscription presence alone is NOT sufficient.
 */
function authorizeRetryTopic(
    topic: string,
    userId: string,
    userGroup: string,
    res: Response
): { type: string; instanceId: string; subtype?: string } | null {
    const { type, instanceId, subtype } = parseTopic(topic);

    if (!instanceId) {
        res.status(400).json({ error: 'Topic does not support on-demand retry' });
        return null;
    }

    if (!pollerOrchestrator.supportsPolling(topic)) {
        res.status(400).json({ error: 'Topic does not support on-demand retry' });
        return null;
    }

    const dbInstance = getInstanceById(instanceId);
    if (!dbInstance || dbInstance.type !== type) {
        res.status(403).json({ error: 'Integration not found for topic' });
        return null;
    }

    const isAdmin = userGroup === 'admin';
    if (!isAdmin && !userHasIntegrationAccess(type, userId, userGroup)) {
        res.status(403).json({ error: 'Access denied for this integration' });
        return null;
    }

    return { type, instanceId, subtype };
}

const router = Router();

// Phase 5: Rate limiting for SSE connections (10 per user per minute)
const connectionAttempts: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;  // 1 minute
const MAX_CONNECTIONS_PER_WINDOW = 10;

/**
 * Check if a user is rate limited for SSE connections.
 * Returns true if the user should be blocked.
 */
function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const attempts = connectionAttempts.get(userId) || [];

    // Filter to only recent attempts
    const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    // Update the map with filtered attempts
    connectionAttempts.set(userId, recentAttempts);

    return recentAttempts.length >= MAX_CONNECTIONS_PER_WINDOW;
}

/**
 * Record a connection attempt for rate limiting.
 */
function recordConnectionAttempt(userId: string): void {
    const now = Date.now();
    const attempts = connectionAttempts.get(userId) || [];
    connectionAttempts.set(userId, [...attempts, now]);
}

// Type for authenticated request (use type assertion in handlers)

/**
 * GET /api/realtime/stream
 * SSE endpoint for real-time Plex/Sonarr/Radarr updates
 * 
 * Returns a connectionId that must be used for subscribe/unsubscribe calls.
 */
router.get('/stream', requireAuth, (req: Request, res: Response) => {
    const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

    // Phase 5: Rate limiting check
    if (isRateLimited(userId)) {
        logger.warn(`[Realtime SSE] Rate limited: user=${userId}`);
        return res.status(429).json({
            error: 'Too many connection attempts. Please wait before reconnecting.'
        });
    }
    recordConnectionAttempt(userId);

    logger.debug(`[Realtime SSE] New connection: user=${userId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Register connection with new subscription system
    const connectionId = addClientConnection(res, userId);

    // Also register with legacy system for backwards compatibility
    addClient(res);

    // Heartbeat to keep connection alive (every 25 seconds)
    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch (error) {
            clearInterval(heartbeat);
            removeClientConnection(res);
            removeClient(res);
        }
    }, 25000);

    // Clean up on close
    req.on('close', () => {
        clearInterval(heartbeat);
        removeClientConnection(res);
        removeClient(res);
        logger.debug(`[Realtime SSE] Connection closed: connectionId=${connectionId}`);
    });

    // Handle errors
    req.on('error', () => {
        clearInterval(heartbeat);
        removeClientConnection(res);
        removeClient(res);
    });

    // SSE connections stay open - explicit return for TypeScript
    return;
});

/**
 * POST /api/realtime/subscribe
 * Subscribe to a topic for real-time updates.
 * 
 * Body: { connectionId: string, topic: string }
 * 
 * Topic format: "{type}:{instanceId}" 
 * Examples: "qbittorrent:123", "plex:456", "monitors:status"
 */
router.post('/subscribe', requireAuth, (req: Request, res: Response) => {
    const { connectionId, topic } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;

    if (!connectionId || !topic) {
        return res.status(400).json({
            error: 'Missing required fields: connectionId, topic'
        });
    }

    // Security: verify the authenticated user owns this connection
    if (!verifyConnectionOwnership(connectionId, userId || '', res)) {
        return;
    }

    logger.debug(`[Realtime Subscribe] connection=${connectionId} topic=${topic} user=${userId}`);

    const result = subscribe(connectionId, topic);

    return res.json({
        success: true,
        topic,
        cached: result.cached
    });
});

/**
 * POST /api/realtime/unsubscribe
 * Unsubscribe from a topic.
 * 
 * Body: { connectionId: string, topic: string }
 */
router.post('/unsubscribe', requireAuth, (req: Request, res: Response) => {
    const { connectionId, topic } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;

    if (!connectionId || !topic) {
        return res.status(400).json({
            error: 'Missing required fields: connectionId, topic'
        });
    }

    // Security: verify the authenticated user owns this connection
    if (!verifyConnectionOwnership(connectionId, userId || '', res)) {
        return;
    }

    logger.debug(`[Realtime Unsubscribe] connection=${connectionId} topic=${topic} user=${userId}`);

    unsubscribe(connectionId, topic);

    return res.json({ success: true, topic });
});

/**
 * POST /api/realtime/retry
 * Trigger a burst of on-demand polls for a topic.
 *
 * Body: { connectionId: string, topic: string }
 */
router.post('/retry', requireAuth, async (req: Request, res: Response) => {
    const { connectionId, topic } = req.body as { connectionId?: string; topic?: string };
    const user = (req as unknown as { user?: { id: string; group: string } }).user;
    const userId = user?.id || '';
    const userGroup = user?.group || '';

    if (!connectionId || !topic) {
        return res.status(400).json({ error: 'Missing required fields: connectionId, topic' });
    }

    if (!verifyConnectionOwnership(connectionId, userId, res)) {
        return;
    }

    if (!authorizeRetryTopic(topic, userId, userGroup, res)) {
        return;
    }

    const connection = clientConnections.get(connectionId);
    if (!connection || !connection.subscriptions.has(topic)) {
        return res.status(403).json({ error: 'Not subscribed to topic' });
    }

    const rateKey = `${userId}:${topic}`;
    const lastBurst = retryAttempts.get(rateKey) ?? 0;
    const now = Date.now();
    if (now - lastBurst < RETRY_RATE_WINDOW_MS) {
        return res.status(429).json({ error: 'Retry already in progress. Wait 30 s before retrying again.' });
    }
    retryAttempts.set(rateKey, now);

    try {
        await pollerOrchestrator.triggerPoll(topic);
    } catch (err) {
        logger.warn(`[Realtime Retry] First poll failed: topic=${topic}`, { error: err });
    }

    for (let i = 1; i < BURST_COUNT; i++) {
        setTimeout(() => {
            pollerOrchestrator.triggerPoll(topic).catch((err: unknown) => {
                logger.debug(`[Realtime Retry] Burst poll ${i}/${BURST_COUNT - 1}: topic=${topic}`, { error: err });
            });
        }, i * BURST_INTERVAL_MS);
    }

    logger.debug(`[Realtime Retry] Burst scheduled: topic=${topic} userId=${userId} count=${BURST_COUNT}`);
    return res.json({ success: true, topic, burstCount: BURST_COUNT });
});

/**
 * POST /api/realtime/push-endpoint
 * Link a push subscription endpoint to an SSE connection.
 * This allows the server to skip sending push notifications
 * to devices that have the app open (active SSE connection).
 *
 * Body: { connectionId: string, pushEndpoint: string }
 */
router.post('/push-endpoint', requireAuth, (req: Request, res: Response) => {
    const { connectionId, pushEndpoint } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;

    if (!connectionId || !pushEndpoint) {
        return res.status(400).json({
            error: 'Missing required fields: connectionId, pushEndpoint'
        });
    }

    // Security: verify the authenticated user owns this connection
    if (!verifyConnectionOwnership(connectionId, userId || '', res)) {
        return;
    }

    const linked = setPushEndpoint(connectionId, pushEndpoint);

    if (!linked) {
        return res.status(404).json({ error: 'Connection not found' });
    }

    return res.json({ success: true });
});

/**
 * GET /api/realtime/status
 * Get current subscription status (admin/debug endpoint).
 */
router.get('/status', requireAuth, (_req: Request, res: Response) => {
    const topics = getActiveTopics();
    const status = topics.map(topic => ({
        topic,
        subscribers: getSubscriberCount(topic)
    }));

    return res.json({
        activeTopics: topics.length,
        topics: status
    });
});

export default router;

