/**
 * Tautulli Widget Types
 *
 * Matches the lean shapes sent by server/integrations/tautulli/poller.ts.
 */

export interface TautulliLibrary {
    sectionId: string;
    sectionName: string;
    sectionType: string;
    count: number;
    parentCount: number;
    childCount: number;
    plays: number;
    duration: number;
    lastPlayed: string;
    lastAccessed: number;
    isActive: number;
}

export interface TautulliStatItem {
    title: string;
    totalPlays: number;
    totalDuration: number;
    thumb: string;
    ratingKey: number;
    mediaType: string;
    year?: number;
    usersWatched?: string;
    lastPlay?: number;
    sectionId?: number;
    grandparentThumb?: string;
    /** Landscape backdrop from get_home_stats when present */
    art?: string;
    userThumb?: string;
    friendlyName?: string;
}

export interface TautulliStatCategory {
    statId: string;
    statType?: string;
    rows: TautulliStatItem[];
}

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
    parentMediaIndex?: number;
    mediaIndex?: number;
    libraryName: string;
    art?: string;
}

export interface TautulliConfig {
    integrationId?: string;
    itemCount?: string;
    showStatsBar?: string;
    statsTimeRange?: string;
    [key: string]: unknown;
}
