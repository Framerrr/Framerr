/**
 * useRecommendations Hook
 *
 * Fetches search bar recommendations from the backend.
 * Accepts integration IDs to scope recommendations to widget-bound integrations.
 * Cache is keyed by integration set — different widgets get their own cache.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { widgetFetch } from '../../../utils/widgetFetch';

// ============================================================================
// TYPES
// ============================================================================

export interface RecommendationItem {
    ratingKey: string;
    title: string;
    year: number | null;
    mediaType: 'movie' | 'show';
    thumb: string | null;
    integrationId: string;
    integrationType: 'plex' | 'jellyfin' | 'emby';
    summary: string | null;
    genres: string[] | null;
    rating: number | null;
    tmdbId: number | null;
    imdbId: string | null;
}

interface RecommendationsResponse {
    items: RecommendationItem[];
    source: 'personalized' | 'random' | 'none';
}

interface UseRecommendationsReturn {
    items: RecommendationItem[];
    source: 'personalized' | 'random' | 'none';
    isLoading: boolean;
}

// Cache keyed by sorted integration IDs — different widgets get separate caches
const cacheMap = new Map<string, RecommendationsResponse>();
const fetchPromiseMap = new Map<string, Promise<RecommendationsResponse | null>>();

// ============================================================================
// HOOK
// ============================================================================

export function useRecommendations(integrationIds: string[]): UseRecommendationsReturn {
    const cacheKey = [...integrationIds].sort().join(',');
    const enabled = integrationIds.length > 0;

    const [data, setData] = useState<RecommendationsResponse | null>(
        cacheKey ? (cacheMap.get(cacheKey) ?? null) : null
    );
    const [isLoading, setIsLoading] = useState(enabled && !cacheMap.has(cacheKey));
    const mountedRef = useRef(true);

    const fetchRecommendations = useCallback(async () => {
        if (!cacheKey) return;

        // Return cached data immediately
        const cached = cacheMap.get(cacheKey);
        if (cached) {
            setData(cached);
            setIsLoading(false);
            return;
        }

        // Deduplicate concurrent fetches for the same key
        if (!fetchPromiseMap.has(cacheKey)) {
            const promise = (async () => {
                try {
                    const response = await widgetFetch(
                        `/api/media/recommendations?integrationIds=${encodeURIComponent(cacheKey)}&limit=20`,
                        'media-search'
                    );
                    if (!response.ok) return null;
                    const result = await response.json() as RecommendationsResponse;
                    cacheMap.set(cacheKey, result);
                    return result;
                } catch {
                    return null;
                } finally {
                    fetchPromiseMap.delete(cacheKey);
                }
            })();
            fetchPromiseMap.set(cacheKey, promise);
        }

        const result = await fetchPromiseMap.get(cacheKey)!;
        if (mountedRef.current) {
            setData(result);
            setIsLoading(false);
        }
    }, [cacheKey]);

    useEffect(() => {
        mountedRef.current = true;
        if (enabled) {
            fetchRecommendations();
        } else {
            setData(null);
            setIsLoading(false);
        }
        return () => { mountedRef.current = false; };
    }, [enabled, fetchRecommendations]);

    return {
        items: data?.items ?? [],
        source: data?.source ?? 'none',
        isLoading,
    };
}
