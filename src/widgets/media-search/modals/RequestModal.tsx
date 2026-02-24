/**
 * RequestModal Component
 * 
 * Modal for requesting media via Overseerr.
 * Shows poster, metadata, and request controls:
 * - Server picker (only when 4K available → multiple Radarr/Sonarr instances)
 * - Season picker (only for TV shows)
 * - Request button with loading state
 * 
 * Fetches server list and TV details on open.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Film, Tv, Star, Loader2 } from 'lucide-react';
import { Modal, Button, Select, MultiSelectDropdown } from '../../../shared/ui';
import { ExternalMediaLinks } from '../../../shared/ui/ExternalMediaLinks';
import type { OverseerrMediaResult } from '../types';
import {
    useOverseerrRequest,
    needsModal as needsModalCheck,
} from '../hooks/useOverseerrRequest';
import type { OverseerrServer } from '../hooks/useOverseerrRequest';

// ============================================================================
// TYPES
// ============================================================================

interface RequestModalProps {
    item: OverseerrMediaResult;
    overseerrInstanceId: string;
    onClose: () => void;
    onRequestComplete: (success: boolean) => void;
    zIndex?: number;
    /** Current request state from parent (syncs inline request state with modal) */
    itemState?: import('../types').RequestButtonState;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RequestModal: React.FC<RequestModalProps> = ({
    item,
    overseerrInstanceId,
    onClose,
    onRequestComplete,
    zIndex,
    itemState,
}) => {
    const {
        servers,
        fetchServers,
        serversLoading,
        tvSeasons,
        fetchTvDetails,
        refetchTvDetails,
        tvLoading,
        requestedSeasonNumbers,
        submitRequest,
        requestState,
        resetRequestState,
    } = useOverseerrRequest({ overseerrInstanceId });

    // Local state for selections
    const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
    const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // Optimistic tracking: seasons we've successfully requested this session
    const [optimisticRequested, setOptimisticRequested] = useState<number[]>([]);
    // External IDs for TMDB/IMDB links
    const [imdbId, setImdbId] = useState<string | null>(null);

    // Determine what controls are needed
    const isTv = item.mediaType === 'tv';
    const showSeasonPicker = isTv;

    // ── Fetch data on mount ──
    useEffect(() => {
        fetchServers();
        if (isTv && item.id) {
            fetchTvDetails(item.id);
        }
        // Fetch IMDB ID for external link
        if (item.id) {
            const mediaTypeParam = isTv ? 'tv' : 'movie';
            fetch(`/api/media/external-ids?tmdbId=${item.id}&mediaType=${mediaTypeParam}`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.imdbId) setImdbId(data.imdbId); })
                .catch(() => { });
        }
    }, [fetchServers, fetchTvDetails, isTv, item.id]);

    // ── Get applicable servers ──
    const applicableServers: OverseerrServer[] = servers
        ? (isTv ? servers.sonarr : servers.radarr)
        : [];
    const showServerPicker = applicableServers.length > 1;

    // ── Season options for MultiSelectDropdown ──
    const seasonOptions = tvSeasons.map(s => ({
        id: String(s.seasonNumber),
        label: s.name,
    }));

    // Combine API-reported requested seasons with optimistic local tracking
    const allRequestedSeasons = [...new Set([...requestedSeasonNumbers, ...optimisticRequested])];

    // Season IDs that are already requested/available (greyed out in dropdown)
    const disabledSeasonIds = allRequestedSeasons.map(String);

    // ── Validation ── (only count non-disabled seasons as actual selections)
    const isValid = (() => {
        if (showServerPicker && !selectedServerId) return false;
        if (showSeasonPicker) {
            const newSelections = selectedSeasons.filter(s => !allRequestedSeasons.includes(s));
            if (newSelections.length === 0) return false;
        }
        return true;
    })();

    // Are ALL seasons already requested/available? (fully done)
    const allSeasonsRequested = isTv && tvSeasons.length > 0 && tvSeasons.every(s =>
        (s.status !== undefined && s.status >= 2) || optimisticRequested.includes(s.seasonNumber)
    );
    // Are SOME seasons requested/available? (partially done)
    const someSeasonsRequested = isTv && allRequestedSeasons.length > 0 && !allSeasonsRequested;

    // ── Handle Request ──
    const handleRequest = useCallback(async () => {
        setSubmitError(null);

        // Determine server and 4K selection
        let serverId = selectedServerId ?? undefined;
        let is4k = false;

        if (serverId && applicableServers.length > 0) {
            const selectedServer = applicableServers.find(s => s.id === serverId);
            is4k = selectedServer?.is4k ?? false;
        } else if (!showServerPicker && applicableServers.length > 0) {
            // Auto-select default non-4K server
            const defaultServer = applicableServers.find(s => s.isDefault && !s.is4k)
                || applicableServers.find(s => !s.is4k)
                || applicableServers[0];
            serverId = defaultServer?.id;
        }

        try {
            const success = await submitRequest({
                mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                mediaId: item.id,
                seasons: isTv ? selectedSeasons.filter(s => !requestedSeasonNumbers.includes(s)) : undefined,
                serverId,
                is4k,
            });

            if (success) {
                if (isTv) {
                    // Optimistically mark the just-requested seasons as disabled
                    const justRequested = selectedSeasons.filter(s => !allRequestedSeasons.includes(s));
                    const updatedRequested = [...new Set([...allRequestedSeasons, ...justRequested])];
                    setOptimisticRequested(prev => [...new Set([...prev, ...justRequested])]);

                    // Check if ALL seasons are now requested
                    const allDone = tvSeasons.length > 0 && tvSeasons.every(s => updatedRequested.includes(s.seasonNumber));
                    // Signal parent: true = all done (set 'requested'), false = partial (keep active)
                    onRequestComplete(allDone);

                    // Also refetch to get authoritative status (may lag behind)
                    refetchTvDetails(item.id);
                    resetRequestState();
                    setSelectedSeasons([]);
                } else {
                    onRequestComplete(true);
                    // Movies: close after brief success display
                    setTimeout(() => onClose(), 1200);
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Request failed';
            setSubmitError(msg);
            onRequestComplete(false);
        }
    }, [
        selectedServerId, selectedSeasons, applicableServers, showServerPicker,
        submitRequest, item, isTv, onRequestComplete, onClose, allRequestedSeasons,
        refetchTvDetails, resetRequestState,
    ]);

    // ── Poster ──
    const posterUrl = item.posterPath
        ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
        : null;

    const isLoading = serversLoading || tvLoading;

    // Combine parent's itemState with local requestState to determine effective state
    const effectiveState = itemState === 'requested' || itemState === 'available'
        ? itemState
        : requestState === 'success' ? 'requested' : requestState;
    // For TV, only "done" if ALL seasons are requested — partial requests can still proceed
    const alreadyDone = isTv
        ? allSeasonsRequested
        : (effectiveState === 'requested' || effectiveState === 'available');

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="md" zIndex={zIndex}>
            <Modal.Header title="Request" />
            <Modal.Body>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* ── Poster + Info ── */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {/* Poster */}
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={item.title}
                                style={{
                                    width: '100px',
                                    height: '150px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    flexShrink: 0,
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '100px',
                                height: '150px',
                                borderRadius: '6px',
                                background: 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Film size={32} style={{ color: 'var(--text-tertiary)' }} />
                            </div>
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{
                                margin: '0 0 0.25rem 0',
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                            }}>
                                {item.title}
                                {item.releaseDate && (
                                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                                        ({new Date(item.releaseDate).getFullYear()})
                                    </span>
                                )}
                            </h3>

                            {/* Type + Rating row */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                            }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    padding: '0.125rem 0.375rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    color: 'var(--text-tertiary)',
                                }}>
                                    {isTv ? <Tv size={10} /> : <Film size={10} />}
                                    {isTv ? 'TV' : 'Movie'}
                                </span>
                                {typeof item.voteAverage === 'number' && item.voteAverage > 0 && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-tertiary)',
                                    }}>
                                        <Star size={11} style={{ color: 'var(--warning)' }} />
                                        {item.voteAverage.toFixed(1)}
                                    </span>
                                )}
                            </div>

                            {/* Synopsis (truncated) */}
                            {item.overview && (
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.8125rem',
                                    lineHeight: 1.5,
                                    color: 'var(--text-secondary)',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {item.overview}
                                </p>
                            )}

                            <ExternalMediaLinks
                                tmdbId={item.id}
                                imdbId={imdbId}
                                mediaType={isTv ? 'tv' : 'movie'}
                                className="mt-2"
                            />
                        </div>
                    </div>

                    {/* ── Loading state ── */}
                    {isLoading && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem',
                            color: 'var(--text-tertiary)',
                        }}>
                            <Loader2 size={18} className="animate-spin" />
                        </div>
                    )}

                    {/* ── Server Picker (only if 4K available) ── */}
                    {!isLoading && showServerPicker && applicableServers.length > 0 && (
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-tertiary)',
                                marginBottom: '0.375rem',
                            }}>
                                Server
                            </label>
                            <Select
                                value={selectedServerId != null ? String(selectedServerId) : ''}
                                onValueChange={(val: string) => setSelectedServerId(val ? Number(val) : null)}
                            >
                                <Select.Trigger>
                                    <Select.Value placeholder="Select server..." />
                                </Select.Trigger>
                                <Select.Content portal={false}>
                                    {applicableServers.map(server => (
                                        <Select.Item key={server.id} value={String(server.id)}>
                                            {server.name}{server.is4k ? ' (4K)' : ''}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>
                    )}

                    {/* ── Season Picker (only for TV shows) ── */}
                    {!isLoading && showSeasonPicker && seasonOptions.length > 0 && (
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-tertiary)',
                                marginBottom: '0.375rem',
                            }}>
                                Seasons
                                {someSeasonsRequested && (() => {
                                    // Check if any season is available (status 5) → "Partially Available"
                                    const hasAvailableSeason = tvSeasons.some(s => s.status === 5)
                                        || optimisticRequested.length > 0 && tvSeasons.some(s => s.status !== undefined && s.status >= 4);
                                    const badgeText = hasAvailableSeason ? 'Partially Available' : 'Partially Requested';
                                    return (
                                        <span style={{
                                            fontSize: '0.625rem',
                                            fontWeight: 500,
                                            textTransform: 'none',
                                            letterSpacing: 'normal',
                                            padding: '0.125rem 0.375rem',
                                            borderRadius: '0.25rem',
                                            background: 'var(--warning-glass, rgba(234, 179, 8, 0.15))',
                                            color: 'var(--warning)',
                                        }}>
                                            {badgeText}
                                        </span>
                                    );
                                })()}
                                {allSeasonsRequested && (
                                    <span style={{
                                        fontSize: '0.625rem',
                                        fontWeight: 500,
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem',
                                        background: 'var(--success-glass, rgba(34, 197, 94, 0.15))',
                                        color: 'var(--success)',
                                    }}>
                                        All Requested
                                    </span>
                                )}
                            </label>
                            <MultiSelectDropdown
                                options={seasonOptions}
                                selectedIds={selectedSeasons.map(String)}
                                onChange={(ids) => setSelectedSeasons(ids.map(Number))}
                                placeholder="Select seasons..."
                                showBulkActions={true}
                                disabledIds={disabledSeasonIds}
                                zIndex={(zIndex || 100) + 10}
                            />
                        </div>
                    )}

                    {/* ── Error ── */}
                    {submitError && (
                        <div style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            background: 'var(--error-glass, rgba(239,68,68,0.15))',
                            color: 'var(--error)',
                        }}>
                            {submitError}
                        </div>
                    )}

                    {/* ── Footer Buttons ── */}
                    {!isLoading && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.5rem',
                            paddingTop: '0.25rem',
                        }}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                            >
                                {alreadyDone ? 'Close' : 'Cancel'}
                            </Button>
                            {alreadyDone ? (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled
                                    customColor={{
                                        background: effectiveState === 'available' ? 'var(--success)' : 'var(--warning)',
                                        text: '#fff',
                                    }}
                                >
                                    {effectiveState === 'available' ? 'Available' : 'Requested'}
                                </Button>
                            ) : (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={!isValid || requestState === 'loading' || requestState === 'success'}
                                    loading={requestState === 'loading'}
                                    onClick={handleRequest}
                                >
                                    {requestState === 'success' ? 'Requested ✓' : 'Request'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
};

// Re-export to make decision accessible from widget
export { needsModalCheck as needsModal };
