/**
 * Widget Types
 * Shared between frontend (Dashboard, AppDataContext) and backend (widget routes)
 */

/**
 * Widget type identifiers
 */
export type WidgetTypeKey =
    | 'system-status'
    | 'plex'
    | 'sonarr'
    | 'radarr'
    | 'overseerr'
    | 'qbittorrent'
    | 'weather'
    | 'calendar'
    | 'custom-html'
    | 'link-grid'
    | 'clock';

/**
 * Widget category for grouping in widget picker
 */
export type WidgetCategory = 'system' | 'media' | 'downloads' | 'utility' | 'other';

/**
 * Layout position for a widget at a specific breakpoint
 */
export interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}
// ============================================
// FramerrWidget - Library-Agnostic Widget Type
// ============================================

/**
 * FramerrWidget - The canonical widget type for Framerr
 * 
 * Library-agnostic widget representation. RGL-specific fields are
 * only added at the grid render boundary in src/shared/grid/.
 * 
 * @example
 * const widget: FramerrWidget = {
 *   id: 'widget-123',
 *   type: 'plex',
 *   layout: { x: 0, y: 0, w: 6, h: 4 },
 *   config: { integrationId: 'plex-1' }
 * };
 */
export interface FramerrWidget {
    /** Unique widget identifier */
    id: string;

    /** Widget type key from registry */
    type: WidgetTypeKey | string;

    /** Desktop layout position (primary) */
    layout: WidgetLayout;

    /** Mobile layout position (when independent mode) */
    mobileLayout?: WidgetLayout;

    /** Widget-specific configuration */
    config?: WidgetConfig;

    /** Template-only: Whether to share sensitive config values (links, HTML, etc) */
    shareSensitiveConfig?: boolean;
}

/**
 * Base widget configuration
 * Extended by specific widget configs
 */
export interface WidgetConfig {
    /** Integration instance ID for widgets bound to an integration (e.g., 'radarr-4k') */
    integrationId?: string;
    /** Multiple integration IDs for multi-source widgets like Calendar */
    integrationIds?: string[];
    /** Custom icon name for the widget */
    customIcon?: string;
    /** Widget display title */
    title?: string;
    /** Custom display name set by user */
    customName?: string;
    /** Whether to flatten the widget (remove glassmorphism) */
    flatten?: boolean;
    /** Whether to show the widget header */
    showHeader?: boolean;
    /** Allow additional widget-specific properties */
    [key: string]: unknown;
}

// ============================================
// Widget-Specific Configurations
// ============================================

export interface ClockWidgetConfig extends WidgetConfig {
    format?: '12h' | '24h';
    showDate?: boolean;
    timezone?: string;
}

export interface PlexWidgetConfig extends WidgetConfig {
    hideWhenEmpty?: boolean;
}

export interface WeatherWidgetConfig extends WidgetConfig {
    units?: 'imperial' | 'metric';
    location?: string;
}

export interface LinkGridItem {
    id: string;
    name: string;
    url: string;
    icon?: string;
}

export interface LinkGridWidgetConfig extends WidgetConfig {
    links: LinkGridItem[];
    columns?: number;
}

export interface MediaWidgetConfig extends WidgetConfig {
    limit?: number;
    showType?: 'all' | 'movie' | 'tv';
}

export interface QBittorrentWidgetConfig extends WidgetConfig {
    showCompleted?: boolean;
    limit?: number;
}

export interface SystemStatusWidgetConfig extends WidgetConfig {
    refreshInterval?: number;
    showCpu?: boolean;
    showMemory?: boolean;
    showDisk?: boolean;
}

export interface CalendarWidgetConfig extends WidgetConfig {
    showSonarr?: boolean;
    showRadarr?: boolean;
    daysToShow?: number;
}

export interface CustomHtmlWidgetConfig extends WidgetConfig {
    html?: string;
    css?: string;
}
