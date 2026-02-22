/**
 * Overseerr Poller
 * 
 * Polls Overseerr for pending media requests.
 * Uses TMDB enrichment service for cached titles and posters.
 * Triggers surgical library cache refresh when media becomes available.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { enrichRequests, type RawOverseerrRequest } from '../../services/tmdbEnrichment';
import {
    isTmdbIdInLibrary,
    getMediaServerIntegrationsWithSync,
    indexRecentlyAddedForTmdbIds
} from '../../services/librarySyncService';
import logger from '../../utils/logger';

// ============================================================================
// OVERSEERR POLLER
// ============================================================================

/** Polling interval in milliseconds (60 seconds) */
export const intervalMs = 60000;

/**
 * In-memory set of TMDB IDs already verified as present in the library cache.
 * Once verified, never checked again for the lifetime of the server process.
 * Prevents redundant SQLite queries on every poll cycle.
 */
const verifiedTmdbIds = new Set<number>();

/** Request shape for SSE (enriched with cached data) */
export interface OverseerrRequest {
    id: number;
    status: number;
    type: 'movie' | 'tv';
    media?: {
        tmdbId: number;
        title: string;
        status: number;
        posterPath: string | null;
        localPosterPath: string | null;
        backdropPath: string | null;
        overview?: string | null;
        releaseDate?: string | null;
        voteAverage?: number | null;
    };
    requestedBy?: {
        id?: number;
        displayName: string;
    };
}

/** Overseerr response shape */
export interface OverseerrData {
    results: OverseerrRequest[];
}

/**
 * Poll Overseerr for pending requests.
 * Enriches results with cached TMDB metadata.
 * Triggers surgical library cache refresh for newly available media.
 */
export async function poll(instance: PluginInstance): Promise<OverseerrData> {
    if (!instance.config.url || !instance.config.apiKey) {
        throw new Error('URL and API key required');
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;

    // Fetch raw requests from Overseerr (errors propagate to PollerOrchestrator)
    const response = await axios.get(`${url}/api/v1/request`, {
        params: { take: 50, filter: 'all', sort: 'added' },
        headers: { 'X-Api-Key': apiKey },
        httpsAgent,
        timeout: 15000
    });

    // Map to raw request format for enrichment
    const rawRequests: RawOverseerrRequest[] = (response.data.results || []).map(
        (item: Record<string, unknown>) => ({
            id: item.id as number,
            status: item.status as number,
            type: item.type as 'movie' | 'tv',
            media: item.media ? {
                tmdbId: (item.media as Record<string, unknown>).tmdbId as number | undefined,
                status: (item.media as Record<string, unknown>).status as number | undefined,
                mediaType: (item.media as Record<string, unknown>).mediaType as string | undefined
            } : undefined,
            requestedBy: item.requestedBy ? {
                id: (item.requestedBy as Record<string, unknown>).id as number | undefined,
                displayName: (item.requestedBy as Record<string, unknown>).displayName as string | undefined
            } : undefined,
            seasons: item.seasons as Array<{ seasonNumber?: number }> | undefined
        })
    );

    // Enrich with cached TMDB data (titles, posters, etc.)
    const enrichedResults = await enrichRequests(rawRequests, { url, apiKey });

    // Surgical library cache refresh (fire-and-forget, doesn't block SSE response)
    triggerSurgicalRefresh(enrichedResults).catch(err => {
        logger.debug(`[Overseerr Poller] Surgical refresh error: error="${err.message}"`);
    });

    return { results: enrichedResults };
}

/**
 * Check enriched results for available media missing from the library cache.
 * If found, trigger a targeted search against media servers to fill the gap.
 * This ensures the Media Search widget shows newly available media without
 * waiting for the next full library sync.
 */
async function triggerSurgicalRefresh(results: OverseerrRequest[]): Promise<void> {
    // Filter to requests where media is at least partially available on the media server
    // Status codes: 1=Unknown, 2=Pending, 3=Processing (downloading), 4=Partially Available, 5=Available
    // We only care about >= 4 — status 3 means it's been sent to Sonarr/Radarr but not downloaded yet
    const availableRequests = results.filter(r =>
        r.media?.status !== undefined && r.media.status >= 4 &&
        r.media?.tmdbId
    );

    if (availableRequests.length === 0) return;

    // Collect TMDB IDs that need indexing (skip already verified)
    const tmdbIdsToIndex = new Set<number>();
    for (const req of availableRequests) {
        const tmdbId = req.media!.tmdbId;
        if (verifiedTmdbIds.has(tmdbId)) continue; // Already confirmed in cache

        if (isTmdbIdInLibrary(tmdbId)) {
            verifiedTmdbIds.add(tmdbId); // Remember — never check again
            continue;
        }

        tmdbIdsToIndex.add(tmdbId);
    }

    if (tmdbIdsToIndex.size === 0) return;

    // Get media servers with library sync enabled
    const mediaServers = getMediaServerIntegrationsWithSync();
    if (mediaServers.length === 0) return;

    logger.debug(`[Overseerr Poller] Surgical refresh: ${tmdbIdsToIndex.size} items to index across ${mediaServers.length} media servers`);

    // Fetch recently-added items from each server and index any matches
    const indexed = await indexRecentlyAddedForTmdbIds(tmdbIdsToIndex, mediaServers);

    // Mark successfully indexed items as verified
    for (const tmdbId of indexed) {
        verifiedTmdbIds.add(tmdbId);
    }
    // Items not found will be retried next cycle (maybe Plex hasn't scanned yet)
}
