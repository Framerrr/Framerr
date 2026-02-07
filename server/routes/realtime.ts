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
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

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

    logger.debug(`[Realtime Unsubscribe] connection=${connectionId} topic=${topic} user=${userId}`);

    unsubscribe(connectionId, topic);

    return res.json({ success: true, topic });
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

