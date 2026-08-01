/**
 * EpisodeDetailModal - Detail view for a Sonarr episode
 * 
 * Hero/body shared with other media detail modals via MediaDetail primitives.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Search, Download, ArrowLeft, Check, AlertCircle,
    Loader2, MonitorPlay, Calendar, Star, Radio, UserCheck
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
import { useAutoSearchState } from '../../radarr/hooks/useAutoSearchState';
import { getSeasonProgress } from '../hooks/sonarrDisplayState';
import { formatDisplayDate } from '../../_shared/media/format';
import type { WantedEpisode, CalendarEpisode, SonarrRelease, SonarrImage } from '../sonarr.types';
import '../styles.css';

// ============================================================================
// TYPES
// ============================================================================

interface EpisodeDetailModalProps {
    episode: WantedEpisode | CalendarEpisode | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** All upcoming calendar episodes (for "Also Upcoming" in upcoming mode) */
    upcomingEpisodes?: CalendarEpisode[];
    /** Trigger auto search (EpisodeSearch command) — admin only */
    triggerAutoSearch: (episodeIds: number[]) => Promise<boolean>;
    /** Search for releases — admin only */
    searchReleases: (episodeId: number) => Promise<SonarrRelease[]>;
    /** Grab a specific release — admin only */
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
    /** Whether the current user is an admin (controls action visibility) */
    userIsAdmin?: boolean;
}

type ModalView = 'info' | 'searching' | 'results';

// ============================================================================
// HELPERS
// ============================================================================

function formatEpCode(ep: { seasonNumber?: number; episodeNumber?: number }): string {
    if (ep.seasonNumber == null || ep.episodeNumber == null) return '';
    return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`;
}

function formatAirDate(dateStr: string | undefined): string {
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
    episode: WantedEpisode | CalendarEpisode,
    integrationId: string
): string | null {
    const images = episode.series?.images;
    if (!images?.length) return null;

    const poster = images.find((img: SonarrImage) => img.coverType === 'poster');
    const imageUrl = poster?.remoteUrl || poster?.url;
    if (!imageUrl) return null;

    return `/api/integrations/${integrationId}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

/** 4-state episode status: available > upcoming > missing > cutoffUnmet */
type EpisodeStatus = 'available' | 'upcoming' | 'missing' | 'cutoffUnmet';

interface EpisodeStatusResult {
    status: EpisodeStatus;
    label: string;
    color: string;
}

/**
 * Status chip's label/color. Unlike Radarr's movies, an episode only ever
 * has one date field (airDateUtc/airDate), so there's no cross-type
 * contradiction possible here — but the old "missing" label was still a
 * bare, contextless word while its Needs Attention row pill always shows
 * the actual air date (`getEpisodePillProps`). Enriching it here matches
 * the same level of info as the card, mirroring the hardening applied to
 * Radarr's MovieDetailModal.
 */
function resolveEpisodeStatus(ep: WantedEpisode | CalendarEpisode): EpisodeStatusResult {
    const airDateRaw = ep.airDateUtc || ep.airDate;

    // If Sonarr says it has a file, it's available — unless it's below the quality cutoff
    if (ep.hasFile) {
        return ep.cutoffNotMet
            ? { status: 'cutoffUnmet', label: 'Cutoff Unmet', color: 'var(--upgrade)' }
            : { status: 'available', label: 'Available', color: 'var(--success)' };
    }

    // Future air date → upcoming
    if (airDateRaw && new Date(airDateRaw).getTime() > Date.now()) {
        const countdown = formatCountdown(airDateRaw);
        const label = countdown ? `Airs ${countdown}` : `Airs · ${formatDisplayDate(airDateRaw)}`;
        return { status: 'upcoming', label, color: 'var(--info)' };
    }

    // Past air date (or none at all) + no file → missing
    const label = airDateRaw ? `Missing · ${formatDisplayDate(airDateRaw)}` : 'Missing';
    return { status: 'missing', label, color: 'var(--error)' };
}

// ============================================================================
// COMPONENT
// ============================================================================

const EpisodeDetailModal: React.FC<EpisodeDetailModalProps> = ({
    episode,
    integrationId,
    open,
    onOpenChange,
    upcomingEpisodes = [],
    triggerAutoSearch,
    searchReleases,
    grabRelease,
    userIsAdmin = true,
}) => {
    const [view, setView] = useState<ModalView>('info');
    const { state: autoSearchState, trigger: triggerAutoSearchState, reset: resetAutoSearchState } = useAutoSearchState();
    const [releases, setReleases] = useState<SonarrRelease[]>([]);
    const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);
    const [grabSuccess, setGrabSuccess] = useState<string | null>(null);
    const [overrideGuid, setOverrideGuid] = useState<string | null>(null);
    const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchingText, setSearchingText] = useState('Searching indexers…');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bumped whenever the selected episode id changes; used to invalidate an
    // in-flight searchReleases so a stale completion can't paint the new episode.
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

    const episodeId = episode?.id ?? null;
    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: resets Interactive Search UI when selected episode id changes (prop transition, not continuous sync) */
    useEffect(() => {
        searchGenerationRef.current += 1;
        resetModalState();
    }, [episodeId, resetModalState]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (newOpen) {
            resetModalState();
        }
        onOpenChange(newOpen);
    }, [onOpenChange, resetModalState]);

    // ---------- Actions ----------

    const handleAutoSearch = useCallback(() => {
        if (!episode) return;
        triggerAutoSearchState(() => triggerAutoSearch([episode.id]));
    }, [episode, triggerAutoSearch, triggerAutoSearchState]);

    const handleInteractiveSearch = useCallback(async () => {
        if (!episode) return;

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
            const results = await searchReleases(episode.id);
            if (generation !== searchGenerationRef.current) return; // episode changed mid-search — drop stale results
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
    }, [episode, searchReleases]);

    const handleGrab = useCallback(async (release: SonarrRelease) => {
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

    const handleOverrideGrab = useCallback(async (release: SonarrRelease) => {
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

    const episodeStatusResult: EpisodeStatusResult = episode
        ? resolveEpisodeStatus(episode)
        : { status: 'missing', label: 'Missing', color: 'var(--error)' };
    const episodeStatus = episodeStatusResult.status;

    // Other upcoming episodes for the same series (non-missing mode)
    const otherUpcoming = useMemo(() => {
        if (!episode || episodeStatus === 'missing') return [];
        return upcomingEpisodes.filter(ep =>
            ep.seriesId === episode.seriesId && ep.id !== episode.id
        ).slice(0, 5);
    }, [episode, episodeStatus, upcomingEpisodes]);

    if (!episode) return null;

    const series = episode.series;
    const seriesTitle = series?.title || (episode as CalendarEpisode).seriesTitle || 'Unknown Series';
    const epTitle = episode.title || 'TBA';
    const epCode = formatEpCode(episode);
    const airDateRaw = episode.airDateUtc || episode.airDate;
    const airDate = formatAirDate(airDateRaw);
    const posterUrl = getPosterUrl(episode, integrationId);
    const overview = episode.overview || series?.overview || '';

    // Ratings & external IDs from Sonarr series data
    const rating = series?.ratings?.value;
    const imdbId = series?.imdbId;
    const tvdbId = series?.tvdbId;
    const genres = series?.genres || [];
    const network = series?.network;
    const seasonProgress = getSeasonProgress(series?.statistics);

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
                                alt={seriesTitle}
                                placeholderIcon={<MonitorPlay size={48} />}
                                statusLabel={episodeStatusResult.label}
                                statusColor={episodeStatusResult.color}
                                onImgError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />

                            <MediaHeroCol>
                                <h2 className="media-hero__title">{seriesTitle}</h2>

                                <p className="media-hero__subtitle">
                                    {epCode && <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>{epCode}</span>}
                                    {epTitle}
                                </p>

                                <MediaTypeBadge type="tv" />

                                <div className="media-hero__meta">
                                    {airDate && (
                                        <div className="media-hero__meta-item">
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{airDate}</span>
                                        </div>
                                    )}
                                    {(typeof rating === 'number' && rating > 0) && (
                                        <div className="media-hero__meta-item">
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {network && (
                                        <div className="media-hero__meta-item">
                                            <Radio size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{network}</span>
                                        </div>
                                    )}
                                </div>

                                <ExternalMediaLinks
                                    imdbId={imdbId}
                                    tvdbId={tvdbId}
                                    title={seriesTitle}
                                    year={series?.year}
                                    mediaType="tv"
                                />
                            </MediaHeroCol>
                        </div>

                        {overview ? <MediaSynopsis text={overview} /> : null}
                        <MediaGenres genres={genres} />

                        {/* Domain: schedule / season context */}
                        {airDateRaw && airDateRaw.includes('T') && (() => {
                            const startDate = new Date(airDateRaw);
                            const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
                            const startTime = startDate.toLocaleTimeString(undefined, timeFmt);
                            const runtime = (episode as any).runtime || (episode as any).series?.runtime;
                            if (!runtime) {
                                return (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.5rem 0.75rem',
                                        background: 'var(--bg-hover)',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                    }}>
                                        <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                                        <span>Airs at <strong style={{ color: 'var(--text-primary)' }}>{startTime}</strong></span>
                                    </div>
                                );
                            }
                            const endDate = new Date(startDate.getTime() + runtime * 60 * 1000);
                            const endTime = endDate.toLocaleTimeString(undefined, timeFmt);
                            return (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-hover)',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                }}>
                                    <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    <span>
                                        <strong style={{ color: 'var(--text-primary)' }}>{startTime}</strong>
                                        {' – '}
                                        <strong style={{ color: 'var(--text-primary)' }}>{endTime}</strong>
                                        <span style={{ marginLeft: '0.35rem', fontSize: '0.8rem' }}>({runtime} min)</span>
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Season progress — only rendered when statistics are present */}
                        {seasonProgress && (
                            <div>
                                <MediaSectionHeading>Season Progress</MediaSectionHeading>
                                <div className="snr-modal-season-progress">
                                    <div className="snr-modal-season-progress-fill" style={{ width: `${seasonProgress.fraction * 100}%` }} />
                                </div>
                                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    {seasonProgress.episodeFileCount} / {seasonProgress.episodeCount} episodes
                                </div>
                            </div>
                        )}

                        {/* Upcoming mode: also upcoming for same series */}
                        {episodeStatus !== 'missing' && otherUpcoming.length > 0 && (
                            <div className="snr-modal-also-upcoming">
                                <div className="snr-modal-section-label">Also Upcoming</div>
                                <div className="snr-modal-upcoming-list">
                                    {otherUpcoming.map(ep => (
                                        <div key={`also-${ep.id}`} className="snr-modal-upcoming-item">
                                            <span className="snr-modal-upcoming-code">
                                                {formatEpCode(ep)}
                                            </span>
                                            <span className="snr-modal-upcoming-title">
                                                {ep.title || 'TBA'}
                                            </span>
                                            <span className="snr-modal-upcoming-date">
                                                {formatAirDate(ep.airDateUtc || ep.airDate)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============ SEARCHING VIEW ============ */}
                {view === 'searching' && (
                    <div className="snr-modal-searching">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="snr-modal-searching-text">
                            {searchingText}
                        </span>
                    </div>
                )}

                {/* ============ RESULTS VIEW ============ */}
                {view === 'results' && (
                    <div className="snr-modal-results">
                        {/* Results header */}
                        <div className="snr-modal-results-header">
                            <span className="snr-modal-results-count">
                                {searchError ? 'Error' : `${releases.length} release${releases.length !== 1 ? 's' : ''}`}
                            </span>
                        </div>

                        {/* Error */}
                        {searchError && (
                            <div className="snr-modal-results-error">
                                <AlertCircle size={16} />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {/* Empty */}
                        {!searchError && releases.length === 0 && (
                            <div className="snr-modal-results-empty">
                                No releases found
                            </div>
                        )}

                        {/* Release list */}
                        {releases.length > 0 && (
                            <div className="snr-release-list custom-scrollbar">
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
                                            className="snr-release-item"
                                        >
                                            <div className="snr-release-info">
                                                <div className="snr-release-title" title={release.title}>
                                                    {release.title}
                                                </div>
                                                <div className="snr-release-meta">
                                                    <span className="snr-release-quality">{qualityName}</span>
                                                    <span>{formatSize(release.size)}</span>
                                                    {release.protocol === 'torrent' && release.seeders != null && (
                                                        <span className={release.seeders > 0 ? 'snr-release-seeders' : 'snr-release-no-seeders'}>
                                                            {release.seeders} seed{release.seeders !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {release.indexer && (
                                                        <span className="snr-release-indexer">{release.indexer}</span>
                                                    )}
                                                    {release.age != null && release.age > 0 && (
                                                        <span>{release.age}d</span>
                                                    )}
                                                </div>
                                                {isRejected && release.rejections?.length ? (
                                                    <div className="snr-release-rejections">
                                                        {release.rejections.slice(0, 2).join(' · ')}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="snr-release-actions">
                                                <button
                                                    className={`snr-grab-btn ${isGrabbed ? 'snr-grab-btn--success' : ''}`}
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
                                                    className={`snr-grab-btn snr-grab-btn--override ${isOverridden ? 'snr-grab-btn--success' : ''}`}
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
            {userIsAdmin && episodeStatus !== 'available' && view === 'info' && (
                <Modal.Footer>
                    <div className="snr-modal-footer-actions">
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
                                autoSearchState === 'searching' ? 'snr-spin-icon' :
                                    autoSearchState === 'success' ? 'snr-success-btn' :
                                        autoSearchState === 'error' ? 'snr-error-btn' :
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
                    <div className="snr-modal-footer-actions">
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

export default EpisodeDetailModal;
