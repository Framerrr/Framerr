import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// TAUTULLI POLLER
// ============================================================================

/** Main polling interval — libraries change slowly */
export const intervalMs = 60000; // 60 seconds

// ============================================================================
// TYPES — Lean shapes sent to frontend via SSE
// ============================================================================

/** Library info from get_libraries_table */
export interface TautulliLibrary {
    sectionId: string;
    sectionName: string;
    sectionType: string;  // 'movie' | 'show' | 'artist' | 'photo'
    count: number;        // Items (movies, shows, artists)
    parentCount: number;  // Seasons, albums
    childCount: number;   // Episodes, tracks
    plays: number;
    duration: number;     // Total watch time in seconds
    lastPlayed: string;
    lastAccessed: number; // Unix timestamp
    isActive: number;
}

/** Top/popular item from get_home_stats */
export interface TautulliStatItem {
    title: string;
    totalPlays: number;
    totalDuration: number;
    thumb: string;           // Plex thumb path for pms_image_proxy
    ratingKey: number;
    mediaType: string;
    year?: number;
    usersWatched?: string;
    lastPlay?: number;
    sectionId?: number;
    grandparentThumb?: string;
    userThumb?: string;      // User avatar for top_users
    friendlyName?: string;   // Username for top_users
}

/** Stat category from get_home_stats */
export interface TautulliStatCategory {
    statId: string;
    statType?: string;
    rows: TautulliStatItem[];
}

/** Recently added item from get_recently_added */
export interface TautulliRecentItem {
    title: string;
    fullTitle: string;
    year: string;
    mediaType: string;
    addedAt: string;
    thumb: string;
    ratingKey: string;
    grandparentTitle?: string;
    grandparentThumb?: string;
    parentTitle?: string;
    parentMediaIndex?: number;  // Season number
    mediaIndex?: number;        // Episode number
    libraryName: string;
    sectionId: string;
}

// ============================================================================
// HELPER — call Tautulli API
// ============================================================================

async function callTautulli(
    instance: PluginInstance,
    cmd: string,
    params: Record<string, unknown> = {}
): Promise<unknown> {
    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;
    const baseUrl = translateHostUrl(url);

    const response = await axios.get(`${baseUrl}/api/v2`, {
        params: { apikey: apiKey, cmd, ...params },
        httpsAgent,
        timeout: 15000,
    });

    const tautulliResponse = response.data?.response;
    if (tautulliResponse?.result === 'success') {
        return tautulliResponse.data;
    }
    throw new Error(tautulliResponse?.message || `Tautulli ${cmd} failed`);
}

// ============================================================================
// MAIN POLL — Libraries (60s)
// ============================================================================

/**
 * Poll Tautulli for library statistics.
 * Returns lean library data for SSE delivery.
 */
export async function poll(instance: PluginInstance): Promise<TautulliLibrary[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const data = await callTautulli(instance, 'get_libraries_table', {
        length: 50,
        order_column: 'section_name',
        order_dir: 'asc',
    }) as { data?: Record<string, unknown>[] };

    const rawLibs = data?.data || [];

    // Deduplicate by section_id — Tautulli can return duplicate rows
    const seen = new Set<string>();
    const uniqueLibs = rawLibs.filter((lib: Record<string, unknown>) => {
        const id = String(lib.section_id || '');
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    return uniqueLibs.map((lib: Record<string, unknown>) => ({
        sectionId: String(lib.section_id || ''),
        sectionName: String(lib.section_name || ''),
        sectionType: String(lib.section_type || '').toLowerCase(),
        count: Number(lib.count) || 0,
        parentCount: Number(lib.parent_count) || 0,
        childCount: Number(lib.child_count) || 0,
        plays: Number(lib.plays) || 0,
        duration: Number(lib.duration) || 0,
        lastPlayed: String(lib.last_played || ''),
        lastAccessed: Number(lib.last_accessed) || 0,
        isActive: Number(lib.is_active) || 0,
    }));
}

// ============================================================================
// STATS SUBTYPE (5 min)
// ============================================================================

export const statsIntervalMs = 300000; // 5 minutes

/**
 * Poll Tautulli for home stats (top movies, TV, users, etc.).
 * Trims response to only fields the frontend needs.
 */
export async function pollStats(instance: PluginInstance): Promise<TautulliStatCategory[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const data = await callTautulli(instance, 'get_home_stats', {
        stats_count: 20,
        time_range: 30,
        stats_type: 'plays',
    });

    if (!Array.isArray(data)) return [];

    return data.map((category: Record<string, unknown>) => ({
        statId: String(category.stat_id || ''),
        statType: category.stat_type ? String(category.stat_type) : undefined,
        rows: (Array.isArray(category.rows) ? category.rows : []).map((item: Record<string, unknown>) => ({
            title: String(item.title || item.grandparent_title || ''),
            totalPlays: Number(item.total_plays) || 0,
            totalDuration: Number(item.total_duration) || 0,
            thumb: String(item.thumb || item.grandparent_thumb || ''),
            ratingKey: Number(item.rating_key) || 0,
            mediaType: String(item.media_type || ''),
            year: item.year ? Number(item.year) : undefined,
            usersWatched: item.users_watched ? String(item.users_watched) : undefined,
            lastPlay: item.last_play ? Number(item.last_play) : undefined,
            sectionId: item.section_id ? Number(item.section_id) : undefined,
            grandparentThumb: item.grandparent_thumb ? String(item.grandparent_thumb) : undefined,
            userThumb: item.user_thumb ? String(item.user_thumb) : undefined,
            friendlyName: item.friendly_name ? String(item.friendly_name) : undefined,
        })),
    }));
}

// ============================================================================
// RECENTLY ADDED SUBTYPE (5 min)
// ============================================================================

export const recentIntervalMs = 300000; // 5 minutes

/**
 * Poll Tautulli for recently added items.
 */
export async function pollRecent(instance: PluginInstance): Promise<TautulliRecentItem[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const data = await callTautulli(instance, 'get_recently_added', {
        count: 20,
    });

    const items = (data as { recently_added?: Record<string, unknown>[] })?.recently_added;
    if (!Array.isArray(items)) return [];

    return items.map((item: Record<string, unknown>) => ({
        title: String(item.title || ''),
        fullTitle: String(item.full_title || item.title || ''),
        year: String(item.year || ''),
        mediaType: String(item.media_type || ''),
        addedAt: String(item.added_at || ''),
        thumb: String(item.thumb || ''),
        ratingKey: String(item.rating_key || ''),
        grandparentTitle: item.grandparent_title ? String(item.grandparent_title) : undefined,
        grandparentThumb: item.grandparent_thumb ? String(item.grandparent_thumb) : undefined,
        parentTitle: item.parent_title ? String(item.parent_title) : undefined,
        parentMediaIndex: item.parent_media_index ? Number(item.parent_media_index) : undefined,
        mediaIndex: item.media_index ? Number(item.media_index) : undefined,
        libraryName: String(item.library_name || ''),
        sectionId: String(item.section_id || ''),
    }));
}

// ============================================================================
// SUBTYPES
// ============================================================================

export const subtypes = {
    stats: {
        intervalMs: statsIntervalMs,
        poll: pollStats,
    },
    recent: {
        intervalMs: recentIntervalMs,
        poll: pollRecent,
    },
};
