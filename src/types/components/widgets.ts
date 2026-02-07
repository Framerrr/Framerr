/**
 * Widget Component Props
 * Props types for widget components
 */

import type { ComponentType, ReactNode } from 'react';
import type { FramerrWidget, WidgetConfig } from '../../../shared/types/widget';
import type { IntegrationsMap } from '../../../shared/types/integration';

// ============================================
// WidgetWrapper
// ============================================

export interface WidgetWrapperProps {
    id: string;
    type: string;
    title?: string;
    icon?: ComponentType<{ size?: number; className?: string }>;
    editMode?: boolean;
    flatten?: boolean;
    showHeader?: boolean;
    onDelete?: (id: string) => void;
    children: ReactNode;
}

// ============================================
// WidgetErrorBoundary
// ============================================

export interface WidgetErrorBoundaryProps {
    children: ReactNode;
    widgetType?: string;
}

export interface WidgetErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    showDetails: boolean;
}

// ============================================
// Base Widget Props
// ============================================

/**
 * Base props shared by most widget components
 */
export interface BaseWidgetProps {
    config?: WidgetConfig;
    editMode?: boolean;
    widgetId?: string;
    onVisibilityChange?: (widgetId: string, visible: boolean) => void;
}

// ============================================
// Widget-Specific Props
// ============================================

export interface PlexWidgetProps extends BaseWidgetProps {
    config?: {
        hideWhenEmpty?: boolean;
    };
}

export interface WeatherWidgetProps extends BaseWidgetProps {
    config?: {
        units?: 'imperial' | 'metric';
        location?: string;
    };
}

export interface ClockWidgetProps extends BaseWidgetProps {
    config?: {
        format?: '12h' | '24h';
        showDate?: boolean;
        timezone?: string;
    };
}

export interface CalendarWidgetProps extends BaseWidgetProps {
    config?: {
        showSonarr?: boolean;
        showRadarr?: boolean;
        daysToShow?: number;
    };
}

export interface LinkGridWidgetProps extends BaseWidgetProps {
    config?: {
        links?: Array<{
            id: string;
            name: string;
            url: string;
            icon?: string;
        }>;
        columns?: number;
    };
}

export interface CustomHtmlWidgetProps extends BaseWidgetProps {
    config?: {
        html?: string;
        css?: string;
    };
}

export interface SystemStatusWidgetProps extends BaseWidgetProps {
    config?: {
        refreshInterval?: number;
        showCpu?: boolean;
        showMemory?: boolean;
        showDisk?: boolean;
    };
}

export interface MediaWidgetProps extends BaseWidgetProps {
    config?: {
        limit?: number;
        showType?: 'all' | 'movie' | 'tv';
    };
}

// ============================================
// Widget State Types
// ============================================

/**
 * Weather data from API
 */
export interface WeatherData {
    temp: number;
    code: number;
    high: number;
    low: number;
    location: string;
    humidity?: number;
    windSpeed?: number;
}

/**
 * Weather condition info
 */
export interface WeatherInfo {
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Plex session data
 */
export interface PlexSession {
    sessionId: string;
    title: string;
    type: 'movie' | 'episode' | 'track';
    thumb?: string;
    user: string;
    state: 'playing' | 'paused' | 'buffering';
    progress?: number;
    duration?: number;
    transcodeProgress?: number;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    type: 'sonarr' | 'radarr';
    airDate?: string;
    premiereDate?: string;
    seriesTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    year?: number;
}

/**
 * Torrent data from qBittorrent
 */
export interface TorrentData {
    hash: string;
    name: string;
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    state: string;
    eta: number;
}

/**
 * System status data
 */
export interface SystemStatusData {
    cpu: {
        usage: number;
        cores?: number;
    };
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    disk: Array<{
        mount: string;
        used: number;
        total: number;
        percentage: number;
    }>;
    uptime?: number;
}

// ============================================
// Dashboard Components
// ============================================

export interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (widgetType: string) => void;
    integrations?: IntegrationsMap;
    isAdmin?: boolean;
    sharedIntegrations?: string[];
}

export interface EmptyDashboardProps {
    onAddWidget?: () => void;
}

export interface WidgetGridProps {
    widgets: FramerrWidget[];
    editMode: boolean;
    onLayoutChange?: (layout: FramerrWidget[]) => void;
    onDeleteWidget?: (id: string) => void;
}
