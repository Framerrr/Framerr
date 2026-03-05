/**
 * SSE Realtime Types
 *
 * All type definitions for the SSE realtime system.
 * Pure data shapes — no runtime logic, no imports from other realtime modules.
 */

import type { Operation } from 'fast-json-patch';

// ============================================================================
// DOMAIN EVENT TYPES
// ============================================================================

// Plex session shape (for widgets that need it)
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
    Player?: {
        address?: string;
        device?: string;
        platform?: string;
        product?: string;
        state?: string;
        title?: string;
    };
    user?: {
        title?: string;
    };
}

// Queue item shape (for Sonarr/Radarr widgets)
export interface QueueItem {
    id: number;
    progress: number;
    timeleft?: string;
    status: string;
    movieId?: number;
    movie?: {
        title?: string;
        tmdbId?: number;
    };
    seriesId?: number;
    series?: {
        title?: string;
        tvdbId?: number;
        tmdbId?: number;
    };
    episode?: {
        seasonNumber?: number;
        episodeNumber?: number;
        title?: string;
    };
    size?: number;
    sizeleft?: number;
}

// Service status event shape
export interface ServiceStatusEvent {
    event: 'status-change' | 'maintenance-toggle';
    monitorId: string;
    oldStatus?: string;
    newStatus?: string;
    maintenance?: boolean;
    errorMessage?: string | null;
    responseTimeMs?: number | null;
    timestamp: number;
}

// ============================================================================
// BACKUP EVENT TYPES
// ============================================================================

export interface BackupStartedEvent {
    id: string;
    type: 'manual' | 'scheduled' | 'safety';
}

export interface BackupProgressEvent {
    id: string;
    step: string;
    percent: number;
}

export interface BackupCompleteEvent {
    id: string;
    filename: string;
    size: number;
}

export interface BackupErrorEvent {
    id: string;
    error: string;
}

export interface BackupScheduledFailedEvent {
    error: string;
    timestamp: string;
}

export type BackupEvent =
    | { type: 'started'; data: BackupStartedEvent }
    | { type: 'progress'; data: BackupProgressEvent }
    | { type: 'complete'; data: BackupCompleteEvent }
    | { type: 'error'; data: BackupErrorEvent }
    | { type: 'scheduled-failed'; data: BackupScheduledFailedEvent };

// ============================================================================
// SSE PROTOCOL TYPES
// ============================================================================

// SSE payload from server
export interface SSEPayload {
    type: 'full' | 'delta';
    data?: unknown;
    patches?: Operation[];
    timestamp: number;
}

// ============================================================================
// CONNECTION STATE TYPES
// ============================================================================

export interface RealtimeState {
    isConnected: boolean;
    connectionId: string | null;
    disconnectedAt: number | null;  // Phase 5: timestamp when disconnect started
}

/**
 * Phase 5: Connection status tiers for UI feedback.
 * - connected: SSE is open and working
 * - reconnecting-silent: <5s disconnect, no UI needed
 * - reconnecting-warning: 5-30s disconnect, show subtle indicator
 * - disconnected: >30s disconnect, show persistent toast
 */
export type ConnectionStatus = 'connected' | 'reconnecting-silent' | 'reconnecting-warning' | 'disconnected';

/**
 * P9: Connection lifecycle states for auth-aware SSE.
 * - idle: Not initialized (no user logged in)
 * - connecting: First connection attempt in progress
 * - connected: SSE stream is open and healthy
 * - reconnecting: Lost connection, attempting to restore
 * - failed: Max reconnection attempts exhausted
 */
export type SSEConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

// ============================================================================
// CALLBACK EVENT TYPES
// ============================================================================

// Phase 7: Notification callbacks for unified SSE delivery
export interface NotificationEvent {
    id?: string;
    type?: string;
    title?: string;
    message?: string;
    iconId?: string | null;
    iconIds?: string[];
    metadata?: Record<string, unknown>;
    action?: string;  // For sync events: 'markRead', 'delete', 'markAllRead', 'clearAll'
    notificationId?: string;  // For sync events: which notification was affected
}

// Global settings invalidation for real-time sync
export interface SettingsInvalidateEvent {
    entity: string;  // e.g., 'permissions', 'groups', 'tabs', 'templates'
}

// Settings SSE: Theme callbacks for real-time theme sync across tabs/devices
export interface ThemeEvent {
    action: 'updated' | 'reset';
    theme: {
        mode?: 'light' | 'dark' | 'system';
        primaryColor?: string;
        preset?: string;
        customColors?: Record<string, string>;
    };
}

// Library sync progress for smooth progress bar updates
export interface LibrarySyncProgressEvent {
    integrationId: string;
    indexed: number;
    total: number;
    percent: number;
    phase?: 'fetching' | 'indexing';
    statusMessage?: string;
}

// ============================================================================
// HOOK RESULT TYPE
// ============================================================================

export interface UseRealtimeSSEResult {
    isConnected: boolean;
    connectionId: string | null;
    disconnectedAt: number | null;  // Phase 5: for tiered disconnect UI
    subscribeToTopic: (topic: string, callback: (data: unknown) => void) => Promise<() => void>;
    onServiceStatus: (callback: (event: ServiceStatusEvent) => void) => () => void;
    onBackupEvent: (callback: (event: BackupEvent) => void) => () => void;
    // Phase 7: Notification events via unified SSE
    onNotification: (callback: (event: NotificationEvent) => void) => () => void;
    // Global settings invalidation for real-time sync
    onSettingsInvalidate: (callback: (event: SettingsInvalidateEvent) => void) => () => void;
    // Settings SSE: Theme events for real-time theme sync
    onThemeChange: (callback: (event: ThemeEvent) => void) => () => void;
    // Library sync progress for smooth progress bar
    onLibrarySyncProgress: (callback: (event: LibrarySyncProgressEvent) => void) => () => void;
    // LEGACY: Empty stubs until Phase 8 widget migration (these widgets should use subscribeToTopic)
    plexSessions: PlexSession[];
    sonarrQueue: QueueItem[];
    radarrQueue: QueueItem[];
}
