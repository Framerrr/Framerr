/**
 * Media Stream Adapters - Type Definitions
 *
 * Normalized session type used by all frontend components.
 * Each server adapter transforms raw API data into this format.
 */

// ============================================================================
// PLAYBACK INFO (normalized for modals)
// ============================================================================

/**
 * Normalized playback information used by the PlaybackDataModal.
 * Each adapter maps server-specific fields into this common format.
 * Fields that don't exist for a server type are left undefined and hidden in UI.
 */
export interface PlaybackInfo {
    // Network
    ipAddress?: string;
    location?: 'lan' | 'wan'; // Plex only
    bandwidth?: number; // kilobits per second

    // Transcode
    videoDecision?: 'directplay' | 'copy' | 'transcode';
    audioDecision?: 'directplay' | 'copy' | 'transcode';
    videoCodec?: string;
    audioCodec?: string;

    // Client
    device?: string;
    platform?: string;
    application?: string;
}

// ============================================================================
// NORMALIZED SESSION TYPE
// ============================================================================

/**
 * Normalized media session used across the widget.
 * All server-specific data is transformed into this common format.
 */
export interface MediaSession {
    // Identity
    sessionKey: string;
    integrationType: 'plex' | 'jellyfin' | 'emby';

    // Content info
    type: 'movie' | 'episode' | 'track' | 'unknown';
    title: string;
    grandparentTitle?: string; // Show title for episodes
    parentIndex?: number; // Season number
    index?: number; // Episode number
    ratingKey?: string; // Media item ID for deep links

    // Progress (milliseconds)
    duration: number;
    viewOffset: number;

    // Images (server-relative paths, use adapter.getImageUrl() to resolve)
    art?: string; // Background art
    thumb?: string; // Poster/thumbnail

    // Player state
    playerState: 'playing' | 'paused' | 'buffering';

    // User info
    userName: string;

    // Normalized playback data for PlaybackDataModal
    playbackInfo?: PlaybackInfo;

    // Raw data for modals (server-specific details)
    _raw: unknown;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Adapter interface for normalizing server-specific session data.
 */
export interface SessionAdapter {
    /**
     * Normalize raw session data from the server into MediaSession format.
     */
    normalize(rawSession: unknown, integrationId: string): MediaSession;

    /**
     * Build full image URL from server-relative path.
     */
    getImageUrl(path: string, integrationId: string): string;

    /**
     * Build deep link URL to open media in native app/web interface.
     * @param session - Normalized session
     * @param machineId - Server identifier (Plex only)
     * @param serverUrl - Server web URL (Jellyfin/Emby only)
     */
    getDeepLink(session: MediaSession, machineId?: string, serverUrl?: string): string;

    /**
     * Get the API endpoint path for stopping playback.
     */
    getStopEndpoint(integrationId: string): string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type IntegrationType = 'plex' | 'jellyfin' | 'emby';

export interface MediaSessionsResponse {
    sessions: MediaSession[];
}
