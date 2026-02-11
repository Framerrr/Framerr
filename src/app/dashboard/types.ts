// Dashboard types
// Extracted from Dashboard.tsx during Phase 6.2 refactor

import type { FramerrWidget } from '../../../shared/types/widget';

/**
 * Integration configuration from API
 */
export interface IntegrationConfig {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
    isConfigured?: boolean;  // Backend-computed flag indicating integration is ready
    [key: string]: unknown;
}

/**
 * Shared integration for non-admin users
 */
export interface SharedIntegration {
    name: string;
    [key: string]: unknown;
}

/**
 * Response from /api/widgets endpoint
 */
export interface WidgetApiResponse {
    widgets: FramerrWidget[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: FramerrWidget[];
}

/**
 * Response from /api/config/user endpoint
 */
export interface UserConfigResponse {
    preferences?: {
        mobileEditDisclaimerDismissed?: boolean;
        hideMobileEditButton?: boolean;
        dashboardGreeting?: {
            enabled?: boolean;
            mode?: 'auto' | 'manual';
            text?: string;
            headerVisible?: boolean;
            taglineEnabled?: boolean;
            taglineText?: string;
            tones?: string[];
            loadingMessages?: boolean;
        };
    };
}
