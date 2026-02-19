/**
 * useRecommendations Hook
 *
 * Fetches search bar recommendations from the backend.
 * Session-level cache: fetches once per mount, subsequent calls return cached data.
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

// Session-level cache (shared across all hook instances)
let cachedData: RecommendationsResponse | null = null;
let fetchPromise: Promise<RecommendationsResponse | null> | null = null;

// ============================================================================
// HOOK
// ============================================================================

export function useRecommendations(enabled: boolean = true): UseRecommendationsReturn {
    const [data, setData] = useState<RecommendationsResponse | null>(cachedData);
    const [isLoading, setIsLoading] = useState(!cachedData && enabled);
    const mountedRef = useRef(true);

    const fetchRecommendations = useCallback(async () => {
        // Return cached data immediately
        if (cachedData) {
            setData(cachedData);
            setIsLoading(false);
            return;
        }

        // Deduplicate concurrent fetches
        if (!fetchPromise) {
            fetchPromise = (async () => {
                try {
                    const response = await widgetFetch(
                        '/api/plex/recommendations?limit=20',
                        'media-search'
                    );
                    if (!response.ok) return null;
                    const result = await response.json() as RecommendationsResponse;
                    cachedData = result;
                    return result;
                } catch {
                    return null;
                } finally {
                    fetchPromise = null;
                }
            })();
        }

        const result = await fetchPromise;
        if (mountedRef.current) {
            setData(result);
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        if (enabled) {
            fetchRecommendations();
        }
        return () => { mountedRef.current = false; };
    }, [enabled, fetchRecommendations]);

    return {
        items: data?.items ?? [],
        source: data?.source ?? 'none',
        isLoading,
    };
}
