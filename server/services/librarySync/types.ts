/**
 * Library Sync Types
 * 
 * All interfaces used by the library sync system.
 */

// ============================================================================
// SYNC STATUS
// ============================================================================

export interface SyncStatus {
    integrationInstanceId: string;
    totalItems: number;
    indexedItems: number;
    lastSyncStarted: string | null;
    lastSyncCompleted: string | null;
    syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
    errorMessage: string | null;
}

// ============================================================================
// PLEX TYPES
// ============================================================================

export interface PlexLibrarySection {
    key: string;
    title: string;
    type: string;
}

export interface PlexMediaItem {
    ratingKey: string;
    title: string;
    originalTitle?: string;
    titleSort?: string;
    year?: number;
    thumb?: string;
    art?: string;
    summary?: string;
    Genre?: Array<{ tag: string }>;
    studio?: string;
    Director?: Array<{ tag: string }>;
    Role?: Array<{ tag: string }>;
    rating?: number;
    contentRating?: string;
    duration?: number;
    addedAt?: number;
    updatedAt?: number;
    Guid?: Array<{ id: string }>;
}

// ============================================================================
// JELLYFIN / EMBY TYPES (identical API heritage)
// ============================================================================

export interface JellyfinMediaItem {
    Id: string;
    Name: string;
    OriginalTitle?: string;
    SortName?: string;
    ProductionYear?: number;
    ImageTags?: { Primary?: string };
    BackdropImageTags?: string[];
    Overview?: string;
    Genres?: string[];
    Studios?: Array<{ Name: string }>;
    People?: Array<{ Name: string; Type: string }>;
    CommunityRating?: number;
    OfficialRating?: string;
    RunTimeTicks?: number;
    DateCreated?: string;
    ProviderIds?: { Tmdb?: string; Imdb?: string };
    Type: string;
}

export type EmbyMediaItem = JellyfinMediaItem;

export interface JellyfinView {
    Id: string;
    Name: string;
    CollectionType?: string;
}
