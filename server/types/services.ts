/**
 * Service Types
 * Types for backend services like notification emitter and webhook resolver
 */

import type { Response } from 'express';
import type { EventEmitter } from 'events';
import type { Notification } from '../../shared/types/notification';
import type { WebhookConfig } from '../../shared/types/integration';

// ============================================
// SSE (Server-Sent Events) Types
// ============================================

/**
 * Active SSE connection
 */
export interface SSEConnection {
    userId: string;
    res: Response;
    connectedAt: Date;
}

/**
 * SSE event payload
 */
export interface SSEEvent {
    type: 'notification' | 'ping' | 'connected';
    data: unknown;
}

// ============================================
// Web Push Types
// ============================================

/**
 * Web Push notification payload
 */
export interface WebPushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    renotify?: boolean;
    requireInteraction?: boolean;
    data?: {
        notificationId?: string;
        url?: string;
        [key: string]: unknown;
    };
}

/**
 * Web Push subscription from browser
 */
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

// ============================================
// Notification Emitter Types
// ============================================

/**
 * Options for sending a notification
 */
export interface SendNotificationOptions {
    forceWebPush?: boolean;
    skipSSE?: boolean;
}

/**
 * Notification emitter interface
 */
export interface NotificationEmitterInterface extends EventEmitter {
    connections: Map<string, Set<Response>>;
    vapidInitialized: boolean;

    initializeVapid(): Promise<void>;
    getVapidPublicKey(): string | null;

    // SSE methods
    addConnection(userId: string, res: Response): void;
    removeConnection(userId: string, res: Response): void;
    hasConnection(userId: string): boolean;
    sendSSE(userId: string, notification: Notification): void;

    // Web Push methods
    sendWebPush(userId: string, notification: Notification): Promise<void>;

    // Combined notification sending
    sendNotification(
        userId: string,
        notification: Notification,
        options?: SendNotificationOptions
    ): Promise<void>;

    // Broadcast to all connected users
    broadcast(notification: Notification): void;

    // Stats
    getConnectionCount(): number;
}

// ============================================
// Webhook Resolver Types
// ============================================

/**
 * Result of resolving webhook recipients
 */
export interface WebhookResolveResult {
    notified: number;
    skipped: number;
    users: string[];
}

/**
 * Parameters for resolving webhook recipients
 */
export interface WebhookResolveParams {
    service: 'overseerr' | 'sonarr' | 'radarr';
    eventKey: string;
    username?: string | null;
    title: string;
    message: string;
    iconId?: string;
    webhookConfig: WebhookConfig;
    metadata?: Record<string, unknown>;
    adminOnly?: boolean;
}

// ============================================
// Route Handler Types
// ============================================

import type { Request, NextFunction } from 'express';

/**
 * Express middleware function type
 */
export type ExpressMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => void | Promise<void>;

/**
 * Express error handler type
 */
export type ExpressErrorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => void | Promise<void>;

/**
 * Route handler with authenticated user
 */
export interface AuthenticatedRequest extends Request {
    user: NonNullable<Request['user']>;
    proxyAuth?: boolean;
}

/**
 * Multer file from upload middleware
 */
export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer?: Buffer;
}
