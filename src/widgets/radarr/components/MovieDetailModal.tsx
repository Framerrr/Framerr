/**
 * MovieDetailModal - Detail view for a Radarr movie
 * 
 * Hero layout matches RequestInfoModal / EpisodeDetailModal exactly:
 * - 150x225 poster, 1.5rem/700 title, metadata row, status badge, ExternalMediaLinks
 * - Floating X close button (uses Modal's relative content wrapper)
 * - Hidden Dialog.Title/Description for Radix a11y
 * 
 * Two modes:
 * 1. Missing mode: Movie details + search actions in footer
 * 2. Upcoming mode: Movie details + countdown
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Search, Download, ArrowLeft, Check, AlertCircle,
    Loader2, Film, Calendar, Star, Building2, UserCheck
} from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Button } from '@/shared/ui/Button/Button';
import { ExternalMediaLinks } from '@/shared/ui/ExternalMediaLinks';
import type { WantedMovie, CalendarMovie, RadarrRelease, RadarrImage } from '../radarr.types';
import '../styles.css';

// ============================================================================
// TYPES
// ============================================================================

interface MovieDetailModalProps {
    movie: WantedMovie | CalendarMovie | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Trigger auto search (MoviesSearch command) — admin only */
    triggerAutoSearch: (movieIds: number[]) => Promise<boolean>;
    /** Search for releases — admin only */
    searchReleases: (movieId: number) => Promise<RadarrRelease[]>;
    /** Grab a specific release — admin only */
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
    /** Whether the current user is an admin (controls action visibility) */
    userIsAdmin?: boolean;
}

type ModalView = 'info' | 'searching' | 'results';
type AutoSearchState = 'idle' | 'searching' | 'success' | 'error';

// ============================================================================
// HELPERS
// ============================================================================

function formatReleaseDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
}

function formatCountdown(dateStr: string | undefined): string | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 1) return `in ${days} days`;
    if (days === 1) return `in 1 day`;
    if (hours > 1) return `in ${hours} hours`;
    return 'soon';
}

function formatSize(bytes: number): string {
    if (bytes <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function getPosterUrl(
    movie: WantedMovie | CalendarMovie,
    integrationId: string
): string | null {
    const images = movie.images;
    if (!images?.length) return null;

    const poster = images.find((img: RadarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

/** 3-state movie status: available > upcoming > missing */
type MovieStatus = 'available' | 'upcoming' | 'missing';

function getMovieStatus(movie: WantedMovie | CalendarMovie): MovieStatus {
    // If Radarr has the file downloaded → available
    if (movie.hasFile) return 'available';

    // Future digital release → upcoming
    if (movie.digitalRelease && new Date(movie.digitalRelease).getTime() > Date.now()) return 'upcoming';

    // No digital release announced at all → still upcoming (waiting for digital)
    if (!movie.digitalRelease) return 'upcoming';

    // Past digital release + no file → missing
    return 'missing';
}

const STATUS_INFO: Record<MovieStatus, { label: string; color: string }> = {
    available: { label: 'Available', color: 'var(--success)' },
    upcoming: { label: 'Upcoming', color: 'var(--info)' },
    missing: { label: 'Missing', color: 'var(--error)' },
};

// ============================================================================
// COMPONENT
// ============================================================================

const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
    movie,
    integrationId,
    open,
    onOpenChange,
    triggerAutoSearch,
    searchReleases,
    grabRelease,
    userIsAdmin = true,
}) => {
    const [view, setView] = useState<ModalView>('info');
    const [autoSearchState, setAutoSearchState] = useState<AutoSearchState>('idle');
    const [releases, setReleases] = useState<RadarrRelease[]>([]);
    const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);
    const [grabSuccess, setGrabSuccess] = useState<string | null>(null);
    const [overrideGuid, setOverrideGuid] = useState<string | null>(null);
    const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchingText, setSearchingText] = useState('Searching indexers…');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset state when modal opens/closes or movie changes
    useEffect(() => {
        if (open) {
            setView('info');
            setAutoSearchState('idle');
            setReleases([]);
            setGrabbingGuid(null);
            setGrabSuccess(null);
            setOverrideGuid(null);
            setOverrideSuccess(null);
            setSearchError(null);
            setSearchingText('Searching indexers…');
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        }
    }, [open, movie?.id]);

    // 15-second "still searching" text swap
    useEffect(() => {
        if (view === 'searching') {
            setSearchingText('Searching indexers…');
            searchTimerRef.current = setTimeout(() => {
                setSearchingText('Still searching…');
            }, 15000);
        } else {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
                searchTimerRef.current = null;
            }
        }
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
                searchTimerRef.current = null;
            }
        };
    }, [view]);

    // ---------- Actions ----------

    const handleAutoSearch = useCallback(async () => {
        if (!movie || autoSearchState === 'searching') return;

        setAutoSearchState('searching');
        const success = await triggerAutoSearch([movie.id]);

        if (success) {
            setAutoSearchState('success');
            setTimeout(() => setAutoSearchState('idle'), 2500);
        } else {
            setAutoSearchState('error');
            setTimeout(() => setAutoSearchState('idle'), 3000);
        }
    }, [movie, autoSearchState, triggerAutoSearch]);

    const handleInteractiveSearch = useCallback(async () => {
        if (!movie) return;

        setView('searching');
        setSearchError(null);
        setReleases([]);

        try {
            const results = await searchReleases(movie.id);
            setReleases(results);
            setView('results');
        } catch {
            setSearchError('Failed to search for releases');
            setView('results');
        }
    }, [movie, searchReleases]);

    const handleGrab = useCallback(async (release: RadarrRelease) => {
        setGrabbingGuid(release.guid);
        const success = await grabRelease(release.guid, release.indexerId);

        if (success) {
            setGrabSuccess(release.guid);
            setGrabbingGuid(null);
            setTimeout(() => setGrabSuccess(null), 2000);
        } else {
            setGrabbingGuid(null);
        }
    }, [grabRelease]);

    const handleOverrideGrab = useCallback(async (release: RadarrRelease) => {
        setOverrideGuid(release.guid);
        const success = await grabRelease(release.guid, release.indexerId, true);

        if (success) {
            setOverrideSuccess(release.guid);
            setOverrideGuid(null);
            setTimeout(() => setOverrideSuccess(null), 2000);
        } else {
            setOverrideGuid(null);
        }
    }, [grabRelease]);

    const handleBack = useCallback(() => {
        setView('info');
        setReleases([]);
        setSearchError(null);
    }, []);

    // ---------- Derived ----------

    const movieStatus = movie ? getMovieStatus(movie) : 'missing';

    if (!movie) return null;

    const title = movie.title || 'Unknown Movie';
    const year = movie.year;
    const overview = movie.overview || '';
    const posterUrl = getPosterUrl(movie, integrationId);

    // Dates — digitalRelease primary, inCinemas fallback
    const primaryDate = movie.digitalRelease || movie.inCinemas;
    const displayDate = formatReleaseDate(primaryDate);
    const countdown = formatCountdown(movie.digitalRelease || movie.inCinemas);

    // Metadata
    const rating = movie.ratings?.value;
    const studio = movie.studio;
    const genres = movie.genres || [];
    const tmdbId = movie.tmdbId;
    const imdbId = movie.imdbId;

    // Status badge
    const baseStatus = STATUS_INFO[movieStatus];
    const statusInfo = movieStatus === 'upcoming' && countdown
        ? { label: `Releases ${countdown}`, color: baseStatus.color }
        : baseStatus;

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg" fixedHeight>
            {/* Compact close-only header — no title bar, just X */}
            <Modal.Header closeOnly />

            <Modal.Body padded={false} className={view === 'info' ? 'px-4 pb-4 sm:px-6 sm:pb-6' : ''}>
                {/* ============ INFO VIEW ============ */}
                {view === 'info' && (
                    <div className="space-y-6">
                        {/* Poster and Basic Info — matches RequestInfoModal exactly */}
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {/* Poster */}
                            {posterUrl ? (
                                <div style={{
                                    width: '150px',
                                    height: '225px',
                                    minHeight: '225px',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                    <img
                                        src={posterUrl}
                                        alt={title}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            ) : (
                                <div style={{
                                    width: '150px',
                                    height: '225px',
                                    flexShrink: 0,
                                    borderRadius: '8px',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Film size={48} style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            )}

                            {/* Title and Metadata */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Movie title */}
                                <h2 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
                                }}>
                                    {title}
                                </h2>

                                {/* Year subtitle */}
                                {year && (
                                    <p style={{
                                        margin: '0 0 0.75rem 0',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.95rem'
                                    }}>
                                        {year}
                                    </p>
                                )}

                                {/* Type Badge — matches Request Info */}
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'var(--bg-hover)',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <Film size={12} />
                                    Movie
                                </div>

                                {/* Metadata Row — matches Request Info layout */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {displayDate && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{displayDate}</span>
                                        </div>
                                    )}
                                    {(typeof rating === 'number' && rating > 0) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {studio && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Building2 size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{studio}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Badge — matches Request Info */}
                                <div style={{
                                    display: 'inline-block',
                                    marginTop: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    background: `${statusInfo.color}20`,
                                    border: `1px solid ${statusInfo.color}40`,
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: statusInfo.color
                                }}>
                                    {statusInfo.label}
                                </div>

                                {/* External links — IMDB + TMDB */}
                                <ExternalMediaLinks
                                    imdbId={imdbId}
                                    tmdbId={tmdbId}
                                    mediaType="movie"
                                    className="mt-2"
                                />
                            </div>
                        </div>

                        {/* Genres */}
                        {genres.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {genres.map(genre => (
                                    <span
                                        key={genre}
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            background: 'var(--bg-hover)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '999px',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)',
                                            fontWeight: 500
                                        }}
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Synopsis */}
                        {overview && (
                            <div>
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
                                    {overview}
                                </p>
                            </div>
                        )}

                        {/* Release dates section — always show both cinema + digital */}
                        <div>
                            <h4 style={{
                                margin: '0 0 0.5rem 0',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-secondary)'
                            }}>
                                Release Dates
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>In Cinemas:</span>
                                    {movie.inCinemas ? formatReleaseDate(movie.inCinemas) : 'TBA'}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Digital:</span>
                                    {movie.digitalRelease ? formatReleaseDate(movie.digitalRelease) : 'TBA'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ SEARCHING VIEW ============ */}
                {view === 'searching' && (
                    <div className="rdr-modal-searching">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="rdr-modal-searching-text">
                            {searchingText}
                        </span>
                    </div>
                )}

                {/* ============ RESULTS VIEW ============ */}
                {view === 'results' && (
                    <div className="rdr-modal-results">
                        {/* Results header */}
                        <div className="rdr-modal-results-header">
                            <span className="rdr-modal-results-count">
                                {searchError ? 'Error' : `${releases.length} release${releases.length !== 1 ? 's' : ''}`}
                            </span>
                        </div>

                        {/* Error */}
                        {searchError && (
                            <div className="rdr-modal-results-error">
                                <AlertCircle size={16} />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {/* Empty */}
                        {!searchError && releases.length === 0 && (
                            <div className="rdr-modal-results-empty">
                                No releases found
                            </div>
                        )}

                        {/* Release list */}
                        {releases.length > 0 && (
                            <div className="rdr-release-list custom-scrollbar">
                                {releases.map(release => {
                                    const isGrabbing = grabbingGuid === release.guid;
                                    const isGrabbed = grabSuccess === release.guid;
                                    const isOverriding = overrideGuid === release.guid;
                                    const isOverridden = overrideSuccess === release.guid;
                                    const qualityName = release.quality?.quality?.name || '?';
                                    const isRejected = release.rejected;
                                    const isBusy = isGrabbing || isOverriding;

                                    return (
                                        <div
                                            key={release.guid}
                                            className="rdr-release-item"
                                        >
                                            <div className="rdr-release-info">
                                                <div className="rdr-release-title" title={release.title}>
                                                    {release.title}
                                                </div>
                                                <div className="rdr-release-meta">
                                                    <span className="rdr-release-quality">{qualityName}</span>
                                                    <span>{formatSize(release.size)}</span>
                                                    {release.protocol === 'torrent' && release.seeders != null && (
                                                        <span className={release.seeders > 0 ? 'rdr-release-seeders' : 'rdr-release-no-seeders'}>
                                                            {release.seeders} seed{release.seeders !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {release.indexer && (
                                                        <span className="rdr-release-indexer">{release.indexer}</span>
                                                    )}
                                                    {release.age != null && release.age > 0 && (
                                                        <span>{release.age}d</span>
                                                    )}
                                                </div>
                                                {isRejected && release.rejections?.length ? (
                                                    <div className="rdr-release-rejections">
                                                        {release.rejections.slice(0, 2).join(' · ')}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="rdr-release-actions">
                                                <button
                                                    className={`rdr-grab-btn ${isGrabbed ? 'rdr-grab-btn--success' : ''}`}
                                                    disabled={isBusy || isGrabbed || isOverridden}
                                                    onClick={() => handleGrab(release)}
                                                    title="Grab release"
                                                >
                                                    {isGrabbing ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : isGrabbed ? (
                                                        <Check size={14} />
                                                    ) : (
                                                        <Download size={14} />
                                                    )}
                                                </button>
                                                <button
                                                    className={`rdr-grab-btn rdr-grab-btn--override ${isOverridden ? 'rdr-grab-btn--success' : ''}`}
                                                    disabled={isBusy || isGrabbed || isOverridden}
                                                    onClick={() => handleOverrideGrab(release)}
                                                    title="Override — grab and bypass quality profile"
                                                >
                                                    {isOverriding ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : isOverridden ? (
                                                        <Check size={14} />
                                                    ) : (
                                                        <UserCheck size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </Modal.Body>

            {/* ============ FOOTER — actions for missing mode only (admin) ============ */}
            {userIsAdmin && movieStatus === 'missing' && view === 'info' && (
                <Modal.Footer>
                    <div className="rdr-modal-footer-actions">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={
                                autoSearchState === 'searching' ? Loader2 :
                                    autoSearchState === 'success' ? Check :
                                        autoSearchState === 'error' ? AlertCircle :
                                            Search
                            }
                            className={
                                autoSearchState === 'searching' ? 'rdr-spin-icon' :
                                    autoSearchState === 'success' ? 'rdr-success-btn' :
                                        autoSearchState === 'error' ? 'rdr-error-btn' :
                                            ''
                            }
                            disabled={autoSearchState === 'searching'}
                            onClick={handleAutoSearch}
                        >
                            {autoSearchState === 'searching' ? 'Searching…' :
                                autoSearchState === 'success' ? 'Search Triggered' :
                                    autoSearchState === 'error' ? 'Failed' :
                                        'Automatic Search'}
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            icon={Search}
                            onClick={handleInteractiveSearch}
                        >
                            Interactive Search
                        </Button>
                    </div>
                </Modal.Footer>
            )}

            {/* Footer for results view — back button (admin only) */}
            {userIsAdmin && view === 'results' && (
                <Modal.Footer>
                    <div className="rdr-modal-footer-actions">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={ArrowLeft}
                            onClick={handleBack}
                        >
                            Back to Details
                        </Button>
                    </div>
                </Modal.Footer>
            )}
        </Modal>
    );
};

export default MovieDetailModal;
