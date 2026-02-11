/**
 * Media Search Info Modal
 * 
 * Displays detailed media information from search results.
 * Supports Plex, Jellyfin, and Emby with integration-specific branding.
 */

import React from 'react';
import { Star, Calendar, Users, ExternalLink } from 'lucide-react';
import { Modal, Button } from '../../../shared/ui';
import type { MediaItem } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Integration brand colors
const INTEGRATION_COLORS: Record<string, string> = {
    plex: '#E5A00D',      // Plex Yellow
    jellyfin: '#9B59B6',  // Jellyfin Purple
    emby: '#52B54B'       // Emby Green
};

const INTEGRATION_NAMES: Record<string, string> = {
    plex: 'Plex',
    jellyfin: 'Jellyfin',
    emby: 'Emby'
};

// ============================================================================
// PROPS
// ============================================================================

interface MediaSearchInfoModalProps {
    item: MediaItem | null;
    onClose: () => void;
    onOpenInApp?: (item: MediaItem) => void;
    /** z-index for the modal (pass higher value when rendering above other overlays) */
    zIndex?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MediaSearchInfoModal: React.FC<MediaSearchInfoModalProps> = ({
    item,
    onClose,
    onOpenInApp,
    zIndex
}) => {
    if (!item) return null;

    const {
        title,
        year,
        mediaType,
        posterUrl,
        summary,
        rating,
        genres,
        actors,
        directors,
        integrationType,
        integrationName
    } = item;

    const brandColor = INTEGRATION_COLORS[integrationType] || INTEGRATION_COLORS.plex;
    const appName = INTEGRATION_NAMES[integrationType] || integrationName;

    const handleOpenInApp = () => {
        if (onOpenInApp) {
            onOpenInApp(item);
        }
    };

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg" zIndex={zIndex}>

            <Modal.Header title="Media Info" />
            <Modal.Body>
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
                                    src={`${posterUrl}?size=lg`}
                                    alt={title || 'Media poster'}
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
                                {title || 'Unknown Title'}
                            </h2>

                            {/* Media Type Badge */}
                            <div style={{
                                display: 'inline-block',
                                padding: '0.125rem 0.5rem',
                                background: 'var(--bg-hover)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                marginBottom: '0.75rem'
                            }}>
                                {mediaType === 'show' ? 'TV Series' : 'Movie'}
                            </div>

                            {/* Metadata Row */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                marginTop: '0.5rem',
                                fontSize: '0.9rem'
                            }}>
                                {year && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                        <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span>{year}</span>
                                    </div>
                                )}
                                {rating && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                        <Star size={14} style={{ color: 'var(--warning)' }} />
                                        <span>{rating.toFixed(1)}/10</span>
                                    </div>
                                )}
                            </div>

                            {/* Open in App Button */}
                            <Button
                                size="md"
                                textSize="sm"
                                icon={ExternalLink}
                                onClick={handleOpenInApp}
                                customColor={{ background: brandColor, text: '#000' }}
                                style={{ marginTop: '1rem' }}
                            >
                                Open in {appName}
                            </Button>
                        </div>
                    </div>

                    {/* Synopsis */}
                    {summary && (
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
                                {summary}
                            </p>
                        </div>
                    )}

                    {/* Genres */}
                    {genres && genres.length > 0 && (
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
                                {genres.map((genre, idx) => (
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
                    {directors && directors.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{
                                margin: '0 0 0.5rem 0',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-secondary)'
                            }}>
                                Director{directors.length > 1 ? 's' : ''}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                {directors.join(', ')}
                            </p>
                        </div>
                    )}

                    {/* Cast */}
                    {actors && actors.length > 0 && (
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
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '0.5rem'
                            }}>
                                {actors.slice(0, 12).map((actor, idx) => (
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
                                            {actor}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {actors.length > 12 && (
                                <p style={{
                                    marginTop: '0.75rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    fontStyle: 'italic'
                                }}>
                                    +{actors.length - 12} more cast members
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default MediaSearchInfoModal;
