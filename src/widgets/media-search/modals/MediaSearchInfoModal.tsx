/**
 * Media Search Info Modal
 *
 * Displays detailed media information from search results.
 * Supports Plex, Jellyfin, and Emby with integration-specific branding.
 */

import React from 'react';
import { Star, Calendar } from 'lucide-react';
import {
    Modal,
    Button,
    MediaPoster,
    MediaHeroCol,
    MediaTypeBadge,
    MediaSynopsis,
    MediaGenres,
    MediaPeople,
    MediaCast,
} from '../../../shared/ui';
import { ExternalMediaLinks } from '../../../shared/ui/ExternalMediaLinks';
import { getIconComponent } from '../../../utils/iconUtils';
import type { MediaItem } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const INTEGRATION_COLORS: Record<string, string> = {
    plex: '#E5A00D',
    jellyfin: '#9B59B6',
    emby: '#52B54B',
};

const INTEGRATION_NAMES: Record<string, string> = {
    plex: 'Plex',
    jellyfin: 'Jellyfin',
    emby: 'Emby',
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
    zIndex,
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
        integrationName,
    } = item;

    const brandColor = INTEGRATION_COLORS[integrationType] || INTEGRATION_COLORS.plex;
    const appName = INTEGRATION_NAMES[integrationType] || integrationName;

    const handleOpenInApp = () => {
        if (onOpenInApp) {
            onOpenInApp(item);
        }
    };

    const posterSrc = posterUrl
        ? (posterUrl.includes('size=')
            ? posterUrl
            : `${posterUrl}${posterUrl.includes('?') ? '&' : '?'}size=lg`)
        : null;

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="lg" zIndex={zIndex}>
            <Modal.Header title="Media Info" />
            <Modal.Body>
                <div className="space-y-6">
                    <div className="media-hero">
                        <MediaPoster
                            src={posterSrc}
                            alt={title || 'Media poster'}
                        />

                        <MediaHeroCol>
                            <h2 className="media-hero__title">{title || 'Unknown Title'}</h2>

                            <MediaTypeBadge type={mediaType === 'show' ? 'tv' : 'movie'} />

                            <div className="media-hero__meta">
                                {year && (
                                    <div className="media-hero__meta-item">
                                        <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span>{year}</span>
                                    </div>
                                )}
                                {rating && (
                                    <div className="media-hero__meta-item">
                                        <Star size={14} style={{ color: 'var(--warning)' }} />
                                        <span>{rating.toFixed(1)}/10</span>
                                    </div>
                                )}
                            </div>

                            <ExternalMediaLinks
                                tmdbId={item.tmdbId}
                                imdbId={item.imdbId}
                                title={title}
                                year={year}
                                mediaType={item.mediaType === 'show' ? 'tv' : 'movie'}
                            />

                            <div>
                                <Button
                                    size="md"
                                    textSize="sm"
                                    icon={getIconComponent(`system:${integrationType}`)}
                                    onClick={handleOpenInApp}
                                    customColor={{ background: brandColor, text: '#000' }}
                                >
                                    Open in {appName}
                                </Button>
                            </div>
                        </MediaHeroCol>
                    </div>

                    {summary ? <MediaSynopsis text={summary} /> : null}
                    {genres?.length ? <MediaGenres genres={genres} /> : null}
                    {directors?.length ? <MediaPeople label="Director" names={directors} /> : null}
                    {actors?.length ? <MediaCast members={actors} /> : null}
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default MediaSearchInfoModal;
