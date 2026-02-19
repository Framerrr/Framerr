import React from 'react';
import './styles.css';

interface ExternalMediaLinksProps {
    tmdbId?: number | null;
    imdbId?: string | null;
    tvdbId?: number | null;
    mediaType?: 'movie' | 'tv' | 'show';
    className?: string;
}

/**
 * Renders TMDB, IMDB, and TVDB link pills for media items.
 * Shows nothing if all IDs are null/undefined.
 */
export const ExternalMediaLinks: React.FC<ExternalMediaLinksProps> = ({
    tmdbId,
    imdbId,
    tvdbId,
    mediaType = 'movie',
    className = '',
}) => {
    if (!tmdbId && !imdbId && !tvdbId) return null;

    // Normalize media type for TMDB URL ('show' → 'tv')
    const tmdbType = mediaType === 'show' ? 'tv' : mediaType;

    return (
        <div className={`external-media-links ${className}`}>
            {tmdbId && (
                <a
                    href={`https://www.themoviedb.org/${tmdbType}/${tmdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-media-link external-media-link--tmdb"
                    title="View on TMDB"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    TMDB
                </a>
            )}
            {imdbId && (
                <a
                    href={`https://www.imdb.com/title/${imdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-media-link external-media-link--imdb"
                    title="View on IMDb"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    IMDb
                </a>
            )}
            {tvdbId && (
                <a
                    href={`https://thetvdb.com/?id=${tvdbId}&tab=series`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-media-link external-media-link--tvdb"
                    title="View on TVDB"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    TVDB
                </a>
            )}
        </div>
    );
};
