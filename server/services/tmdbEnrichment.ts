/**
 * TMDB Enrichment Service
 * 
 * Fetches media details from Overseerr's TMDB proxy endpoints and caches them.
 */

import logger from '../utils/logger';
import { getPlugin } from '../integrations/registry';
import type { PluginInstance } from '../integrations/types';
import * as mediaCache from '../db/mediaCache';
import * as imageCache from './imageCache';
import type { MediaCacheEntry } from '../db/mediaCache';

/** Raw request from Overseerr API (before enrichment) */
export interface RawOverseerrRequest {
    id: number;
    status: number;
    type: 'movie' | 'tv';
    media?: {
        tmdbId?: number;
        status?: number;
        mediaType?: string;
    };
    requestedBy?: {
        id?: number;
        displayName?: string;
    };
    seasons?: Array<{ seasonNumber?: number }>;
}

/** Enriched request with cached media data */
export interface EnrichedRequest {
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

/** TMDB movie response from Overseerr */
interface TmdbMovieResponse {
    id: number;
    title: string;
    originalTitle?: string;
    posterPath?: string;
    backdropPath?: string;
    overview?: string;
    releaseDate?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: Array<{ id: number; name: string }>;
    runtime?: number;
    tagline?: string;
    status?: string;
}

/** TMDB TV response from Overseerr */
interface TmdbTvResponse {
    id: number;
    name: string;
    originalName?: string;
    posterPath?: string;
    backdropPath?: string;
    overview?: string;
    firstAirDate?: string;
    voteAverage?: number;
    voteCount?: number;
    genres?: Array<{ id: number; name: string }>;
    numberOfSeasons?: number;
    tagline?: string;
    status?: string;
}

/**
 * Fetch media details from Overseerr and cache them
 */
export async function fetchAndCacheMedia(
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    instance: PluginInstance
): Promise<MediaCacheEntry | null> {
    try {
        const plugin = getPlugin('overseerr');
        if (!plugin) {
            logger.warn('[TMDBEnrichment] Overseerr plugin not found');
            return null;
        }

        const path = mediaType === 'movie'
            ? `/api/v1/movie/${tmdbId}`
            : `/api/v1/tv/${tmdbId}`;

        const response = await plugin.adapter.get!(instance, path, {
            timeout: 10000,
        });

        const data = response.data;

        // Build cache entry
        const entry: MediaCacheEntry = {
            tmdbId,
            mediaType,
            title: mediaType === 'movie'
                ? (data as TmdbMovieResponse).title
                : (data as TmdbTvResponse).name,
            originalTitle: mediaType === 'movie'
                ? (data as TmdbMovieResponse).originalTitle
                : (data as TmdbTvResponse).originalName,
            posterPath: data.posterPath || null,
            backdropPath: data.backdropPath || null,
            overview: data.overview || null,
            releaseDate: mediaType === 'movie'
                ? (data as TmdbMovieResponse).releaseDate
                : (data as TmdbTvResponse).firstAirDate,
            voteAverage: data.voteAverage || null,
            voteCount: data.voteCount || null,
            genres: data.genres?.map((g: { name: string }) => g.name) || null,
            runtime: mediaType === 'movie' ? (data as TmdbMovieResponse).runtime : null,
            numberOfSeasons: mediaType === 'tv' ? (data as TmdbTvResponse).numberOfSeasons : null,
            tagline: data.tagline || null,
            status: data.status || null
        };

        // Save to database
        mediaCache.setCachedMedia(entry);

        // Cache poster image in background (don't block)
        if (entry.posterPath) {
            imageCache.cacheImage(tmdbId, entry.posterPath, 'poster').catch(() => {
                // Ignore image cache errors
            });
        }

        logger.debug(`[TMDBEnrichment] Cached media: tmdbId=${tmdbId} type=${mediaType} title="${entry.title}"`);
        return entry;
    } catch (error) {
        logger.warn(`[TMDBEnrichment] Failed to fetch: tmdbId=${tmdbId} type=${mediaType} error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Get or fetch media data (from cache or API)
 */
export async function getOrFetchMedia(
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    instance: PluginInstance
): Promise<MediaCacheEntry | null> {
    // Try cache first
    const cached = mediaCache.getCachedMedia(tmdbId, mediaType);
    if (cached) {
        return cached;
    }

    // Fetch and cache
    return fetchAndCacheMedia(tmdbId, mediaType, instance);
}

/**
 * Enrich a list of Overseerr requests with cached media data
 * Handles bulk caching efficiently
 */
export async function enrichRequests(
    requests: RawOverseerrRequest[],
    instance: PluginInstance
): Promise<EnrichedRequest[]> {
    // Collect unique tmdbIds by type
    const movieIds = new Set<number>();
    const tvIds = new Set<number>();

    for (const req of requests) {
        if (req.media?.tmdbId) {
            if (req.type === 'movie') {
                movieIds.add(req.media.tmdbId);
            } else {
                tvIds.add(req.media.tmdbId);
            }
        }
    }

    // Bulk get cached entries
    const cachedMovies = mediaCache.bulkGetCachedMedia(Array.from(movieIds), 'movie');
    const cachedTv = mediaCache.bulkGetCachedMedia(Array.from(tvIds), 'tv');

    // Find missing entries that need fetching
    const missingMovieIds = Array.from(movieIds).filter(id => !cachedMovies.has(id));
    const missingTvIds = Array.from(tvIds).filter(id => !cachedTv.has(id));

    // Fetch missing entries (limit concurrency to avoid overwhelming Overseerr)
    const fetchPromises: Promise<void>[] = [];
    const maxConcurrent = 5;

    for (let i = 0; i < missingMovieIds.length; i += maxConcurrent) {
        const batch = missingMovieIds.slice(i, i + maxConcurrent);
        for (const id of batch) {
            fetchPromises.push(
                fetchAndCacheMedia(id, 'movie', instance).then(entry => {
                    if (entry) cachedMovies.set(id, entry);
                })
            );
        }
    }

    for (let i = 0; i < missingTvIds.length; i += maxConcurrent) {
        const batch = missingTvIds.slice(i, i + maxConcurrent);
        for (const id of batch) {
            fetchPromises.push(
                fetchAndCacheMedia(id, 'tv', instance).then(entry => {
                    if (entry) cachedTv.set(id, entry);
                })
            );
        }
    }

    // Wait for all fetches
    await Promise.all(fetchPromises);

    // Enrich requests with cached data
    return requests.map(req => {
        const tmdbId = req.media?.tmdbId;
        const cached = tmdbId
            ? (req.type === 'movie' ? cachedMovies.get(tmdbId) : cachedTv.get(tmdbId))
            : null;

        let title = 'Unknown';
        if (cached) {
            title = cached.title;
            // For TV shows with seasons, add season info
            if (req.type === 'tv' && req.seasons?.length) {
                const seasonNum = req.seasons[0].seasonNumber;
                if (seasonNum !== undefined) {
                    title = `${cached.title} (Season ${seasonNum})`;
                }
            }
        }

        return {
            id: req.id,
            status: req.status,
            type: req.type,
            media: tmdbId ? {
                tmdbId,
                title,
                status: req.media?.status ?? 1,
                posterPath: cached?.posterPath ?? null,
                localPosterPath: imageCache.isImageCached(tmdbId, 'poster')
                    ? imageCache.getImageFilename(tmdbId, 'poster')
                    : null,
                backdropPath: cached?.backdropPath ?? null,
                overview: cached?.overview,
                releaseDate: cached?.releaseDate,
                voteAverage: cached?.voteAverage
            } : undefined,
            requestedBy: req.requestedBy ? {
                id: req.requestedBy.id,
                displayName: req.requestedBy.displayName || 'Unknown'
            } : undefined
        };
    });
}
