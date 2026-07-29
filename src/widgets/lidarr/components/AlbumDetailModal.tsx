/**
 * AlbumDetailModal - Detail view for a Lidarr album
 *
 * Hero layout matches RequestInfoModal structure.
 * No ExternalMediaLinks — Lidarr uses MusicBrainz IDs not supported by that component.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Search, Download, ArrowLeft, Check, AlertCircle,
    Loader2, Music, Calendar, Star, Disc3, UserCheck
} from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Button } from '@/shared/ui/Button/Button';
import { useAutoSearchState } from '../../radarr/hooks/useAutoSearchState';
import { getAlbumCoverProxyUrl, getAlbumProgress } from '../hooks/lidarrDisplayState';
import { formatDisplayDate } from '../../_shared/media/format';
import type { WantedAlbum, CalendarAlbum, LidarrRelease } from '../lidarr.types';
import '../styles.css';

interface AlbumDetailModalProps {
    album: WantedAlbum | CalendarAlbum | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    upcomingAlbums?: CalendarAlbum[];
    triggerAutoSearch: (albumIds: number[]) => Promise<boolean>;
    searchReleases: (albumId: number) => Promise<LidarrRelease[]>;
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
    userIsAdmin?: boolean;
}

type ModalView = 'info' | 'searching' | 'results';

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

function getArtistName(album: WantedAlbum | CalendarAlbum): string {
    return album.artist?.artistName || (album as CalendarAlbum).artistName || 'Unknown Artist';
}

type AlbumStatus = 'available' | 'upcoming' | 'missing' | 'cutoffUnmet';

interface AlbumStatusResult {
    status: AlbumStatus;
    label: string;
    color: string;
}

function resolveAlbumStatus(album: WantedAlbum | CalendarAlbum): AlbumStatusResult {
    const releaseDateRaw = album.releaseDate;

    if (album.hasFile) {
        return album.cutoffNotMet
            ? { status: 'cutoffUnmet', label: 'Cutoff Unmet', color: 'var(--upgrade)' }
            : { status: 'available', label: 'Available', color: 'var(--success)' };
    }

    if (releaseDateRaw && new Date(releaseDateRaw).getTime() > Date.now()) {
        const countdown = formatCountdown(releaseDateRaw);
        const label = countdown ? `Releases ${countdown}` : `Releases · ${formatDisplayDate(releaseDateRaw)}`;
        return { status: 'upcoming', label, color: 'var(--info)' };
    }

    const label = releaseDateRaw ? `Missing · ${formatDisplayDate(releaseDateRaw)}` : 'Missing';
    return { status: 'missing', label, color: 'var(--error)' };
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({
    album,
    integrationId,
    open,
    onOpenChange,
    upcomingAlbums = [],
    triggerAutoSearch,
    searchReleases,
    grabRelease,
    userIsAdmin = true,
}) => {
    const [view, setView] = useState<ModalView>('info');
    const { state: autoSearchState, trigger: triggerAutoSearchState, reset: resetAutoSearchState } = useAutoSearchState();
    const [releases, setReleases] = useState<LidarrRelease[]>([]);
    const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);
    const [grabSuccess, setGrabSuccess] = useState<string | null>(null);
    const [overrideGuid, setOverrideGuid] = useState<string | null>(null);
    const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchingText, setSearchingText] = useState('Searching indexers…');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchGenerationRef = useRef(0);

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

    const albumId = album?.id ?? null;
    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: resets Interactive Search UI when selected album id changes */
    useEffect(() => {
        searchGenerationRef.current += 1;
        resetModalState();
    }, [albumId, resetModalState]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (newOpen) {
            resetModalState();
        }
        onOpenChange(newOpen);
    }, [onOpenChange, resetModalState]);

    const handleAutoSearch = useCallback(() => {
        if (!album) return;
        triggerAutoSearchState(() => triggerAutoSearch([album.id]));
    }, [album, triggerAutoSearch, triggerAutoSearchState]);

    const handleInteractiveSearch = useCallback(async () => {
        if (!album) return;

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
            const results = await searchReleases(album.id);
            if (generation !== searchGenerationRef.current) return;
            setReleases(results);
            setView('results');
        } catch {
            if (generation !== searchGenerationRef.current) return;
            setSearchError('Failed to search for releases');
            setView('results');
        }

        if (generation !== searchGenerationRef.current) return;
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
        }
    }, [album, searchReleases]);

    const handleGrab = useCallback(async (release: LidarrRelease) => {
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

    const handleOverrideGrab = useCallback(async (release: LidarrRelease) => {
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

    const albumStatusResult: AlbumStatusResult = album
        ? resolveAlbumStatus(album)
        : { status: 'missing', label: 'Missing', color: 'var(--error)' };
    const albumStatus = albumStatusResult.status;

    const otherUpcoming = useMemo(() => {
        if (!album || albumStatus === 'missing') return [];
        return upcomingAlbums.filter(item =>
            item.artistId === album.artistId && item.id !== album.id
        ).slice(0, 5);
    }, [album, albumStatus, upcomingAlbums]);

    if (!album) return null;

    const artist = album.artist;
    const artistName = getArtistName(album);
    const albumTitle = album.title || 'Unknown Album';
    const releaseDateRaw = album.releaseDate;
    const releaseDate = formatReleaseDate(releaseDateRaw);
    const posterUrl = getAlbumCoverProxyUrl(album, integrationId);
    const overview = album.overview || artist?.overview || '';
    const rating = artist?.ratings?.value;
    const genres = artist?.genres || [];
    const albumType = album.albumType;
    const albumProgress = getAlbumProgress(album.statistics);

    return (
        <Modal open={open} onOpenChange={handleOpenChange} size="lg" fixedHeight>
            <Modal.Header closeOnly />

            <Modal.Body padded={false} className={view === 'info' ? 'px-4 pb-4 sm:px-6 sm:pb-6' : ''}>
                {view === 'info' && (
                    <div className="space-y-6">
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {posterUrl ? (
                                <div style={{
                                    width: '150px',
                                    height: '150px',
                                    minHeight: '150px',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                    <img
                                        src={posterUrl}
                                        alt={albumTitle}
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
                                    height: '150px',
                                    flexShrink: 0,
                                    borderRadius: '8px',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Music size={48} style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
                                }}>
                                    {albumTitle}
                                </h2>

                                <p style={{
                                    margin: '0 0 0.75rem 0',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.95rem'
                                }}>
                                    {artistName}
                                    {albumType && (
                                        <span style={{ marginLeft: '0.35rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            · {albumType}
                                        </span>
                                    )}
                                </p>

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
                                    <Disc3 size={12} />
                                    {albumType || 'Album'}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {releaseDate && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{releaseDate}</span>
                                        </div>
                                    )}
                                    {(typeof rating === 'number' && rating > 0) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                                            <Star size={14} style={{ color: 'var(--warning)' }} />
                                            <span>{rating.toFixed(1)}/10</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    display: 'inline-block',
                                    marginTop: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    background: `${albumStatusResult.color}20`,
                                    border: `1px solid ${albumStatusResult.color}40`,
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: albumStatusResult.color
                                }}>
                                    {albumStatusResult.label}
                                </div>
                            </div>
                        </div>

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

                        {albumProgress && (
                            <div>
                                <h4 style={{
                                    margin: '0 0 0.5rem 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Track Progress
                                </h4>
                                <div className="ldr-modal-season-progress">
                                    <div className="ldr-modal-season-progress-fill" style={{ width: `${albumProgress.fraction * 100}%` }} />
                                </div>
                                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    {albumProgress.trackFileCount} / {albumProgress.trackCount} tracks
                                </div>
                            </div>
                        )}

                        {albumStatus !== 'missing' && otherUpcoming.length > 0 && (
                            <div className="ldr-modal-also-upcoming">
                                <div className="ldr-modal-section-label">Also Upcoming</div>
                                <div className="ldr-modal-upcoming-list">
                                    {otherUpcoming.map(item => (
                                        <div key={`also-${item.id}`} className="ldr-modal-upcoming-item">
                                            <span className="ldr-modal-upcoming-title">
                                                {item.title || 'Unknown Album'}
                                            </span>
                                            {item.albumType && (
                                                <span className="ldr-modal-upcoming-code">{item.albumType}</span>
                                            )}
                                            <span className="ldr-modal-upcoming-date">
                                                {formatReleaseDate(item.releaseDate)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {view === 'searching' && (
                    <div className="ldr-modal-searching">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="ldr-modal-searching-text">
                            {searchingText}
                        </span>
                    </div>
                )}

                {view === 'results' && (
                    <div className="ldr-modal-results">
                        <div className="ldr-modal-results-header">
                            <span className="ldr-modal-results-count">
                                {searchError ? 'Error' : `${releases.length} release${releases.length !== 1 ? 's' : ''}`}
                            </span>
                        </div>

                        {searchError && (
                            <div className="ldr-modal-results-error">
                                <AlertCircle size={16} />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {!searchError && releases.length === 0 && (
                            <div className="ldr-modal-results-empty">
                                No releases found
                            </div>
                        )}

                        {releases.length > 0 && (
                            <div className="ldr-release-list custom-scrollbar">
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
                                            className="ldr-release-item"
                                        >
                                            <div className="ldr-release-info">
                                                <div className="ldr-release-title" title={release.title}>
                                                    {release.title}
                                                </div>
                                                <div className="ldr-release-meta">
                                                    <span className="ldr-release-quality">{qualityName}</span>
                                                    <span>{formatSize(release.size)}</span>
                                                    {release.protocol === 'torrent' && release.seeders != null && (
                                                        <span className={release.seeders > 0 ? 'ldr-release-seeders' : 'ldr-release-no-seeders'}>
                                                            {release.seeders} seed{release.seeders !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {release.indexer && (
                                                        <span className="ldr-release-indexer">{release.indexer}</span>
                                                    )}
                                                    {release.age != null && release.age > 0 && (
                                                        <span>{release.age}d</span>
                                                    )}
                                                </div>
                                                {isRejected && release.rejections?.length ? (
                                                    <div className="ldr-release-rejections">
                                                        {release.rejections.slice(0, 2).join(' · ')}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="ldr-release-actions">
                                                <button
                                                    className={`ldr-grab-btn ${isGrabbed ? 'ldr-grab-btn--success' : ''}`}
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
                                                    className={`ldr-grab-btn ldr-grab-btn--override ${isOverridden ? 'ldr-grab-btn--success' : ''}`}
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

            {userIsAdmin && albumStatus !== 'available' && view === 'info' && (
                <Modal.Footer>
                    <div className="ldr-modal-footer-actions">
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
                                autoSearchState === 'searching' ? 'ldr-spin-icon' :
                                    autoSearchState === 'success' ? 'ldr-success-btn' :
                                        autoSearchState === 'error' ? 'ldr-error-btn' :
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

            {userIsAdmin && view === 'results' && (
                <Modal.Footer>
                    <div className="ldr-modal-footer-actions">
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

export default AlbumDetailModal;
