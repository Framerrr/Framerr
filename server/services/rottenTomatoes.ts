/**
 * Rotten Tomatoes lookup (Overseerr-compatible)
 *
 * RT has no public free API. Overseerr (and now Framerr) query the same Algolia
 * index RT's website uses, match by title + year, and build a URL from `vanity`.
 * Best-effort — not guaranteed accurate.
 */

import logger from '../utils/logger';

export interface RTLookupResult {
    title: string;
    year: number;
    url: string;
    criticsScore: number | null;
    audienceScore: number | null;
}

interface RTAlgoliaHit {
    title: string;
    releaseYear: number;
    type?: string;
    vanity: string;
    rottenTomatoes?: {
        audienceScore?: number;
        criticsScore?: number;
        certifiedFresh?: boolean;
    };
}

interface RTAlgoliaSearchResponse {
    results: {
        hits: RTAlgoliaHit[];
        index: string;
    }[];
}

type MediaKind = 'movie' | 'tv';

const ALGOLIA_URL = 'https://79frdp12pn-dsn.algolia.net/1/indexes/*/queries';
const ALGOLIA_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-algolia-agent': 'Algolia for JavaScript (4.14.3); Browser (lite)',
    // Public search key used by RT's own site / Overseerr (not a secret)
    'x-algolia-api-key': '175588f6e5f8319b27702e4cc4013561',
    'x-algolia-application-id': '79FRDP12PN',
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for misses
const cache = new Map<string, { expiresAt: number; value: RTLookupResult | null }>();

function cacheKey(kind: MediaKind, title: string, year: number): string {
    return `${kind}:${year}:${title.trim().toLowerCase()}`;
}

function pickHit(hits: RTAlgoliaHit[], name: string, year: number): RTAlgoliaHit | undefined {
    let hit = hits.find((h) => h.releaseYear === year && h.title === name);
    if (!hit) {
        hit = hits.find((h) => h.releaseYear === year && h.title.includes(name));
    }
    if (!hit) {
        hit = hits.find((h) => h.releaseYear === year);
    }
    if (!hit) {
        hit = hits.find((h) => h.title === name);
    }
    return hit;
}

function toUrl(kind: MediaKind, vanity: string): string {
    const segment = kind === 'tv' ? 'tv' : 'm';
    return `https://www.rottentomatoes.com/${segment}/${vanity}`;
}

/**
 * Look up an RT page URL for a title + year.
 * Returns null when no reasonable match is found.
 */
export async function lookupRottenTomatoes(
    title: string,
    year: number,
    kind: MediaKind = 'movie'
): Promise<RTLookupResult | null> {
    const name = title.trim();
    if (!name || !Number.isFinite(year)) return null;

    const key = cacheKey(kind, name, year);
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
    }

    try {
        const response = await fetch(ALGOLIA_URL, {
            method: 'POST',
            headers: ALGOLIA_HEADERS,
            body: JSON.stringify({
                requests: [
                    {
                        indexName: 'content_rt',
                        query: name,
                        params: 'filters=isEmsSearchable%20%3D%201&hitsPerPage=20',
                    },
                ],
            }),
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            logger.debug(`[RT] Algolia HTTP ${response.status} for "${name}" (${year})`);
            cache.set(key, { value: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
            return null;
        }

        const data = (await response.json()) as RTAlgoliaSearchResponse;
        const contentResults = data.results?.find((r) => r.index === 'content_rt');
        if (!contentResults?.hits?.length) {
            cache.set(key, { value: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
            return null;
        }

        // Prefer hits whose type matches when Algolia provides it
        const typedHits = contentResults.hits.filter((h) => {
            if (!h.type) return true;
            const t = h.type.toLowerCase();
            if (kind === 'tv') return t.includes('tv') || t.includes('series') || t.includes('show');
            return t.includes('movie') || (!t.includes('tv') && !t.includes('series'));
        });
        const pool = typedHits.length > 0 ? typedHits : contentResults.hits;

        const hit = pickHit(pool, name, year);
        if (!hit?.vanity) {
            cache.set(key, { value: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
            return null;
        }

        const result: RTLookupResult = {
            title: hit.title,
            year: Number(hit.releaseYear) || year,
            url: toUrl(kind, hit.vanity),
            criticsScore: hit.rottenTomatoes?.criticsScore ?? null,
            audienceScore: hit.rottenTomatoes?.audienceScore ?? null,
        };

        cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
    } catch (err) {
        logger.debug(`[RT] Lookup failed for "${name}" (${year}): ${(err as Error).message}`);
        cache.set(key, { value: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
        return null;
    }
}
