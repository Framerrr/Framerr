/**
 * Overseerr Widget — Shared Type Definitions
 *
 * Centralizes types used across the Overseerr widget, modal, and hooks.
 * Canonical source of truth for media request and download types.
 *
 * TASK-20260309-001 / REMEDIATION-2026-P5 / S-W-MEDIA-04
 */

// ── Media & Request types ─────────────────────────────────────────────

export interface Media {
    tmdbId?: number;
    title?: string;
    status?: number;
    posterPath?: string | null;
    localPosterPath?: string | null;
    backdropPath?: string | null;
    overview?: string | null;
    releaseDate?: string | null;
    voteAverage?: number | null;
}

export interface RequestedBy {
    displayName?: string;
}

export interface MediaRequest {
    id: number;
    status: number;
    type: 'movie' | 'tv';
    media?: Media;
    requestedBy?: RequestedBy;
}

export interface OverseerrData {
    results?: MediaRequest[];
    _meta?: {
        perUserFiltering?: boolean;
        userMatched?: boolean;
        linkedUsername?: string;
    };
}

// ── Download types ────────────────────────────────────────────────────

/** Per-instance download info (Phase 7) */
export interface InstanceDownload {
    integrationId: string;
    displayName: string;      // Framerr user-defined name for this instance
    progress: number;         // 0-100
    timeLeft?: string;        // e.g., "1:23:45"
    episodeCount?: number;    // For TV shows: how many episodes downloading
}

/** Multi-instance download info (Phase 9) */
export interface DownloadInfoMulti {
    isDownloading: boolean;
    downloads: InstanceDownload[];
}

// ── Re-exports from hooks ─────────────────────────────────────────────

export type { QueueItem, MultiInstanceQueueData } from './hooks/useMultiInstanceQueue';
