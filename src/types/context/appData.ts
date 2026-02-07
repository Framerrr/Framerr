/**
 * AppDataContext Types
 * Types for application data state
 */

import type { FramerrWidget } from '../../../shared/types/widget';
import type { TabGroup } from '../../../shared/types/tab';
import type { IntegrationsMap } from '../../../shared/types/integration';

/**
 * User settings/preferences
 */
export interface UserSettings {
    serverName?: string;
    serverIcon?: string;
    greeting?: string;
    flattenUI?: boolean;
    customColors?: Record<string, string>;
    theme?: string;
    [key: string]: unknown;
}

/**
 * AppDataContext value provided to consumers
 */
export interface AppDataContextValue {
    /**
     * User-specific settings
     */
    userSettings: UserSettings;

    /**
     * Available services (currently unused, for future expansion)
     */
    services: unknown[];

    /**
     * Tab groups for sidebar organization
     */
    groups: TabGroup[];

    /**
     * User's dashboard widgets
     */
    widgets: FramerrWidget[];

    /**
     * User's integration configurations
     */
    integrations: IntegrationsMap;

    /**
     * True when integrations have finished loading
     */
    integrationsLoaded: boolean;

    /**
     * Error from loading integrations
     */
    integrationsError: Error | null;

    /**
     * True while initial data is loading
     */
    loading: boolean;

    /**
     * Update widget layout (positions and sizes)
     */
    updateWidgetLayout: (widgets: FramerrWidget[]) => Promise<void>;

    /**
     * Refresh all app data from server
     */
    refreshData: () => Promise<void>;
}

/**
 * AppDataProvider props
 */
export interface AppDataProviderProps {
    children: React.ReactNode;
}
