/**
 * sonarrDisplayState - pure display-logic helpers for the Sonarr widget.
 *
 * Sonarr episodes have a single airDateUtc/airDate field (unlike Radarr's
 * three release-date types), so this module is intentionally much simpler
 * than radarrDisplayState.ts — no 7-state decision tree is needed here.
 */

import { formatDisplayDate } from '../../_shared/media/format';

export type PremiereType = 'series' | 'season';

/** episodeNumber === 1 → premiere. seasonNumber === 1 → series premiere, else season premiere. Per spec §2.3. */
export function getPremiereType(ep: { seasonNumber?: number; episodeNumber?: number }): PremiereType | null {
    if (ep.episodeNumber !== 1) return null;
    if (ep.seasonNumber === 1) return 'series';
    if (ep.seasonNumber != null && ep.seasonNumber > 1) return 'season';
    return null;
}

export interface EpisodePillProps {
    type: 'tv';
    date: string;
    dimmed: boolean;
}

/** ReleasePill props for an episode's single airDateUtc/airDate field — no 7-state tree needed, unlike Radarr's multi-date movies. */
export function getEpisodePillProps(ep: { airDateUtc?: string; airDate?: string }): EpisodePillProps {
    const dateStr = ep.airDateUtc || ep.airDate;
    return { type: 'tv', date: dateStr ? formatDisplayDate(dateStr) : 'TBA', dimmed: !dateStr };
}

export interface SeasonProgress {
    /** 0-1, capped. */
    fraction: number;
    episodeFileCount: number;
    episodeCount: number;
}

/**
 * Null when statistics are absent/zero/malformed — callers must render
 * nothing (spec's "hidden gracefully"). `statistics` is fed by Sonarr's raw
 * API response (see poller.ts), so subfields are validated as finite numbers
 * here rather than trusted at their declared TypeScript type — a non-numeric
 * or NaN value must not silently produce a broken progress bar.
 */
export function getSeasonProgress(
    statistics: { episodeCount?: number; episodeFileCount?: number } | undefined
): SeasonProgress | null {
    const episodeCount = statistics?.episodeCount;
    const episodeFileCount = statistics?.episodeFileCount;
    if (!Number.isFinite(episodeCount) || (episodeCount as number) <= 0) return null;
    if (!Number.isFinite(episodeFileCount)) return null;
    return {
        fraction: Math.max(0, Math.min(1, (episodeFileCount as number) / (episodeCount as number))),
        episodeFileCount: episodeFileCount as number,
        episodeCount: episodeCount as number,
    };
}

