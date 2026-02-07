/**
 * Widget Types
 * 
 * Type definitions for the widgets feature domain.
 * Re-exports FramerrWidget as Widget for local use.
 */

// Re-export the canonical widget type
export type { FramerrWidget as Widget, WidgetLayout, WidgetConfig, FramerrWidget } from '../../../shared/types/widget';

export interface WidgetStats {
    total: number;
    byType: Record<string, number>;
}

export type MobileLayoutMode = 'linked' | 'independent';
export type ViewMode = 'desktop' | 'mobile';

// Gallery-specific types
export interface IntegrationConfig {
    enabled: boolean;
    url?: string;
    apiKey?: string;
    backend?: 'glances' | 'custom';
    glances?: { url?: string };
    custom?: { url?: string };
    isConfigured?: boolean;
    [key: string]: unknown;
}

export interface SharedIntegration {
    name: string;
    url?: string;
    apiKey?: string;
    sharedBy?: string;
}
