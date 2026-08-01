import React from 'react';
import { Star, Calendar, Building2 } from 'lucide-react';
import {
    Modal,
    MediaPoster,
    MediaHeroCol,
    MediaTypeBadge,
    MediaSynopsis,
    MediaGenres,
    MediaPeople,
    MediaCast,
} from '../../../shared/ui';
import { ExternalMediaLinks } from '../../../shared/ui/ExternalMediaLinks';
import api from '../../../api/client';
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface CastMember {
    name: string;
    role?: string;
}

interface ItemMetadata {
    title: string;
    originalTitle?: string;
    year?: number;
    rating?: number;
    contentRating?: string;
    studio?: string;
    summary?: string;
    tagline?: string;
    genres: string[];
    directors: string[];
    writers: string[];
    cast: CastMember[];
    thumb?: string;
}

interface MediaInfoModalProps {
    /** The item ID (ratingKey for Plex, Id for Jellyfin/Emby) */
    itemId: string;
    /** Integration instance ID for building the API URL */
    integrationId: string;
    /** Media type for display formatting */
    mediaType?: 'movie' | 'episode' | 'track' | 'unknown';
    /** Episode title (for episodes, the actual episode name) */
    episodeTitle?: string;
    /** Season/episode info for subtitle display */
    seasonNumber?: number;
    episodeNumber?: number;
    /** Initial title from session data — shown immediately before fetch completes */
    initialTitle?: string;
    /** Initial thumb URL from session data — shown immediately before fetch completes */
    initialThumb?: string;
    onClose: () => void;
}

// ============================================================================
// METADATA CACHE
// Module-level cache so reopening the modal for the same title while it's
// still playing doesn't trigger a redundant API call.
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const metadataCache = new Map<string, CacheEntry<ItemMetadata>>();
const externalIdsCache = new Map<string, CacheEntry<{ tmdbId: number | null; imdbId: string | null }>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MediaInfoModal: React.FC<MediaInfoModalProps> = ({
    itemId,
    integrationId,
    mediaType,
    episodeTitle,
    seasonNumber,
    episodeNumber,
    initialTitle,
    initialThumb,
    onClose
}) => {
    const [metadata, setMetadata] = React.useState<ItemMetadata | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [externalIds, setExternalIds] = React.useState<{ tmdbId: number | null; imdbId: string | null }>({ tmdbId: null, imdbId: null });

    // Fetch metadata from unified endpoint (with cache)
    React.useEffect(() => {
        if (!itemId || !integrationId) {
            setLoading(false);
            return;
        }

        const cacheKey = `${integrationId}:${itemId}`;
        const cached = getCached(metadataCache, cacheKey);
        if (cached) {
            setMetadata(cached);
            setLoading(false);
            return;
        }

        const fetchMetadata = async () => {
            try {
                setLoading(true);
                const data = await api.get<ItemMetadata>(
                    `/api/integrations/${integrationId}/item-metadata/${itemId}`,
                    { headers: { 'X-Widget-Type': 'media-info' } }
                );
                metadataCache.set(cacheKey, { data, timestamp: Date.now() });
                setMetadata(data);
                setError(null);
            } catch (err) {
                logger.error('Failed to fetch item metadata', { error: err });
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();
    }, [itemId, integrationId]);

    // Fetch external IDs (TMDB/IMDB) — with cache
    React.useEffect(() => {
        if (!itemId || !integrationId) return;

        const cacheKey = `ext:${integrationId}:${itemId}`;
        const cached = getCached(externalIdsCache, cacheKey);
        if (cached) {
            setExternalIds(cached);
            return;
        }

        api.get<{ tmdbId: number | null; imdbId: string | null }>(`/api/media/external-ids?itemKey=${itemId}&integrationId=${integrationId}`)
            .then(data => {
                if (data) {
                    externalIdsCache.set(cacheKey, { data, timestamp: Date.now() });
                    setExternalIds(data);
                }
            })
            .catch(() => { });
    }, [itemId, integrationId]);

    if (!itemId) return null;

    // Display logic — use metadata when available, fall back to initial props
    const displayTitle = metadata?.title || initialTitle || 'Unknown Title';
    const displayThumb = metadata?.thumb || initialThumb;
    const subtitle = mediaType === 'episode' && seasonNumber && episodeNumber
        ? `Season ${seasonNumber} • Episode ${episodeNumber}`
        : null;
    const hasContent = metadata || initialTitle;

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg" fixedHeight>
            <Modal.Header title="Media Info" />
            <Modal.Body>
                {/* Loading indicator — only shown if we have NO initial data at all */}
                {!hasContent && loading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                        <div className="w-10 h-10 border-3 border-theme border-t-accent rounded-full animate-spin" />
                        <span className="text-theme-secondary">Loading media info...</span>
                    </div>
                )}

                {/* Error state — only shown if we have no data at all */}
                {!hasContent && !loading && error && (
                    <div className="flex flex-col items-center justify-center gap-2 py-12">
                        <span className="text-theme-secondary">Failed to load media info</span>
                    </div>
                )}

                {/* Main content — shown immediately with initial data, enriched with metadata */}
                {hasContent && (
                    <div className="space-y-6">
                        <div className="media-hero">
                            <MediaPoster
                                src={displayThumb}
                                alt={displayTitle}
                                onImgError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />

                            <MediaHeroCol>
                                <h2 className="media-hero__title">{displayTitle}</h2>
                                {subtitle ? (
                                    <p className="media-hero__subtitle">{subtitle}</p>
                                ) : null}
                                {mediaType === 'episode' && episodeTitle ? (
                                    <p className="media-hero__subtitle" style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {episodeTitle}
                                    </p>
                                ) : null}

                                <MediaTypeBadge type={mediaType === 'episode' || mediaType === 'track' ? 'tv' : 'movie'} />

                                <div className="media-hero__meta">
                                    {metadata?.year && (
                                        <div className="media-hero__meta-item">
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{metadata.year}</span>
                                        </div>
                                    )}
                                    {metadata?.rating && (
                                        <div className="media-hero__meta-item">
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{metadata.rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {metadata?.contentRating && (
                                        <div className="media-type-badge" style={{ fontSize: '0.8rem' }}>
                                            {metadata.contentRating}
                                        </div>
                                    )}
                                    {metadata?.studio && (
                                        <div className="media-hero__meta-item">
                                            <Building2 size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{metadata.studio}</span>
                                        </div>
                                    )}
                                </div>

                                <ExternalMediaLinks
                                    tmdbId={externalIds.tmdbId}
                                    imdbId={externalIds.imdbId}
                                    title={displayTitle}
                                    year={metadata?.year}
                                    mediaType={mediaType === 'episode' || mediaType === 'track' ? 'tv' : 'movie'}
                                />
                            </MediaHeroCol>
                        </div>

                        {/* Shared: tagline → synopsis → genres → directors → writers → cast */}
                        {metadata?.tagline ? (
                            <div style={{
                                fontStyle: 'italic',
                                color: 'var(--text-secondary)',
                                fontSize: '1rem',
                                borderLeft: '3px solid var(--accent)',
                                paddingLeft: '1rem'
                            }}>
                                "{metadata.tagline}"
                            </div>
                        ) : null}
                        {metadata?.summary ? <MediaSynopsis text={metadata.summary} /> : null}
                        {metadata?.genres?.length ? <MediaGenres genres={metadata.genres} /> : null}
                        {metadata?.directors?.length ? <MediaPeople label="Director" names={metadata.directors} /> : null}
                        {metadata?.writers?.length ? <MediaPeople label="Writer" names={metadata.writers} /> : null}
                        {metadata?.cast?.length ? <MediaCast members={metadata.cast} /> : null}
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default MediaInfoModal;
