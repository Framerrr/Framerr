/**
 * useSessionCardData Hook
 *
 * Computes display data for a media session card.
 * Used by both SessionCard (carousel) and StackedCard (stacked view)
 * to ensure consistent data derivation.
 *
 * Extracts: displayTitle, subtitle, imageUrl, isPlaying, percent,
 * playedStr, durationStr, timeStr, deepLink, externalLinkTitle
 */

import { getAdapter, type MediaSession, type IntegrationType } from '../adapters';
import { getMediaDeepLink, getMediaServerDisplayName } from '../../../shared/utils/mediaDeepLinks';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionCardData {
    displayTitle: string;
    subtitle: string;
    imageUrl: string | null;
    isPlaying: boolean;
    percent: number;
    playedStr: string;
    durationStr: string;
    timeStr: string;
    deepLink: string | null;
    externalLinkTitle: string;
    userName: string;
}

interface UseSessionCardDataProps {
    session: MediaSession;
    integrationId: string;
    machineId: string | null;
    serverUrl: string | null;
    lastUpdateTime: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSessionCardData({
    session,
    integrationId,
    machineId,
    serverUrl,
    lastUpdateTime,
}: UseSessionCardDataProps): SessionCardData {
    const adapter = getAdapter(session.integrationType);

    // Display title: prefer grandparent (show name) for episodes, else title
    const displayTitle = session.grandparentTitle || session.title || 'Unknown';
    const userName = session.userName;

    // Play state
    const isPlaying = session.playerState === 'playing';

    // Calculate progress with local time interpolation
    const duration = session.duration || 0;
    const baseOffset = session.viewOffset || 0;
    const elapsed = isPlaying ? Date.now() - lastUpdateTime : 0;
    const viewOffset = Math.min(baseOffset + elapsed, duration);
    const percent = duration > 0 ? Math.round((viewOffset / duration) * 100) : 0;

    // Format played time
    const playedMin = Math.floor(viewOffset / 60000);
    const playedSec = Math.floor((viewOffset % 60000) / 1000);
    const playedStr = `${playedMin}:${playedSec.toString().padStart(2, '0')}`;

    // Format total duration
    const durationMin = Math.floor(duration / 60000);
    const durationSec = Math.floor((duration % 60000) / 1000);
    const durationStr = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    // Combined time string
    const timeStr = `${playedStr} / ${durationStr}`;

    // Subtitle based on media type
    let subtitle = '';
    if (session.type === 'episode' && session.parentIndex && session.index) {
        subtitle = `S${session.parentIndex} · E${session.index}`;
    } else if (session.type === 'movie') {
        subtitle = 'Movie';
    } else if (session.type === 'track') {
        subtitle = 'Music';
    }

    // Image URL via adapter — prefer art (landscape backdrop), fall back to thumb (poster)
    const imageUrl = session.art
        ? adapter.getImageUrl(session.art, integrationId)
        : session.thumb
            ? adapter.getImageUrl(session.thumb, integrationId)
            : null;

    // Deep link URL via shared utility
    const deepLink = getMediaDeepLink(
        session.integrationType as IntegrationType,
        session.ratingKey || '',
        { machineId: machineId || undefined, serverUrl: serverUrl || undefined }
    );

    // Button title for "Open in [App]"
    const externalLinkTitle = `Open in ${getMediaServerDisplayName(session.integrationType as IntegrationType)}`;

    return {
        displayTitle,
        subtitle,
        imageUrl,
        isPlaying,
        percent,
        playedStr,
        durationStr,
        timeStr,
        deepLink,
        externalLinkTitle,
        userName,
    };
}
