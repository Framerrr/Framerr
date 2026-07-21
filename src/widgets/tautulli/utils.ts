/**
 * Tautulli Widget Helpers
 *
 * Pure formatting/lookup functions with no widget-specific state coupling —
 * kept at the widget root rather than a `hooks/` folder since none of these
 * are React hooks (unlike Radarr/Sonarr's `hooks/*DisplayState.ts`, which
 * resolve stateful, data-model-specific display decisions).
 */

import type { TautulliStatItem } from './tautulli.types';

/** Format seconds into human-readable duration */
export function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    if (hours < 24) return `${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days < 7) return `${days}d ${remainingHours}h`;
    return `${days}d`;
}

/** Format large numbers compactly */
export function formatCount(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

/** Build image proxy URL for a thumb/art path */
export function tautulliImageUrl(
    integrationId: string | undefined,
    thumb: string,
    width = 300,
    height = 450,
    opts?: { fallback?: string | false },
): string | null {
    if (!integrationId || !thumb) return null;
    let fallbackParam = '';
    if (opts?.fallback === false) {
        fallbackParam = '&fallback=none';
    } else if (typeof opts?.fallback === 'string' && opts.fallback.length > 0) {
        fallbackParam = `&fallback=${encodeURIComponent(opts.fallback)}`;
    }
    return `/api/integrations/${integrationId}/proxy/tautulli-image?img=${encodeURIComponent(thumb)}&width=${width}&height=${height}${fallbackParam}`;
}

/**
 * Landscape backdrop via rating key (no invented /thumb/→/art/ path).
 * get_home_stats often omits `art` and only returns a poster thumb; rewriting
 * keeps the thumb cache-buster and 400s. Tautulli builds
 * /library/metadata/{ratingKey}/art when given rating_key + fallback=art.
 */
export function tautulliArtByRatingKey(
    integrationId: string | undefined,
    ratingKey: number | string | undefined | null,
    width = 960,
    height = 540,
): string | null {
    if (!integrationId || ratingKey == null || ratingKey === '' || ratingKey === 0) return null;
    return `/api/integrations/${integrationId}/proxy/tautulli-image?ratingKey=${encodeURIComponent(String(ratingKey))}&imgType=art&width=${width}&height=${height}`;
}

/**
 * Prefer a landscape art path for 16:9 featured cards.
 * get_home_stats often only returns poster `thumb`; Plex art usually lives at
 * the same metadata path with `/thumb/` → `/art/`. Prefer grandparent (show)
 * thumb for top_tv where episode thumb is empty.
 */
export function tautulliBackdropPath(...candidates: Array<string | undefined | null>): string {
    for (const path of candidates) {
        if (!path) continue;
        if (path.includes('/art/')) return path;
        if (path.includes('/thumb/')) return path.replace('/thumb/', '/art/');
        return path;
    }
    return '';
}

/** Format subtitle based on media type */
export function formatStatSubtitle(item: TautulliStatItem): string {
    if (item.year) return String(item.year);
    return '';
}

/** Format time-ago from unix timestamp */
export function formatTimeAgo(unixStr: string): string {
    const ts = Number(unixStr);
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
}
