import React from 'react';
import { Star, Calendar, Building2, Users } from 'lucide-react';
import { Modal } from '../../../shared/ui';
import { widgetFetch } from '../../../utils/widgetFetch';
import logger from '../../../utils/logger';

interface Role {
    tag: string;
    role?: string;
}

// Genre, Director, Writer are returned as string arrays from backend
// No separate interface needed - they are string[]

interface MediaMetadata {
    ratingKey?: string;
    guid?: string;
    year?: number;
    rating?: number;
    contentRating?: string;
    studio?: string;
    summary?: string;
    tagline?: string;
}

interface PlexSession {
    sessionKey?: string;
    Media?: MediaMetadata;
    Role?: Role[];
    Genre?: string[];
    Director?: string[];
    Writer?: string[];
    title?: string;
    grandparentTitle?: string;
    type?: string;
    parentIndex?: number;
    index?: number;
    thumb?: string;
}

interface MediaInfoModalProps {
    session: PlexSession | null;
    integrationId: string;
    onClose: () => void;
}

const MediaInfoModal: React.FC<MediaInfoModalProps> = ({ session, integrationId, onClose }) => {
    const [fullSession, setFullSession] = React.useState<PlexSession | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Fetch full session data from API when modal opens
    React.useEffect(() => {
        if (!session) {
            setLoading(false);
            return;
        }

        const fetchSessionData = async () => {
            try {
                setLoading(true);
                const response = await widgetFetch(`/api/integrations/${integrationId}/proxy/sessions`, 'plex-media-info');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const sessions = data.sessions || [];

                // Find the matching session by sessionKey
                const matchingSession = sessions.find(
                    (s: PlexSession) => s.sessionKey === session.sessionKey
                );

                if (matchingSession) {
                    setFullSession(matchingSession);
                } else {
                    // Session may have ended, use what we have
                    setFullSession(session);
                }
                setError(null);
            } catch (err) {
                logger.error('Failed to fetch session data', { error: err });
                setError((err as Error).message);
                // Fall back to passed session data
                setFullSession(session);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [session?.sessionKey]);

    if (!session) return null;

    // Use fetched data or fall back to passed session
    const displaySession = fullSession || session;
    const { Media, Role, Genre, Director, Writer, title, grandparentTitle, type } = displaySession;
    const displayTitle = type === 'episode' ? grandparentTitle || title : title;
    const subtitle = type === 'episode' && displaySession.parentIndex && displaySession.index
        ? `Season ${displaySession.parentIndex} • Episode ${displaySession.index}`
        : null;

    const posterUrl = displaySession.thumb
        ? `/api/integrations/${integrationId}/proxy${displaySession.thumb}`
        : null;

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg">
            <Modal.Header title="Media Info" />
            <Modal.Body>
                {/* Loading indicator */}
                {loading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                        <div className="w-10 h-10 border-3 border-theme border-t-accent rounded-full animate-spin" />
                        <span className="text-theme-secondary">Loading media info...</span>
                    </div>
                )}

                {/* Main content - only show when not loading */}
                {!loading && (
                    <div className="space-y-6">
                        {/* Poster and Basic Info */}
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {/* Poster */}
                            {posterUrl && (
                                <div style={{
                                    width: '150px',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                    <img
                                        src={posterUrl}
                                        alt={displayTitle || 'Media poster'}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block'
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
                                    {displayTitle || 'Unknown Title'}
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
                                {type === 'episode' && title && (
                                    <p style={{
                                        margin: '0 0 0.75rem 0',
                                        fontSize: '1.1rem',
                                        fontWeight: 500,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {title}
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
                                    {Media?.year && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{Media.year}</span>
                                        </div>
                                    )}
                                    {Media?.rating && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{Media.rating}/10</span>
                                        </div>
                                    )}
                                    {Media?.contentRating && (
                                        <div style={{
                                            padding: '0.125rem 0.5rem',
                                            background: 'var(--bg-hover)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {Media.contentRating}
                                        </div>
                                    )}
                                </div>

                                {/* Studio */}
                                {Media?.studio && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.75rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <Building2 size={14} />
                                        <span>{Media.studio}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Synopsis */}
                        {Media?.summary && (
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
                                    {Media.summary}
                                </p>
                            </div>
                        )}

                        {/* Genres */}
                        {Genre && Genre.length > 0 && (
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
                                    {Genre.map((genre, idx) => (
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
                        {Director && Director.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Director{Director.length > 1 ? 's' : ''}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    {Director.join(', ')}
                                </p>
                            </div>
                        )}

                        {/* Writers */}
                        {Writer && Writer.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Writer{Writer.length > 1 ? 's' : ''}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    {Writer.join(', ')}
                                </p>
                            </div>
                        )}

                        {/* Cast - Text Only */}
                        {Role && Role.length > 0 && (
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
                                    {Role.slice(0, 12).map((actor, idx) => (
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
                                                {actor.tag}
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
                                {Role.length > 12 && (
                                    <p style={{
                                        marginTop: '0.75rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        fontStyle: 'italic'
                                    }}>
                                        +{Role.length - 12} more cast members
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
