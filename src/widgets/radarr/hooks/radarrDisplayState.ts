/**
 * radarrDisplayState - 7-state release-date decision tree
 *
 * Pure, standalone functions implementing docs/private/widgets/WIDGET_REDESIGN_MEDIA.md §1.4.
 * Kept independently callable (and testable) rather than inlined into the
 * SSE `onData` callback.
 */

import type { MovieDisplayInfo, MovieDisplayState, ReleaseTypeVisibility } from '../radarr.types';
import { formatDisplayDate } from '../../_shared/media/format';

const WINDOW_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Sort-order bucket separator. Buckets: 0=state2 (top), 1=state3, 2=states 1/5/6. */
const BUCKET_SIZE = 1e15;

function startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

interface MovieDates {
    inCinemas?: string;
    digitalRelease?: string;
    physicalRelease?: string;
}

/**
 * Computes the 7-state display info for a single movie. Returns null for
 * hidden states (4 and 7).
 *
 * Visibility-flag interaction: a disabled visibility flag makes the
 * corresponding date field behave as if it were absent from the movie's
 * data entirely — this can hide the movie outright (e.g. a movie whose only
 * qualifying state was state 6 disappears when `showPhysical` is false), not
 * just hide its pill cosmetically.
 */
export function computeMovieDisplayState(
    movie: MovieDates,
    today: Date,
    visibility: ReleaseTypeVisibility
): MovieDisplayInfo | null {
    const todayMs = startOfDay(today).getTime();

    const icRaw = visibility.showCinema ? movie.inCinemas : undefined;
    const dRaw = visibility.showDigital ? movie.digitalRelease : undefined;
    const pRaw = visibility.showPhysical ? movie.physicalRelease : undefined;

    const icMs = icRaw ? startOfDay(new Date(icRaw)).getTime() : null;
    const dMs = dRaw ? startOfDay(new Date(dRaw)).getTime() : null;
    const pMs = pRaw ? startOfDay(new Date(pRaw)).getTime() : null;

    // State 2: in cinemas today — absolute top of the list.
    if (icMs !== null && icMs === todayMs) {
        return { state: 2, displayDate: icRaw!, displayType: 'cinema', sortKey: 0 };
    }

    // State 1: in cinemas, future date.
    if (icMs !== null && icMs > todayMs) {
        return { state: 1, displayDate: icRaw!, displayType: 'cinema', sortKey: 2 * BUCKET_SIZE + icMs };
    }

    // States 3/4: in cinemas already (past), digital date still TBA.
    if (icMs !== null && icMs < todayMs && dMs === null) {
        const daysSince = (todayMs - icMs) / MS_PER_DAY;
        if (daysSince <= WINDOW_DAYS) {
            // State 3: sorts above states 1/5/6, most-recently-opened first.
            return { state: 3, displayDate: null, displayType: 'cinema', sortKey: 1 * BUCKET_SIZE - icMs };
        }
        // State 4: theatrical run considered over — hidden, terminal (no further checks).
        return null;
    }

    // State 5: digital date is the next milestone (any prior IC state — past, TBA, or absent).
    if (dMs !== null && dMs > todayMs) {
        return { state: 5, displayDate: dRaw!, displayType: 'digital', sortKey: 2 * BUCKET_SIZE + dMs };
    }

    // State 6: on disc — IC and D both past/TBA/absent, physical date is the next milestone.
    if (pMs !== null && pMs > todayMs) {
        return { state: 6, displayDate: pRaw!, displayType: 'physical', sortKey: 2 * BUCKET_SIZE + pMs };
    }

    // State 7: all relevant dates are past or TBA — nothing left to anticipate.
    return null;
}

type StrictSortField = 'inCinemas' | 'digitalRelease' | 'physicalRelease';

const STRICT_FIELD_TO_TYPE: Record<StrictSortField, MovieDisplayInfo['displayType']> = {
    inCinemas: 'cinema',
    digitalRelease: 'digital',
    physicalRelease: 'physical',
};

/**
 * Strict single-date-type filter/sort for `sortBy: 'cinema' | 'digital' | 'physical'`.
 * Hides movies lacking a non-past date of that specific type entirely (spec §1.8) —
 * this does not fall back to the 7-state tree.
 */
export function filterAndSortByStrictDate<T extends MovieDates>(
    movies: T[],
    field: StrictSortField,
    today: Date,
    visible: boolean
): Array<{ movie: T; display: MovieDisplayInfo }> {
    if (!visible) return [];
    const todayMs = startOfDay(today).getTime();

    return movies
        .map(movie => {
            const raw = movie[field];
            if (!raw) return null;
            const ms = startOfDay(new Date(raw)).getTime();
            if (ms < todayMs) return null;
            const display: MovieDisplayInfo = {
                state: 1 as MovieDisplayState,
                displayDate: raw,
                displayType: STRICT_FIELD_TO_TYPE[field],
                sortKey: ms,
            };
            return { movie, display };
        })
        .filter((entry): entry is { movie: T; display: MovieDisplayInfo } => entry !== null)
        .sort((a, b) => a.display.sortKey - b.display.sortKey);
}

export interface PillDisplayProps {
    type: 'cinema' | 'digital' | 'physical';
    date: string;
    dimmed: boolean;
}

/**
 * Resolves the label/dimmed-state a ReleasePill should show for a computed
 * MovieDisplayInfo. Centralized so Hero/mini-cards never disagree on how a
 * given state renders.
 *
 * Special-cases state 3 ("in cinemas, digital date still TBA") — its
 * `displayDate` is null because there is no *next* date to anticipate, but
 * that must not read as "cinema release TBA" since we know for certain it's
 * out now. `compact` swaps the label for a shorter one that fits small cards.
 */
export function getPillDisplayProps(
    display: MovieDisplayInfo | null,
    opts: { compact?: boolean } = {}
): PillDisplayProps | null {
    if (!display || !display.displayType) {
        return null;
    }
    if (display.state === 3) {
        return { type: display.displayType, date: opts.compact ? 'Now' : 'Now Playing', dimmed: false };
    }
    return {
        type: display.displayType,
        date: formatDisplayDate(display.displayDate),
        dimmed: !display.displayDate,
    };
}

interface AttentionDateFields {
    digitalRelease?: string;
    physicalRelease?: string;
    inCinemas?: string;
}

export interface AttentionDisplayInfo {
    type: 'cinema' | 'digital' | 'physical';
    /** Raw ISO date string for the resolved milestone — always non-null. */
    date: string;
}

/**
 * Resolves the single most-advanced release milestone a Needs Attention movie
 * (already released or in cinemas — never a future/TBA movie) has reached.
 *
 * This exists because Radarr's own `/wanted/missing` and `/wanted/cutoff`
 * sort-by-date compares whichever date field each movie happens to have set —
 * a movie's digitalRelease against another movie's inCinemas — with no
 * normalization. That produces the exact confusing order reported: dates from
 * different milestones interleaved as if they were comparable. Digital/physical
 * take precedence over cinema-only because they represent a later, more
 * "complete" release milestone.
 */
export function getAttentionReferenceDate(movie: AttentionDateFields): AttentionDisplayInfo | null {
    if (movie.digitalRelease) return { type: 'digital', date: movie.digitalRelease };
    if (movie.physicalRelease) return { type: 'physical', date: movie.physicalRelease };
    if (movie.inCinemas) return { type: 'cinema', date: movie.inCinemas };
    return null;
}

/**
 * Sorts Needs Attention movies by their normalized reference date, most
 * recently released first. Movies with no known date at all (shouldn't
 * normally happen given upstream status filtering) sort last rather than
 * being interleaved unpredictably.
 */
export function sortByAttentionReferenceDate<T extends AttentionDateFields>(movies: T[]): T[] {
    return [...movies].sort((a, b) => {
        const refA = getAttentionReferenceDate(a);
        const refB = getAttentionReferenceDate(b);
        if (!refA && !refB) return 0;
        if (!refA) return 1;
        if (!refB) return -1;
        return new Date(refB.date).getTime() - new Date(refA.date).getTime();
    });
}

/** ReleasePill props for a Needs Attention movie's resolved reference date. */
export function getAttentionPillProps(movie: AttentionDateFields): PillDisplayProps | null {
    const ref = getAttentionReferenceDate(movie);
    if (!ref) return null;
    return { type: ref.type, date: formatDisplayDate(ref.date), dimmed: false };
}
