/**
 * Jellyfin Realtime Manager
 * 
 * Implements RealtimeManager interface for Jellyfin WebSocket connections.
 * Provides real-time session updates through the RealtimeOrchestrator.
 */

import { RealtimeManager, PluginInstance, RealtimeConfig } from '../types';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';
import WebSocket from 'ws';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { JellyfinSession } from './poller';

// ============================================================================
// JELLYFIN REALTIME MANAGER
// ============================================================================

class JellyfinRealtimeManager implements RealtimeManager {
    private ws: WebSocket | null = null;
    private connected = false;
    private url: string;
    private apiKey: string;
    private userId: string;
    private onUpdateCallback: (data: unknown) => void;
    private refreshInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private lastSessions: string = '';
    private fetchDebounceTimer: NodeJS.Timeout | null = null;

    // Constants
    private static readonly REFRESH_INTERVAL = 10000; // 10 seconds (reduced from 30s for faster recovery)

    // Lifecycle hooks for RealtimeOrchestrator
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;

    constructor(instance: PluginInstance, onUpdate: (data: unknown) => void) {
        const config = instance.config as Record<string, unknown>;

        this.url = translateHostUrl((config.url as string) || '').replace(/\/$/, '');
        this.apiKey = (config.apiKey as string) || '';
        this.userId = (config.userId as string) || '';
        this.onUpdateCallback = onUpdate;
    }

    /**
     * Connect to Jellyfin WebSocket
     */
    connect(): void {
        // Guard: don't interrupt if already connecting or connected
        // Uses native WebSocket readyState to prevent killing in-progress handshakes
        if (this.ws?.readyState === WebSocket.CONNECTING ||
            this.ws?.readyState === WebSocket.OPEN) {
            logger.debug('[Jellyfin] Already connecting or connected, skipping redundant connect()');
            return;
        }

        // Cleanup old socket if exists (CLOSING or CLOSED state)
        if (this.ws) {
            this.disconnect();
        }

        if (!this.url || !this.apiKey) {
            this.onError?.('Missing URL or API key');
            return;
        }

        try {
            // Transform URL for WebSocket
            const wsUrl = this.url
                .replace('https://', 'wss://')
                .replace('http://', 'ws://');

            const fullUrl = `${wsUrl}/socket?api_key=${this.apiKey}`;

            logger.debug('[Jellyfin] Connecting to server');

            this.ws = new WebSocket(fullUrl, {
                rejectUnauthorized: false
            });

            this.ws.on('open', () => {
                logger.info('[Jellyfin] Connected');
                this.connected = true;
                this.fetchSessions();
                this.startPeriodicRefresh();
                this.onConnect?.();
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (err) {
                    logger.debug('[Jellyfin] Failed to parse message');
                }
            });

            this.ws.on('close', () => {
                logger.debug('[Jellyfin] Disconnected');
                this.connected = false;
                this.stopPeriodicRefresh();
                // Let orchestrator handle reconnection/fallback
                this.onDisconnect?.();
            });

            this.ws.on('error', (error: Error) => {
                logger.debug(`[Jellyfin] WebSocket error: error="${error.message}"`);
                this.onError?.(error.message);
                // Don't reconnect here - onDisconnect will be called by 'close' event
            });

        } catch (error) {
            logger.debug(`[Jellyfin] Connection failed: error="${(error as Error).message}"`);
            // Let orchestrator handle retry
            this.onError?.((error as Error).message);
        }
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(message: { MessageType?: string; Data?: unknown }): void {
        const type = message.MessageType;

        logger.debug(`[Jellyfin] Event: type=${type}`);

        // Handle session-related events
        if (type === 'Sessions' ||
            type === 'SessionsStart' ||
            type === 'SessionsStop' ||
            type === 'PlaybackStart' ||
            type === 'PlaybackStopped' ||
            type === 'PlaybackProgress') {
            logger.debug('[Jellyfin] Playback event - debounced fetch');
            this.debouncedFetchSessions();
        }
    }

    /**
     * Debounced fetch - prevents concurrent HTTP requests when rapid WS
     * notifications arrive. Waits 200ms for events to settle.
     */
    private debouncedFetchSessions(): void {
        if (this.fetchDebounceTimer) {
            clearTimeout(this.fetchDebounceTimer);
        }
        this.fetchDebounceTimer = setTimeout(() => {
            this.fetchDebounceTimer = null;
            this.fetchSessions();
        }, 200);
    }

    /**
     * Fetch current sessions from Jellyfin API
     */
    private async fetchSessions(): Promise<void> {
        try {
            const response = await axios.get<JellyfinSession[]>(`${this.url}/Sessions`, {
                headers: {
                    'Authorization': `MediaBrowser Token="${this.apiKey}"`,
                    'Accept': 'application/json',
                },
                httpsAgent,
                timeout: 10000,
            });

            // Filter to sessions with active playback
            const activeSessions = response.data.filter(
                (session) => session.NowPlayingItem != null
            );

            // Only broadcast if sessions changed
            const sessionsStr = JSON.stringify(activeSessions);
            if (sessionsStr !== this.lastSessions) {
                this.lastSessions = sessionsStr;
                this.onUpdateCallback({ sessions: activeSessions });
            }

        } catch (error) {
            logger.error(`[Jellyfin] Session fetch failed: error="${(error as Error).message}"`);
        }
    }

    // NOTE: Reconnection is handled by RealtimeOrchestrator, not here.
    // This manager just reports connection state via onConnect/onDisconnect/onError hooks.

    /**
     * Start periodic session refresh
     */
    private startPeriodicRefresh(): void {
        this.stopPeriodicRefresh();

        this.refreshInterval = setInterval(() => {
            this.fetchSessions();
        }, JellyfinRealtimeManager.REFRESH_INTERVAL);

        logger.debug(`[Jellyfin] Periodic refresh: interval=${JellyfinRealtimeManager.REFRESH_INTERVAL / 1000}s`);
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
     * Disconnect from Jellyfin WebSocket
     */
    disconnect(): void {
        this.isShuttingDown = true;

        this.stopPeriodicRefresh();

        // Clear any pending debounced fetch
        if (this.fetchDebounceTimer) {
            clearTimeout(this.fetchDebounceTimer);
            this.fetchDebounceTimer = null;
        }

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
 * Factory function for creating JellyfinRealtimeManager instances.
 * Used by the RealtimeOrchestrator to create per-instance managers.
 */
export const realtime: RealtimeConfig = {
    createManager: (instance: PluginInstance, onUpdate: (data: unknown) => void): RealtimeManager => {
        return new JellyfinRealtimeManager(instance, onUpdate);
    }
};
