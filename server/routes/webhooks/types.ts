/**
 * Webhook Types and Event Maps
 * 
 * Shared types and event mappings for webhook handlers.
 */

// Re-export webhook payload types
export type {
    OverseerrWebhookPayload,
    SonarrWebhookPayload,
    RadarrWebhookPayload
} from '../../types/webhooks';

// Types
export type WebhookService = 'overseerr' | 'sonarr' | 'radarr';

export interface TokenValidationResult {
    valid: boolean;
    reason?: string;
    webhookConfig?: WebhookConfig;
}

export interface WebhookConfig {
    webhookEnabled?: boolean;
    webhookToken?: string;
    adminEvents?: string[];
    userEvents?: string[];
    [key: string]: unknown;
}

export interface NotificationSent {
    userId: string;
    username: string;
    role?: string;
    test?: boolean;
    unmatched?: boolean;
}

export interface NotificationMetadata {
    [key: string]: unknown;
    requestId?: number;
    service: string;
    actionable: boolean;
    mediaTitle: string;
}

export interface ProcessNotificationParams {
    service: WebhookService;
    eventKey: string;
    username: string | null;
    title: string;
    message: string;
    webhookConfig: WebhookConfig;
    metadata?: NotificationMetadata | null;
    adminOnly?: boolean;
}

export interface NotificationContent {
    title: string;
    message: string;
}

export interface User {
    id: string;
    username: string;
    group: string;
}

export interface SonarrEpisodeInfo {
    episodeNumber: number;
    seasonNumber: number;
}

// Event type mappings from external services to Framerr event keys
// Supports both Overseerr (media.pending) and Seerr/Jellyseerr ("New Movie Request") formats
export const OVERSEERR_EVENT_MAP: Record<string, string> = {
    // Overseerr format
    'media.pending': 'requestPending',
    'media.approved': 'requestApproved',
    'media.auto_approved': 'requestAutoApproved',
    'media.available': 'requestAvailable',
    'media.declined': 'requestDeclined',
    'media.failed': 'requestFailed',
    'issue.created': 'issueReported',
    'issue.comment': 'issueComment',
    'issue.resolved': 'issueResolved',
    'issue.reopened': 'issueReopened',

    // Seerr/Jellyseerr format (human-readable event names)
    'New Movie Request': 'requestPending',
    'New Series Request': 'requestPending',
    'New Request': 'requestPending',
    'Movie Request Approved': 'requestApproved',
    'Series Request Approved': 'requestApproved',
    'Request Approved': 'requestApproved',
    'Movie Request Automatically Approved': 'requestAutoApproved',
    'Series Request Automatically Approved': 'requestAutoApproved',
    'Request Automatically Approved': 'requestAutoApproved',
    'Movie Now Available': 'requestAvailable',
    'Series Now Available': 'requestAvailable',
    'Now Available': 'requestAvailable',
    'Movie Available': 'requestAvailable',
    'Series Available': 'requestAvailable',
    'Movie Request Declined': 'requestDeclined',
    'Series Request Declined': 'requestDeclined',
    'Request Declined': 'requestDeclined',
    'Movie Request Failed': 'requestFailed',
    'Series Request Failed': 'requestFailed',
    'Request Failed': 'requestFailed',
    'New Issue': 'issueReported',
    'Issue Created': 'issueReported',
    'Issue Comment': 'issueComment',
    'New Issue Comment': 'issueComment',
    'Issue Resolved': 'issueResolved',
    'Issue Reopened': 'issueReopened',

    // Test events
    'test': 'test',
    'Test Notification': 'test',
    'TEST_NOTIFICATION': 'test'
};

export const SONARR_EVENT_MAP: Record<string, string> = {
    'Grab': 'grab',
    'Download': 'download',
    'Upgrade': 'upgrade',
    'ImportComplete': 'importComplete',
    'Rename': 'rename',
    'SeriesAdd': 'seriesAdd',
    'SeriesDelete': 'seriesDelete',
    'EpisodeFileDelete': 'episodeFileDelete',
    'EpisodeFileDeleteForUpgrade': 'episodeFileDeleteForUpgrade',
    'Health': 'healthIssue', // Will check payload for restored
    'HealthRestored': 'healthRestored',
    'ApplicationUpdate': 'applicationUpdate',
    'ManualInteractionRequired': 'manualInteractionRequired',
    'Test': 'test'
};

export const RADARR_EVENT_MAP: Record<string, string> = {
    'Grab': 'grab',
    'Download': 'download',
    'Upgrade': 'upgrade',
    'ImportComplete': 'importComplete',
    'Rename': 'rename',
    'MovieAdded': 'movieAdd',
    'MovieDelete': 'movieDelete',
    'MovieFileDelete': 'movieFileDelete',
    'MovieFileDeleteForUpgrade': 'movieFileDeleteForUpgrade',
    'Health': 'healthIssue',
    'HealthRestored': 'healthRestored',
    'ApplicationUpdate': 'applicationUpdate',
    'ManualInteractionRequired': 'manualInteractionRequired',
    'Test': 'test'
};
