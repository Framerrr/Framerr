/**
 * Webhook Payload Types
 * Incoming webhook payloads from external services
 */

// ============================================
// Overseerr / Jellyseerr Webhooks
// ============================================

/**
 * Media information in Overseerr webhook
 */
export interface OverseerrMedia {
    title?: string;
    tmdbId?: number;
    tvdbId?: number;
    mediaType?: 'movie' | 'tv';
    status?: string;
    status4k?: string;
}

/**
 * Request information in Overseerr webhook
 */
export interface OverseerrRequest {
    id?: number;
    request_id?: number;
    requestId?: number;
    requestedBy_username?: string;
    requestedBy_email?: string;
    requestedBy_avatar?: string;
}

/**
 * Issue information in Overseerr webhook
 */
export interface OverseerrIssue {
    issue_type?: string;
    issue_status?: string;
    reportedBy_username?: string;
}

/**
 * Full Overseerr/Jellyseerr webhook payload
 * Field names vary between Overseerr and Jellyseerr
 */
export interface OverseerrWebhookPayload {
    // Event type (different field names across versions)
    event?: string;
    notification_type?: string;
    notificationType?: string;
    type?: string;

    // Content
    subject?: string;
    message?: string;

    // Related objects
    request?: OverseerrRequest;
    media?: OverseerrMedia;
    issue?: OverseerrIssue;

    // Extra fields
    extra?: Array<{ name: string; value: string }>;
}

// ============================================
// Sonarr Webhooks
// ============================================

/**
 * Series information in Sonarr webhook
 */
export interface SonarrSeries {
    id: number;
    title: string;
    path: string;
    tvdbId?: number;
}

/**
 * Episode information in Sonarr webhook
 */
export interface SonarrEpisode {
    episodeNumber: number;
    seasonNumber: number;
    title: string;
    airDate?: string;
    airDateUtc?: string;
}

/**
 * Episode file information
 */
export interface SonarrEpisodeFile {
    id: number;
    relativePath: string;
    path: string;
    quality: string;
    size: number;
}

/**
 * Full Sonarr webhook payload
 */
export interface SonarrWebhookPayload {
    eventType: string;
    instanceName?: string;
    series?: SonarrSeries;
    episodes?: SonarrEpisode[];
    episodeFile?: SonarrEpisodeFile;
    isUpgrade?: boolean;

    // Health events
    health?: {
        source?: string;
        type?: string;
        message?: string;
        wikiUrl?: string;
    };
    isHealthRestored?: boolean;
    message?: string;

    // Grab events
    release?: {
        quality?: string;
        releaseTitle?: string;
        indexer?: string;
        size?: number;
    };
}

// ============================================
// Radarr Webhooks
// ============================================

/**
 * Movie information in Radarr webhook
 */
export interface RadarrMovie {
    id: number;
    title: string;
    year: number;
    path: string;
    tmdbId?: number;
    imdbId?: string;
}

/**
 * Movie file information
 */
export interface RadarrMovieFile {
    id: number;
    relativePath: string;
    path: string;
    quality: string;
    size: number;
}

/**
 * Full Radarr webhook payload
 */
export interface RadarrWebhookPayload {
    eventType: string;
    instanceName?: string;
    movie?: RadarrMovie;
    movieFile?: RadarrMovieFile;
    isUpgrade?: boolean;

    // Health events
    health?: {
        source?: string;
        type?: string;
        message?: string;
        wikiUrl?: string;
    };
    isHealthRestored?: boolean;
    message?: string;

    // Grab events
    release?: {
        quality?: string;
        releaseTitle?: string;
        indexer?: string;
        size?: number;
    };
}

// ============================================
// Common Types
// ============================================

/**
 * Unified webhook event type
 */
export type WebhookEventType =
    // Overseerr events
    | 'media.pending'
    | 'media.approved'
    | 'media.available'
    | 'media.failed'
    | 'media.declined'
    | 'media.auto.approved'
    | 'issue.created'
    | 'issue.resolved'
    | 'issue.reopened'
    | 'test.notification'
    // Sonarr events
    | 'Grab'
    | 'Download'
    | 'Upgrade'
    | 'Rename'
    | 'SeriesAdd'
    | 'SeriesDelete'
    | 'EpisodeFileDelete'
    | 'Health'
    | 'HealthRestored'
    | 'ApplicationUpdate'
    | 'Test'
    // Radarr events
    | 'MovieAdded'
    | 'MovieDelete'
    | 'MovieFileDelete'
    | 'MovieFileDeleted'
    | string;

/**
 * Parsed webhook notification ready for processing
 */
export interface ParsedWebhookNotification {
    service: 'overseerr' | 'sonarr' | 'radarr';
    eventKey: string;
    title: string;
    message: string;
    iconId?: string;
    username?: string | null;
    adminOnly: boolean;
    metadata?: Record<string, unknown>;
}
