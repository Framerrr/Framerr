/**
 * EpisodeDetailModal - Detail view for a Sonarr episode
 * 
 * Hero layout matches RequestInfoModal exactly:
 * - 150x225 poster, 1.5rem/700 title, metadata row, status badge, ExternalMediaLinks
 * - Floating X close button (uses Modal's relative content wrapper)
 * - Hidden Dialog.Title/Description for Radix a11y
 * 
 * Two modes:
 * 1. Missing mode: Episode details + search actions in footer
 * 2. Upcoming mode: Episode details + countdown + other upcoming eps
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Search, Download, ArrowLeft, Check, AlertCircle,
    Loader2, MonitorPlay, Calendar, Star, Tv, Radio, UserCheck
} from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Button } from '@/shared/ui/Button/Button';
import { ExternalMediaLinks } from '@/shared/ui/ExternalMediaLinks';
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
type AutoSearchState = 'idle' | 'searching' | 'success' | 'error';

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

/** 3-state episode status: available > upcoming > missing */
type EpisodeStatus = 'available' | 'upcoming' | 'missing';

function getEpisodeStatus(ep: WantedEpisode | CalendarEpisode): EpisodeStatus {
    // If Sonarr says it has a file, it's available regardless of air date
    if (ep.hasFile) return 'available';

    // Future air date → upcoming
    const airDate = ep.airDateUtc || ep.airDate;
    if (airDate && new Date(airDate).getTime() > Date.now()) return 'upcoming';

    // Past air date + no file → missing
    return 'missing';
}

const STATUS_INFO: Record<EpisodeStatus, { label: string; color: string }> = {
    available: { label: 'Available', color: 'var(--success)' },
    upcoming: { label: 'Upcoming', color: 'var(--info)' },
    missing: { label: 'Missing', color: 'var(--error)' },
};

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
    const [autoSearchState, setAutoSearchState] = useState<AutoSearchState>('idle');
    const [releases, setReleases] = useState<SonarrRelease[]>([]);
    const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);
    const [grabSuccess, setGrabSuccess] = useState<string | null>(null);
    const [overrideGuid, setOverrideGuid] = useState<string | null>(null);
    const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchingText, setSearchingText] = useState('Searching indexers…');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset state when modal opens/closes or episode changes
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
    }, [open, episode?.id]);

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
        if (!episode || autoSearchState === 'searching') return;

        setAutoSearchState('searching');
        const success = await triggerAutoSearch([episode.id]);

        if (success) {
            setAutoSearchState('success');
            setTimeout(() => setAutoSearchState('idle'), 2500);
        } else {
            setAutoSearchState('error');
            setTimeout(() => setAutoSearchState('idle'), 3000);
        }
    }, [episode, autoSearchState, triggerAutoSearch]);

    const handleInteractiveSearch = useCallback(async () => {
        if (!episode) return;

        setView('searching');
        setSearchError(null);
        setReleases([]);

        try {
            const results = await searchReleases(episode.id);
            setReleases(results);
            setView('results');
        } catch {
            setSearchError('Failed to search for releases');
            setView('results');
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
    }, []);

    // ---------- Derived ----------

    const episodeStatus = episode ? getEpisodeStatus(episode) : 'missing';

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
    const countdown = formatCountdown(airDateRaw);
    const posterUrl = getPosterUrl(episode, integrationId);
    const overview = episode.overview || series?.overview || '';

    // Ratings & external IDs from Sonarr series data
    const rating = series?.ratings?.value;
    const imdbId = series?.imdbId;
    const tvdbId = series?.tvdbId;
    const genres = series?.genres || [];
    const network = series?.network;

    // Status badge — 3-state: available / upcoming (with countdown) / missing
    const baseStatus = STATUS_INFO[episodeStatus];
    const statusInfo = episodeStatus === 'upcoming' && countdown
        ? { label: `Airs ${countdown}`, color: baseStatus.color }
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
                                        alt={seriesTitle}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
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
                                    <MonitorPlay size={48} style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            )}

                            {/* Title and Metadata */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Series title */}
                                <h2 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
                                }}>
                                    {seriesTitle}
                                </h2>

                                {/* Episode subtitle (lighter) */}
                                <p style={{
                                    margin: '0 0 0.75rem 0',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.95rem'
                                }}>
                                    {epCode && <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.35rem' }}>{epCode}</span>}
                                    {epTitle}
                                </p>

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
                                    <Tv size={12} />
                                    TV Show
                                </div>

                                {/* Metadata Row — matches Request Info layout */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {airDate && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{airDate}</span>
                                        </div>
                                    )}
                                    {(typeof rating === 'number' && rating > 0) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                    {network && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Radio size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{network}</span>
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

                                {/* External links — IMDB + TVDB */}
                                <ExternalMediaLinks
                                    imdbId={imdbId}
                                    tvdbId={tvdbId}
                                    mediaType="tv"
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
            {userIsAdmin && episodeStatus === 'missing' && view === 'info' && (
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
