/**
 * Overseerr Poller
 * 
 * Polls Overseerr for pending media requests.
 * Uses TMDB enrichment service for cached titles and posters.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { enrichRequests, type RawOverseerrRequest } from '../../services/tmdbEnrichment';

// ============================================================================
// OVERSEERR POLLER
// ============================================================================

/** Polling interval in milliseconds (60 seconds) */
export const intervalMs = 60000;

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
        overview?: string | null;
        releaseDate?: string | null;
        voteAverage?: number | null;
    };
    requestedBy?: {
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
 */
export async function poll(instance: PluginInstance): Promise<OverseerrData> {
    if (!instance.config.url || !instance.config.apiKey) {
        return { results: [] };
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
                displayName: (item.requestedBy as Record<string, unknown>).displayName as string | undefined
            } : undefined,
            seasons: item.seasons as Array<{ seasonNumber?: number }> | undefined
        })
    );

    // Enrich with cached TMDB data (titles, posters, etc.)
    const enrichedResults = await enrichRequests(rawRequests, { url, apiKey });

    return { results: enrichedResults };
}


