/**
 * SSE Module - Type Definitions
 * 
 * Shared type interfaces for the SSE system.
 * These types are used by both backend and frontend consumers.
 */

/**
 * Queue item shape for Sonarr/Radarr downloads.
 * Matches frontend useWebSocket.ts expectations.
 */
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

/**
 * Plex session shape for active playback sessions.
 */
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

/**
 * Represents a subscription to a specific SSE topic.
 * Tracks subscribers, polling state, and cached data.
 */
export interface Subscription {
    topic: string;
    subscribers: Set<string>;  // connectionIds
    pollInterval: NodeJS.Timeout | null;
    cachedData: unknown;
    lastUpdated: number;  // timestamp
}
