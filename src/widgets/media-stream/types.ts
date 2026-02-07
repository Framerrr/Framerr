import type { WidgetProps } from '../types';

// ============================================================================
// Props Types
// ============================================================================

/**
 * Plex widget extends WidgetProps with visibility change callback.
 * This allows the widget to notify Dashboard when it should be hidden (hideWhenEmpty feature).
 */
export interface PlexWidgetProps extends WidgetProps {
    /** Callback when widget visibility should change (for hideWhenEmpty feature) */
    onVisibilityChange?: (widgetId: string, isVisible: boolean) => void;
}

// ============================================================================
// Integration Types
// ============================================================================

export interface PlexIntegration {
    enabled?: boolean;
    url?: string;
    token?: string;
}

// ============================================================================
// Session Data Types
// ============================================================================

export interface PlexUser {
    title?: string;
}

export interface PlexSession {
    id?: string;
}

export interface PlexMedia {
    ratingKey?: string;
    [key: string]: unknown;
}

export interface PlexPlayer {
    state?: string;
}

export interface PlexSessionData {
    sessionKey: string;
    user?: PlexUser;
    grandparentTitle?: string;
    title?: string;
    duration?: number;
    viewOffset?: number;
    type?: string;
    parentIndex?: number;
    index?: number;
    art?: string;
    thumb?: string;
    Session?: PlexSession;
    Media?: PlexMedia;
    Player?: PlexPlayer;
    [key: string]: unknown;
}

export interface PlexSessionsResponse {
    sessions?: PlexSessionData[];
}
