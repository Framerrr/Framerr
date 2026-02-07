/**
 * Plex Realtime Manager
 * 
 * Implements RealtimeManager interface for Plex WebSocket connections.
 * Provides real-time session updates through the RealtimeOrchestrator.
 * 
 * Connects to Plex Media Server's WebSocket API to receive real-time
 * playback notifications (play, pause, stop events).
 */

import { RealtimeManager, PluginInstance, RealtimeConfig } from '../types';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';
import WebSocket from 'ws';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// PLEX TYPES
// ============================================================================

// Plex notification types
interface PlexNotification {
    NotificationContainer?: {
        type?: string;
        PlaySessionStateNotification?: Array<{
            sessionKey: string;
            ratingKey: string;
            state: 'playing' | 'paused' | 'stopped';
            viewOffset: number;
        }>;
    };
}

export interface PlexSession {
    sessionKey: string;
    type: string;
    title: string;
    grandparentTitle?: string;
    parentIndex?: number;
    index?: number;
    duration: number;
    viewOffset: number;
    art?: string;
    thumb?: string;
    ratingKey?: string; // Unique identifier for Plex deep links
    Player?: {
        address?: string;
        device?: string;
        platform?: string;
        product?: string;
        state?: string;
        title?: string;
    };
    Session?: {
        id?: string;
        key?: string;
        location?: string;
        bandwidth?: number;
    };
    user?: {
        title?: string;
    };
}

// ============================================================================
// PLEX REALTIME MANAGER
// ============================================================================

class PlexRealtimeManager implements RealtimeManager {
    private ws: WebSocket | null = null;
    private connected = false;
    private url: string;
    private token: string;
    private onUpdateCallback: (data: unknown) => void;
    private refreshInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private lastSessions: string = ''; // For change detection

    // Constants
    private static readonly REFRESH_INTERVAL = 30000; // 30 seconds

    // Lifecycle hooks for RealtimeOrchestrator
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;

    constructor(instance: PluginInstance, onUpdate: (data: unknown) => void) {
        const config = instance.config as Record<string, unknown>;

        // Translate URL for container environments
        this.url = translateHostUrl((config.url as string) || '').replace(/\/$/, '');
        this.token = (config.token as string) || '';
        this.onUpdateCallback = onUpdate;
    }

    /**
     * Connect to Plex WebSocket
     */
    connect(): void {
        // Guard: don't interrupt if already connecting or connected
        // Uses native WebSocket readyState to prevent killing in-progress handshakes
        if (this.ws?.readyState === WebSocket.CONNECTING ||
            this.ws?.readyState === WebSocket.OPEN) {
            logger.debug('[Plex] Already connecting or connected, skipping redundant connect()');
            return;
        }

        // Cleanup old socket if exists (CLOSING or CLOSED state)
        if (this.ws) {
            this.disconnect();
        }

        if (!this.url || !this.token) {
            this.onError?.('Missing URL or token');
            return;
        }

        try {
            // Transform URL for WebSocket
            const wsUrl = this.url
                .replace('https://', 'wss://')
                .replace('http://', 'ws://');

            const fullUrl = `${wsUrl}/:/websockets/notifications?X-Plex-Token=${this.token}`;

            logger.debug('[Plex] Connecting to server');

            this.ws = new WebSocket(fullUrl, {
                rejectUnauthorized: false // Allow self-signed certs
            });

            this.ws.on('open', () => {
                logger.info('[Plex] Connected');
                this.connected = true;
                // Fetch initial sessions
                this.fetchSessions();
                // Start periodic refresh to keep sessions up-to-date
                this.startPeriodicRefresh();
                // Notify orchestrator
                this.onConnect?.();
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const notification: PlexNotification = JSON.parse(data.toString());
                    this.handleNotification(notification);
                } catch (err) {
                    logger.debug('[Plex] Failed to parse notification');
                }
            });

            this.ws.on('close', () => {
                logger.debug('[Plex] Disconnected');
                this.connected = false;
                this.stopPeriodicRefresh();
                // Let orchestrator handle reconnection/fallback
                this.onDisconnect?.();
            });

            this.ws.on('error', (error: Error) => {
                logger.debug(`[Plex] WebSocket error: error="${error.message}"`);
                this.onError?.(error.message);
                // Don't reconnect here - onDisconnect will be called by 'close' event
            });

        } catch (error) {
            logger.debug(`[Plex] Connection failed: error="${(error as Error).message}"`);
            // Let orchestrator handle retry
            this.onError?.((error as Error).message);
        }
    }

    /**
     * Handle incoming Plex notification
     */
    private handleNotification(notification: PlexNotification): void {
        const container = notification.NotificationContainer;
        if (!container) return;

        logger.debug(`[Plex] Event: type=${container.type}`);

        // Handle playback state changes (playing, paused, stopped, etc.)
        if (container.type === 'playing' && container.PlaySessionStateNotification) {
            logger.debug('[Plex] Playback event - fetching sessions');
            this.fetchSessions();
        }
    }

    /**
     * Fetch current sessions from Plex API
     */
    private async fetchSessions(): Promise<void> {
        try {
            const translatedUrl = translateHostUrl(this.url);
            const response = await axios.get(`${translatedUrl}/status/sessions`, {
                headers: {
                    'X-Plex-Token': this.token,
                    'Accept': 'application/json'
                },
                httpsAgent,
                timeout: 10000
            });

            // Parse sessions
            const sessions = Array.isArray(response.data)
                ? response.data
                : response.data?.MediaContainer?.Metadata || [];

            // Format sessions
            const formattedSessions: PlexSession[] = sessions
                .filter((s: { Player?: { state?: string } }) => s.Player?.state !== 'stopped')
                .map((session: Record<string, unknown>) => ({
                    sessionKey: session.sessionKey || session.key,
                    type: session.type,
                    title: session.title,
                    grandparentTitle: session.grandparentTitle,
                    parentIndex: session.parentIndex,
                    index: session.index,
                    duration: parseInt(String(session.duration)) || 0,
                    viewOffset: parseInt(String(session.viewOffset)) || 0,
                    art: session.art,
                    thumb: session.thumb,
                    ratingKey: session.ratingKey, // Needed for Open in Plex deep link
                    Player: session.Player,
                    Session: session.Session,
                    user: session.User
                }));

            // Only broadcast if sessions changed
            const sessionsStr = JSON.stringify(formattedSessions);
            if (sessionsStr !== this.lastSessions) {
                this.lastSessions = sessionsStr;
                this.onUpdateCallback({ sessions: formattedSessions });
            }

        } catch (error) {
            logger.error(`[Plex] Session fetch failed: error="${(error as Error).message}"`);
        }
    }

    // NOTE: Reconnection is handled by RealtimeOrchestrator, not here.
    // This manager just reports connection state via onConnect/onDisconnect/onError hooks.

    /**
     * Start periodic session refresh
     */
    private startPeriodicRefresh(): void {
        this.stopPeriodicRefresh(); // Clear any existing interval

        this.refreshInterval = setInterval(() => {
            this.fetchSessions();
        }, PlexRealtimeManager.REFRESH_INTERVAL);

        logger.debug(`[Plex] Periodic refresh: interval=${PlexRealtimeManager.REFRESH_INTERVAL / 1000}s`);
    }

    /**
     * Stop periodic session refresh
     */
    private stopPeriodicRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Disconnect from Plex WebSocket
     */
    disconnect(): void {
        this.isShuttingDown = true;

        this.stopPeriodicRefresh();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.connected = false;
        this.onDisconnect?.();
    }

    /**
     * Check if currently connected
     */
    isConnected(): boolean {
        return this.connected;
    }
}

// ============================================================================
// REALTIME CONFIG EXPORT
// ============================================================================

/**
 * Factory function for creating PlexRealtimeManager instances.
 * Used by the RealtimeOrchestrator to create per-instance managers.
 */
export const realtime: RealtimeConfig = {
    createManager: (instance: PluginInstance, onUpdate: (data: unknown) => void): RealtimeManager => {
        return new PlexRealtimeManager(instance, onUpdate);
    }
};
