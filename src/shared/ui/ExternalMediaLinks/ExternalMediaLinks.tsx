import React, { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { getIconComponent } from '../../../utils/iconUtils';
import './styles.css';

interface ExternalMediaLinksProps {
    tmdbId?: number | null;
    imdbId?: string | null;
    tvdbId?: number | null;
    /** Title + year enable Overseerr-style RT Algolia lookup */
    title?: string | null;
    year?: number | null;
    mediaType?: 'movie' | 'tv' | 'show';
    className?: string;
}

interface RTLookupResponse {
    url: string;
}

const rtUrlCache = new Map<string, string | null>();

const ICON_SIZE = 13;
const TmdbIcon = getIconComponent('system:tmdb');
const ImdbIcon = getIconComponent('system:imdb');
const TvdbIcon = getIconComponent('system:tvdb');
const RtIcon = getIconComponent('system:rotten-tomatoes');

/**
 * Renders TMDB, IMDb, TVDB, and (when title+year available) Rotten Tomatoes link pills.
 * Brand marks come from the system icon set (`system:tmdb`, etc.).
 * RT URL is resolved via Framerr's Overseerr-style Algolia lookup.
 */
export const ExternalMediaLinks: React.FC<ExternalMediaLinksProps> = ({
    tmdbId,
    imdbId,
    tvdbId,
    title,
    year,
    mediaType = 'movie',
    className = '',
}) => {
    const tmdbType = mediaType === 'show' ? 'tv' : mediaType;
    const rtKind = tmdbType === 'tv' ? 'tv' : 'movie';
    const [rtUrl, setRtUrl] = useState<string | null>(null);

    useEffect(() => {
        const trimmed = title?.trim();
        if (!trimmed || year == null || !Number.isFinite(year) || year < 1800) {
            setRtUrl(null);
            return;
        }

        const key = `${rtKind}:${year}:${trimmed.toLowerCase()}`;
        if (rtUrlCache.has(key)) {
            setRtUrl(rtUrlCache.get(key) ?? null);
            return;
        }

        let cancelled = false;
        const params = new URLSearchParams({
            title: trimmed,
            year: String(year),
            type: rtKind,
        });

        api.get<RTLookupResponse>(`/api/media/rotten-tomatoes?${params}`)
            .then((data) => {
                const url = data?.url ?? null;
                rtUrlCache.set(key, url);
                if (!cancelled) setRtUrl(url);
            })
            .catch(() => {
                rtUrlCache.set(key, null);
                if (!cancelled) setRtUrl(null);
            });

        return () => {
            cancelled = true;
        };
    }, [title, year, rtKind]);

    if (!tmdbId && !imdbId && !tvdbId && !rtUrl) return null;

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
                    <TmdbIcon size={ICON_SIZE} className="external-media-link__icon" />
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
                    <ImdbIcon size={ICON_SIZE} className="external-media-link__icon" />
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
                    <TvdbIcon size={ICON_SIZE} className="external-media-link__icon" />
                    TVDB
                </a>
            )}
            {rtUrl && (
                <a
                    href={rtUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-media-link external-media-link--rt"
                    title="View on Rotten Tomatoes"
                >
                    <RtIcon size={ICON_SIZE} className="external-media-link__icon" />
                    RT
                </a>
            )}
        </div>
    );
};
