/**
 * MovieDetailModal - Detail view for a Radarr movie
 * 
 * Hero/body shared with other media detail modals via MediaDetail primitives.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Search, Download, ArrowLeft, Check, AlertCircle,
    Loader2, Calendar, Star, Building2, UserCheck
} from 'lucide-react';
import {
    Modal,
    MediaPoster,
    MediaHeroCol,
    MediaTypeBadge,
    MediaSectionHeading,
    MediaSynopsis,
    MediaGenres,
} from '@/shared/ui';
import { Button } from '@/shared/ui/Button/Button';
import { ExternalMediaLinks } from '@/shared/ui/ExternalMediaLinks';
import { useAutoSearchState } from '../hooks/useAutoSearchState';
import { computeMovieDisplayState, getPillDisplayProps, getAttentionReferenceDate } from '../hooks/radarrDisplayState';
import { formatDisplayDate } from '../../_shared/media/format';
import type { WantedMovie, CalendarMovie, RadarrRelease, RadarrImage, ReleaseTypeVisibility } from '../radarr.types';
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

/** 4-state movie status: available > upcoming > missing > cutoffUnmet */
type MovieStatus = 'available' | 'upcoming' | 'missing' | 'cutoffUnmet';

interface MovieStatusResult {
    status: MovieStatus;
    label: string;
    color: string;
}

/** Modal's status chip has no per-type visibility toggle — always evaluate all three. */
const ALL_RELEASE_TYPES_VISIBLE: ReleaseTypeVisibility = { showCinema: true, showDigital: true, showPhysical: true };

const RELEASE_TYPE_LABEL: Record<'cinema' | 'digital' | 'physical', string> = {
    cinema: 'In Cinemas',
    digital: 'Digital Release',
    physical: 'Physical Release',
};

const RELEASE_TYPE_COLOR: Record<'cinema' | 'digital' | 'physical', string> = {
    cinema: 'var(--cinema)',
    digital: 'var(--digital)',
    physical: 'var(--physical)',
};

/**
 * Status chip's label/color, driven by the exact same 7-state release-date
 * decision tree the Hero/carousel/attention pills use
 * (`computeMovieDisplayState`) instead of a separately-maintained simplified
 * check. Fixes a real contradiction: the old logic only ever looked at
 * `digitalRelease` and defaulted to "Upcoming" whenever that one field was
 * absent — so a movie whose only release milestone was an already-past
 * `physicalRelease` (no digital release announced) showed "Upcoming" here
 * while its Needs Attention pill correctly showed "Physical · [past date]".
 */
function resolveMovieStatus(movie: WantedMovie | CalendarMovie): MovieStatusResult {
    // If Radarr has the file downloaded → available, unless it's below the quality cutoff
    if (movie.hasFile) {
        return movie.cutoffNotMet
            ? { status: 'cutoffUnmet', label: 'Cutoff Unmet', color: 'var(--upgrade)' }
            : { status: 'available', label: 'Available', color: 'var(--success)' };
    }

    const display = computeMovieDisplayState(movie, new Date(), ALL_RELEASE_TYPES_VISIBLE);
    const pill = display ? getPillDisplayProps(display) : null;
    if (display && pill) {
        const typeLabel = RELEASE_TYPE_LABEL[pill.type];
        const color = RELEASE_TYPE_COLOR[pill.type];
        if (display.state === 3) {
            return { status: 'upcoming', label: `${typeLabel} Now`, color };
        }
        const countdown = formatCountdown(display.displayDate ?? undefined);
        const label = countdown ? `${typeLabel} ${countdown}` : `${typeLabel} · ${formatDisplayDate(display.displayDate)}`;
        return { status: 'upcoming', label, color };
    }

    // Nothing left to anticipate (7-state tree returned null) — genuinely
    // missing, not upcoming. Surface the same reference-date info the Needs
    // Attention pill shows (`getAttentionReferenceDate`) instead of a bare,
    // contextless "Missing".
    const ref = getAttentionReferenceDate(movie);
    if (ref) {
        return {
            status: 'missing',
            label: `Missing · ${RELEASE_TYPE_LABEL[ref.type]} ${formatDisplayDate(ref.date)}`,
            color: 'var(--error)',
        };
    }
    return { status: 'missing', label: 'Missing', color: 'var(--error)' };
}

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
    const { state: autoSearchState, trigger: triggerAutoSearchState, reset: resetAutoSearchState } = useAutoSearchState();
    const [releases, setReleases] = useState<RadarrRelease[]>([]);
    const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);
    const [grabSuccess, setGrabSuccess] = useState<string | null>(null);
    const [overrideGuid, setOverrideGuid] = useState<string | null>(null);
    const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchingText, setSearchingText] = useState('Searching indexers…');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bumped whenever the selected movie id changes; used to invalidate an
    // in-flight searchReleases so a stale completion can't paint the new movie.
    const searchGenerationRef = useRef(0);

    // Reset all Interactive Search / modal UI state. Invoked by the id-change
    // effect below (primary) and defensively by handleOpenChange(true).
    const resetModalState = useCallback(() => {
        setView('info');
        resetAutoSearchState();
        setReleases([]);
        setGrabbingGuid(null);
        setGrabSuccess(null);
        setOverrideGuid(null);
        setOverrideSuccess(null);
        setSearchError(null);
        setSearchingText('Searching indexers…');
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    }, [resetAutoSearchState]);

    // Reset Interactive Search UI whenever the selected movie id changes.
    // Deliberately keyed on the id (not `open`): a same-title close→reopen keeps
    // the id, so search/results survive; switching to a different movie (incl.
    // A→B→A) changes the id and resets. Bumping the generation ref also
    // invalidates any in-flight searchReleases (see handleInteractiveSearch).
    const movieId = movie?.id ?? null;
    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: resets Interactive Search UI when selected movie id changes (prop transition, not continuous sync) */
    useEffect(() => {
        searchGenerationRef.current += 1;
        resetModalState();
    }, [movieId, resetModalState]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (newOpen) {
            resetModalState();
        }
        onOpenChange(newOpen);
    }, [onOpenChange, resetModalState]);

    // ---------- Actions ----------

    const handleAutoSearch = useCallback(() => {
        if (!movie) return;
        triggerAutoSearchState(() => triggerAutoSearch([movie.id]));
    }, [movie, triggerAutoSearch, triggerAutoSearchState]);

    const handleInteractiveSearch = useCallback(async () => {
        if (!movie) return;

        const generation = searchGenerationRef.current;

        setView('searching');
        setSearchError(null);
        setReleases([]);
        setSearchingText('Searching indexers…');

        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setSearchingText('Still searching…');
        }, 15000);

        try {
            const results = await searchReleases(movie.id);
            if (generation !== searchGenerationRef.current) return; // movie changed mid-search — drop stale results
            setReleases(results);
            setView('results');
        } catch {
            if (generation !== searchGenerationRef.current) return; // stale error after switch
            setSearchError('Failed to search for releases');
            setView('results');
        }

        if (generation !== searchGenerationRef.current) return; // reset already cleared the timer on id change
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
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
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
        }
    }, []);

    // ---------- Derived ----------

    const movieStatusResult: MovieStatusResult = movie
        ? resolveMovieStatus(movie)
        : { status: 'missing', label: 'Missing', color: 'var(--error)' };
    const movieStatus = movieStatusResult.status;

    if (!movie) return null;

    const title = movie.title || 'Unknown Movie';
    const year = movie.year;
    const overview = movie.overview || '';
    const posterUrl = getPosterUrl(movie, integrationId);

    // Dates — digitalRelease primary, inCinemas fallback
    const primaryDate = movie.digitalRelease || movie.inCinemas;
    const displayDate = formatReleaseDate(primaryDate);

    // Metadata
    const rating = movie.ratings?.value;
    const studio = movie.studio;
    const genres = movie.genres || [];
    const tmdbId = movie.tmdbId;
    const imdbId = movie.imdbId;

    return (
        <Modal open={open} onOpenChange={handleOpenChange} size="lg" fixedHeight>
            {/* Compact close-only header — no title bar, just X */}
            <Modal.Header closeOnly />

            <Modal.Body padded={false} className={view === 'info' ? 'px-4 pb-4 sm:px-6 sm:pb-6' : ''}>
                {/* ============ INFO VIEW ============ */}
                {view === 'info' && (
                    <div className="space-y-6">
                        <div className="media-hero">
                            <MediaPoster
                                src={posterUrl}
                                alt={title}
                                statusLabel={movieStatusResult.label}
                                statusColor={movieStatusResult.color}
                                onImgError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />

                            <MediaHeroCol>
                                <h2 className="media-hero__title">{title}</h2>

                                <MediaTypeBadge type="movie" />

                                <div className="media-hero__meta">
                                    {(displayDate || year) ? (
                                        <div className="media-hero__meta-item">
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{displayDate || year}</span>
                                        </div>
                                    ) : null}
                                    {(typeof rating === 'number' && rating > 0) && (
                                        <div className="media-hero__meta-item">
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {studio && (
                                        <div className="media-hero__meta-item">
                                            <Building2 size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{studio}</span>
                                        </div>
                                    )}
                                </div>

                                <ExternalMediaLinks
                                    imdbId={imdbId}
                                    tmdbId={tmdbId}
                                    title={title}
                                    year={year}
                                    mediaType="movie"
                                />
                            </MediaHeroCol>
                        </div>

                        {overview ? <MediaSynopsis text={overview} /> : null}
                        <MediaGenres genres={genres} />

                        {/* Domain: release milestones */}
                        <div>
                            <MediaSectionHeading>Release Dates</MediaSectionHeading>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>In Cinemas:</span>
                                    {movie.inCinemas ? formatReleaseDate(movie.inCinemas) : 'TBA'}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Digital Release:</span>
                                    {movie.digitalRelease ? formatReleaseDate(movie.digitalRelease) : 'TBA'}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Physical Release:</span>
                                    {movie.physicalRelease ? formatReleaseDate(movie.physicalRelease) : 'TBA'}
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
            {userIsAdmin && movieStatus !== 'available' && view === 'info' && (
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
