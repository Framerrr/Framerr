/**
 * Media Stream Widget (formerly PlexWidget)
 *
 * Displays active streaming sessions with real-time updates.
 * Supports Plex, Jellyfin, and Emby through unified adapter pattern.
 *
 * Features:
 * - Real-time SSE updates for session changes
 * - Polling fallback when SSE unavailable
 * - Hide when empty option
 * - Admin controls (stop playback)
 * - Mobile-friendly tap interactions
 *
 * Phase 4: Refactored to support multiple media server integrations.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Film, Play } from 'lucide-react';

// Types
import type { MediaSession, IntegrationType } from './adapters';
import { getAdapter } from './adapters';

// Hooks
import { useMediaStream } from './hooks/useMediaStream';
import { useMediaVisibility } from './hooks/useMediaVisibility';
import { useMediaRowLayout } from './hooks/useMediaRowLayout';

// Components
import { SessionCard } from './components/SessionCard';

// UI Primitives
import { ConfirmStopModal } from './modals/ConfirmStopModal';
import PlaybackDataModal from './modals/PlaybackDataModal';
import MediaInfoModal from './modals/MediaInfoModal';

// Common components
import { WidgetStateMessage, useWidgetIntegration } from '../../shared/widgets';

// Context & Utils
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { widgetFetch } from '../../utils/widgetFetch';
import logger from '../../utils/logger';

// Styles
import './styles.css';

// ============================================================================
// TYPES
// ============================================================================

interface MediaStreamWidgetProps {
    widget: {
        id: string;
        config?: {
            integrationId?: string;
            hideWhenEmpty?: boolean;
        };
    };
    isEditMode?: boolean;
    onVisibilityChange?: (widgetId: string, isVisible: boolean) => void;
    previewMode?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MediaStreamWidget: React.FC<MediaStreamWidgetProps> = ({
    widget,
    isEditMode = false,
    onVisibilityChange,
    previewMode = false,
}) => {
    // Preview mode: render mock sessions using real CSS classes for container-query responsiveness
    if (previewMode) {
        const mockSessions = [
            { title: 'Breaking Bad', episode: 'S5E16', user: '@JohnDoe', percent: 65 },
            { title: 'The Office', episode: 'S3E12', user: '@Jane', percent: 32 },
        ];
        return (
            <div className="plex-widget">
                {mockSessions.map((session, i) => (
                    <div key={i} className="plex-card">
                        {/* Image Section */}
                        <div className="plex-card__image">
                            <div
                                className="plex-card__image-placeholder"
                                style={{
                                    background: 'linear-gradient(135deg, #e5a00d 0%, #cc900b 100%)',
                                }}
                            >
                                <Film size={32} className="text-white" style={{ opacity: 0.7 }} />
                            </div>
                            <div className="plex-card__title-overlay">{session.title}</div>
                            {/* Progress bar */}
                            <div className="plex-card__progress">
                                <div
                                    className="plex-card__progress-fill"
                                    style={{ width: `${session.percent}%` }}
                                />
                            </div>
                        </div>
                        {/* Info Section */}
                        <div className="plex-card__info">
                            <div className="plex-card__title">
                                <span className="plex-card__title-text">{session.title}</span>
                            </div>
                            <div className="plex-card__meta">
                                <span className="plex-card__episode">{session.episode}</span>
                                <span className="plex-card__user">{session.user}</span>
                            </div>
                            <div className="plex-card__status">
                                <Play size={10} className="plex-card__status-icon" />
                                <span>{session.percent}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Extract from widget.config
    const config = widget.config;
    const widgetId = widget.id;
    const editMode = isEditMode;

    // Check if integration is bound
    const configuredIntegrationId = config?.integrationId;

    // Use unified access hook for widget + integration access
    // Pass 'media-stream' as the widget type, which is compatible with plex, jellyfin, emby
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('media-stream', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;
    const { hideWhenEmpty = true } = config || {};

    // Derive integration type from ID prefix (e.g., 'plex-abc123' -> 'plex')
    // This follows the same pattern as System-Status widget
    const integrationType: IntegrationType = (integrationId?.split('-')[0] || 'plex') as IntegrationType;

    // Get service name for display based on integration type
    const serviceName =
        integrationType === 'plex' ? 'Plex' : integrationType === 'jellyfin' ? 'Jellyfin' : 'Emby';

    // === Hooks ===
    const { sessions, loading, error, isInitializing, machineId, lastUpdateTime, refreshSessions } = useMediaStream({
        integrationId,
        integrationType,
        isIntegrationBound,
    });

    const { shouldHide } = useMediaVisibility({
        sessions,
        hideWhenEmpty,
        editMode,
        widgetId,
        isIntegrationBound,
        isLoading: loading || isInitializing,
        onVisibilityChange,
    });

    // Container ref for row layout measurement
    const containerRef = useRef<HTMLDivElement>(null);

    // Get row layout based on container dimensions
    const { mode: layoutMode, rows } = useMediaRowLayout(containerRef, sessions);

    // === Local State ===
    const [showPlaybackData, setShowPlaybackData] = useState<MediaSession | null>(null);
    const [showMediaInfo, setShowMediaInfo] = useState<MediaSession | null>(null);
    const [confirmStop, setConfirmStop] = useState<MediaSession | null>(null);
    const [stoppingSession, setStoppingSession] = useState<string | null>(null);

    // Tick every second to update playtime display
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // === Handlers ===
    const handleStopPlayback = async (reason: string): Promise<void> => {
        if (!confirmStop || stoppingSession === confirmStop.sessionKey) return;

        setStoppingSession(confirmStop.sessionKey);

        try {
            const adapter = getAdapter(integrationType);
            const endpoint = adapter.getStopEndpoint(integrationId!);

            // Build stop payload based on raw session data
            const raw = confirmStop._raw as Record<string, unknown>;

            const response = await widgetFetch(endpoint, 'media-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionKey: confirmStop.sessionKey,
                    // Plex-specific fields (ignored by other servers)
                    sessionId: (raw.Session as { id?: string })?.id,
                    transcodeSessionKey: (raw.TranscodeSession as { key?: string })?.key,
                    clientIdentifier: (raw.Player as { machineIdentifier?: string })?.machineIdentifier,
                    reason,
                }),
            });

            if (!response.ok) throw new Error('Failed to stop playback');

            setConfirmStop(null);
            await refreshSessions();
        } catch (err) {
            logger.error('[MediaStream] Error stopping playback', {
                error: (err as Error).message,
                integrationType,
            });
        } finally {
            setTimeout(() => setStoppingSession(null), 2000);
        }
    };

    // === Render Conditions ===

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName={serviceName} />;
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName={serviceName} isAdmin={userIsAdmin} />;
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage variant="notConfigured" serviceName={serviceName} isAdmin={userIsAdmin} />
        );
    }

    // Show loading during initial connection grace period
    if ((loading || isInitializing) && sessions.length === 0) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Only show error after grace period has expired
    if (error && !isInitializing) {
        // Use 'unavailable' variant for connection/service errors from backend
        const isServiceUnavailable =
            error.includes('unavailable') ||
            error.includes('Unable to reach') ||
            error.includes('connection');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName={serviceName}
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    // Hide widget if no sessions and hideWhenEmpty is enabled (not in edit mode)
    if (shouldHide) {
        return null;
    }

    // Empty state
    if (sessions.length === 0) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '0.5rem',
                }}
            >
                <WidgetStateMessage
                    variant="empty"
                    emptyIcon={Film}
                    emptyTitle="No Active Streams"
                    emptySubtitle="Nothing is currently playing"
                />
            </div>
        );
    }

    // === Main Render ===
    // Helper to render session cards
    const renderSessionCard = (session: MediaSession) => (
        <SessionCard
            key={session.sessionKey}
            session={session}
            integrationId={integrationId!}
            machineId={machineId}
            userIsAdmin={userIsAdmin}
            lastUpdateTime={lastUpdateTime}
            onShowPlaybackData={setShowPlaybackData}
            onShowMediaInfo={setShowMediaInfo}
            onConfirmStop={setConfirmStop}
        />
    );

    return (
        <>
            {layoutMode === '1-row' ? (
                // Single row - horizontal scroll
                <div ref={containerRef} className="plex-widget">
                    {rows[0]?.map(renderSessionCard)}
                </div>
            ) : (
                // Multi-row - each row scrolls independently
                <div ref={containerRef} className="plex-widget-multi">
                    {rows.map((rowSessions, rowIndex) => (
                        <div key={rowIndex} className="plex-widget-row">
                            {rowSessions.map(renderSessionCard)}
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation Dialog for Stop Playback */}
            {confirmStop && (
                <ConfirmStopModal
                    session={confirmStop}
                    isLoading={stoppingSession === confirmStop.sessionKey}
                    onConfirm={handleStopPlayback}
                    onCancel={() => setConfirmStop(null)}
                />
            )}

            {/* Playback Data Modal - Pass raw session for server-specific details */}
            {showPlaybackData && (
                <PlaybackDataModal
                    session={showPlaybackData._raw as Parameters<typeof PlaybackDataModal>[0]['session']}
                    onClose={() => setShowPlaybackData(null)}
                />
            )}

            {/* Media Info Modal - Pass raw session for server-specific details */}
            {showMediaInfo && (
                <MediaInfoModal
                    session={showMediaInfo._raw as Parameters<typeof MediaInfoModal>[0]['session']}
                    integrationId={integrationId!}
                    onClose={() => setShowMediaInfo(null)}
                />
            )}
        </>
    );
};

export default MediaStreamWidget;
