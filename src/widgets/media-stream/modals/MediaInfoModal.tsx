import React from 'react';
import { Star, Calendar, Building2, Users } from 'lucide-react';
import { Modal } from '../../../shared/ui';
import { ExternalMediaLinks } from '../../../shared/ui/ExternalMediaLinks';
import { widgetFetch } from '../../../utils/widgetFetch';
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
                const response = await widgetFetch(
                    `/api/integrations/${integrationId}/item-metadata/${itemId}`,
                    'media-info'
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data: ItemMetadata = await response.json();
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

        fetch(`/api/media/external-ids?itemKey=${itemId}&integrationId=${integrationId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
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
                        {/* Poster and Basic Info */}
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {/* Poster */}
                            {displayThumb && (
                                <div style={{
                                    width: '150px',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                    <img
                                        src={displayThumb}
                                        alt={displayTitle}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block'
                                        }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}

                            {/* Title and Metadata */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
                                }}>
                                    {displayTitle}
                                </h2>
                                {subtitle && (
                                    <p style={{
                                        margin: '0 0 0.75rem 0',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.95rem'
                                    }}>
                                        {subtitle}
                                    </p>
                                )}
                                {mediaType === 'episode' && episodeTitle && (
                                    <p style={{
                                        margin: '0 0 0.75rem 0',
                                        fontSize: '1.1rem',
                                        fontWeight: 500,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {episodeTitle}
                                    </p>
                                )}

                                {/* Metadata Row */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    marginTop: '0.75rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {metadata?.year && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{metadata.year}</span>
                                        </div>
                                    )}
                                    {metadata?.rating && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{metadata.rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {metadata?.contentRating && (
                                        <div style={{
                                            padding: '0.125rem 0.5rem',
                                            background: 'var(--bg-hover)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {metadata.contentRating}
                                        </div>
                                    )}
                                </div>

                                {/* Studio */}
                                {metadata?.studio && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.75rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Building2 size={14} />
                                        <span>{metadata.studio}</span>
                                    </div>
                                )}

                                <ExternalMediaLinks
                                    tmdbId={externalIds.tmdbId}
                                    imdbId={externalIds.imdbId}
                                    mediaType={mediaType === 'episode' || mediaType === 'track' ? 'tv' : 'movie'}
                                    className="mt-2"
                                />
                            </div>
                        </div>

                        {/* Synopsis */}
                        {metadata?.summary && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Synopsis
                                </h4>
                                <p style={{
                                    margin: 0,
                                    lineHeight: 1.6,
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem'
                                }}>
                                    {metadata.summary}
                                </p>
                            </div>
                        )}

                        {/* Genres */}
                        {metadata?.genres && metadata.genres.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Genres
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {metadata.genres.map((genre, idx) => (
                                        <span
                                            key={idx}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                background: 'var(--bg-hover)',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Directors */}
                        {metadata?.directors && metadata.directors.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Director{metadata.directors.length > 1 ? 's' : ''}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    {metadata.directors.join(', ')}
                                </p>
                            </div>
                        )}

                        {/* Writers */}
                        {metadata?.writers && metadata.writers.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Writer{metadata.writers.length > 1 ? 's' : ''}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    {metadata.writers.join(', ')}
                                </p>
                            </div>
                        )}

                        {/* Cast */}
                        {metadata?.cast && metadata.cast.length > 0 && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.75rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <Users size={14} />
                                    Cast
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: '0.5rem'
                                }}>
                                    {metadata.cast.slice(0, 12).map((actor, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: '0.5rem',
                                                background: 'var(--bg-hover)',
                                                borderRadius: '6px'
                                            }}
                                        >
                                            <div style={{
                                                fontWeight: 500,
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                color: 'var(--text-primary)'
                                            }}>
                                                {actor.name}
                                            </div>
                                            {actor.role && (
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-secondary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    marginTop: '0.125rem'
                                                }}>
                                                    {actor.role}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {metadata.cast.length > 12 && (
                                    <p style={{
                                        marginTop: '0.75rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        fontStyle: 'italic'
                                    }}>
                                        +{metadata.cast.length - 12} more cast members
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default MediaInfoModal;
