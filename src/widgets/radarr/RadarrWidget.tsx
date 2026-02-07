import React, { useState } from 'react';
import { Film } from 'lucide-react';
import { Popover } from '@/shared/ui';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { usePopoverState } from '../../hooks/usePopoverState';
import type { WidgetProps } from '../types';

interface Movie {
    id: number;
    title?: string;
    year?: number;
    physicalRelease?: string;
    digitalRelease?: string;
    inCinemas?: string;
    overview?: string;
}

interface MoviePopoverProps {
    movie: Movie;
}

// Movie Detail Popover Component - PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
const MoviePopover = ({ movie }: MoviePopoverProps): React.JSX.Element => {
    const { isOpen, onOpenChange } = usePopoverState();

    const title = movie.title || 'Unknown Movie';
    const year = movie.year;
    const releaseDate = movie.physicalRelease || movie.inCinemas || movie.digitalRelease;
    const overview = movie.overview || 'No description available.';

    // Determine release type
    let releaseType = 'Release';
    if (movie.physicalRelease) releaseType = 'Physical Release';
    else if (movie.digitalRelease) releaseType = 'Digital Release';
    else if (movie.inCinemas) releaseType = 'In Cinemas';

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                <button
                    style={{
                        padding: '0.5rem',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '0.5rem',
                        fontSize: '0.85rem',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    className="hover:bg-theme-tertiary"
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }} className="text-theme-primary">{title}</div>
                    <div style={{ fontSize: '0.75rem' }} className="text-theme-secondary">
                        {year} • {releaseDate ? new Date(releaseDate).toLocaleDateString() : 'TBA'}
                    </div>
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="min-w-[200px] max-w-[300px]"
            >
                {/* Movie Title */}
                <div className="text-sm font-semibold mb-2 text-theme-primary">
                    {title}
                </div>

                {/* Year */}
                {year && (
                    <div className="text-xs text-success mb-2 font-medium">
                        {year}
                    </div>
                )}

                {/* Release Date */}
                <div className="text-xs text-theme-secondary mb-2">
                    {releaseType}: {releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }) : 'TBA'}
                </div>

                {/* Overview */}
                {overview && (
                    <div className="text-xs text-theme-secondary leading-relaxed max-h-[150px] overflow-auto custom-scrollbar">
                        {overview}
                    </div>
                )}
            </Popover.Content>
        </Popover>
    );
};

interface RadarrConfig {
    integrationId?: string;
    [key: string]: unknown;
}

export interface RadarrWidgetProps extends WidgetProps {
    // No additional props needed
}

// Preview mode mock movies
const PREVIEW_MOVIES: Movie[] = [
    { id: 1, title: 'Dune: Part Two', year: 2024, physicalRelease: '2024-03-01' },
    { id: 2, title: 'Oppenheimer', year: 2023, physicalRelease: '2023-07-21' },
    { id: 3, title: 'Barbie', year: 2023, physicalRelease: '2023-07-21' },
    { id: 4, title: 'Avatar 3', year: 2025, inCinemas: '2025-12-19' },
    { id: 5, title: 'Deadpool 4', year: 2025 },
];

const RadarrWidget = ({ widget, previewMode = false }: RadarrWidgetProps): React.JSX.Element => {
    // Preview mode: skip all data fetching and show mock data
    if (previewMode) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>Upcoming Movies</div>
                {PREVIEW_MOVIES.map(movie => (
                    <div
                        key={movie.id}
                        style={{
                            padding: '0.35rem 0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '0.35rem',
                            fontSize: '0.7rem',
                        }}
                    >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {movie.title}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                            {movie.year} • {movie.physicalRelease || movie.inCinemas || 'TBA'}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound (new pattern: explicit integrationId in config)
    const config = widget.config as RadarrConfig | undefined;
    const configuredIntegrationId = config?.integrationId;

    // Use unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('radarr', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // State for calendar data from SSE
    const [movies, setMovies] = useState<Movie[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to calendar SSE topic - server polls every 5 min, pushes only on change
    // P9: Also get isConnected to prevent premature empty state
    const { loading, isConnected } = useIntegrationSSE<{ items: Movie[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'calendar',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            // SSE data is wrapped as {items: [...], _meta: {...}} to survive delta patching
            const items = data?.items;
            const allMovies = Array.isArray(items) ? items : [];

            // Filter to only show today onwards (Upcoming Media)
            // Calendar widget uses the full range, this widget shows only upcoming
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            const upcomingMovies = allMovies.filter(movie => {
                // Use the earliest available release date
                const releaseDate = movie.physicalRelease || movie.digitalRelease || movie.inCinemas;
                if (!releaseDate) return false;
                return new Date(releaseDate) >= today;
            });

            setMovies(upcomingMovies);
            setError(null);
        },
        onError: (err) => {
            setError(err.message || 'Failed to load calendar');
        }
    });

    // NOW we can have early returns (after all hooks have been called)

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="Radarr"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="Radarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="Radarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // P9: Show loading while SSE not connected OR waiting for first data
    if ((loading && movies.length === 0) || (!isConnected && movies.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        // Use 'unavailable' variant for connection/service errors from backend
        const isServiceUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName="Radarr"
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    const displayMovies = movies.slice(0, 5);

    if (displayMovies.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Film}
                emptyTitle="No Upcoming Movies"
                emptySubtitle="Check back later for new releases"
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Upcoming Movies</span>
            </div>
            {displayMovies.map(movie => (
                <MoviePopover key={movie.id} movie={movie} />
            ))}
        </div>
    );
};

export default RadarrWidget;


