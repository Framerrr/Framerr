import React, { useState } from 'react';
import { Tv } from 'lucide-react';
import { Popover } from '@/shared/ui';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { usePopoverState } from '../../hooks/usePopoverState';
import type { WidgetProps } from '../types';

interface Series {
    title?: string;
    overview?: string;
}

interface Episode {
    id: number;
    seriesTitle?: string;
    series?: Series;
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    overview?: string;
}

interface EpisodePopoverProps {
    episode: Episode;
}

// Episode Detail Popover Component - PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
const EpisodePopover = ({ episode }: EpisodePopoverProps): React.JSX.Element => {
    const { isOpen, onOpenChange } = usePopoverState();

    const seriesTitle = episode.series?.title || episode.seriesTitle || 'Unknown Series';
    const episodeTitle = episode.title || 'TBA';
    const seasonNum = episode.seasonNumber ?? '?';
    const episodeNum = episode.episodeNumber ?? '?';
    const airDate = episode.airDate || episode.airDateUtc;
    const overview = episode.overview || episode.series?.overview || 'No description available.';

    const displayTitle = episodeTitle !== 'TBA'
        ? `${seriesTitle} - ${episodeTitle}`
        : seriesTitle;

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
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }} className="text-theme-primary">{displayTitle}</div>
                    <div style={{ fontSize: '0.75rem' }} className="text-theme-secondary">
                        S{seasonNum}E{episodeNum} • {airDate ? new Date(airDate).toLocaleDateString() : 'TBA'}
                    </div>
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="min-w-[200px] max-w-[300px]"
            >
                {/* Series Title */}
                <div className="text-sm font-semibold mb-2 text-theme-primary">
                    {seriesTitle}
                </div>

                {/* Episode Info */}
                <div className="text-xs text-info mb-2 font-medium">
                    Season {seasonNum} Episode {episodeNum}
                    {episodeTitle !== 'TBA' && ` - ${episodeTitle}`}
                </div>

                {/* Air Date */}
                <div className="text-xs text-theme-secondary mb-2">
                    Airs: {airDate ? new Date(airDate).toLocaleDateString('en-US', {
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

interface SonarrConfig {
    integrationId?: string;
    [key: string]: unknown;
}

export interface SonarrWidgetProps extends WidgetProps {
    // No additional props needed
}

// Preview mode mock episodes
const PREVIEW_EPISODES: Episode[] = [
    { id: 1, seriesTitle: 'The Last of Us', title: 'TBA', seasonNumber: 2, episodeNumber: 3, airDate: '2025-01-19' },
    { id: 2, seriesTitle: 'House of Dragon', title: 'TBA', seasonNumber: 3, episodeNumber: 1, airDate: '2025-06-15' },
    { id: 3, seriesTitle: 'The Bear', title: 'TBA', seasonNumber: 4, episodeNumber: 1, airDate: '2025-06-22' },
    { id: 4, seriesTitle: 'Severance', title: 'TBA', seasonNumber: 2, episodeNumber: 6, airDate: '2025-02-14' },
    { id: 5, seriesTitle: 'Wednesday', title: 'TBA', seasonNumber: 2, episodeNumber: 1, airDate: '2025-08-01' },
];

const SonarrWidget = ({ widget, previewMode = false }: SonarrWidgetProps): React.JSX.Element => {
    // Preview mode: skip all data fetching and show mock data
    if (previewMode) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>Upcoming Episodes</div>
                {PREVIEW_EPISODES.map(ep => (
                    <div
                        key={ep.id}
                        style={{
                            padding: '0.35rem 0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '0.35rem',
                            fontSize: '0.7rem',
                        }}
                    >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ep.seriesTitle}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                            S{ep.seasonNumber}E{ep.episodeNumber} • {ep.airDate}
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
    const config = widget.config as SonarrConfig | undefined;
    const configuredIntegrationId = config?.integrationId;

    // Use unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('sonarr', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // State for calendar data from SSE
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to calendar SSE topic - server polls every 5 min, pushes only on change
    // P9: Also get isConnected to prevent premature empty state
    const { loading, isConnected } = useIntegrationSSE<{ items: Episode[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'calendar',
        integrationId,
        enabled: isIntegrationBound,
        onData: (data) => {
            // SSE data is wrapped as {items: [...], _meta: {...}} to survive delta patching
            const items = data?.items;
            const allEpisodes = Array.isArray(items) ? items : [];

            // Filter to only show today onwards (Upcoming Media)
            // Calendar widget uses the full range, this widget shows only upcoming
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            const upcomingEpisodes = allEpisodes.filter(ep => {
                const airDate = ep.airDateUtc || ep.airDate;
                if (!airDate) return false;
                return new Date(airDate) >= today;
            });

            setEpisodes(upcomingEpisodes);
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
                serviceName="Sonarr"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="Sonarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="Sonarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // P9: Show loading while SSE not connected OR waiting for first data
    if ((loading && episodes.length === 0) || (!isConnected && episodes.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        // Use 'unavailable' variant for connection/service errors from backend
        const isServiceUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName="Sonarr"
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    const displayEpisodes = episodes.slice(0, 5);

    if (displayEpisodes.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Tv}
                emptyTitle="No Upcoming Episodes"
                emptySubtitle="Check back later for new releases"
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Upcoming Episodes</span>
            </div>
            {displayEpisodes.map(ep => (
                <EpisodePopover key={ep.id} episode={ep} />
            ))}
        </div>
    );
};

export default SonarrWidget;


