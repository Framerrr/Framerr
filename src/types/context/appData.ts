/**
 * AppDataContext Types
 * Types for application data state
 */

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
}

/**
 * AppDataProvider props
 */
export interface AppDataProviderProps {
    children: React.ReactNode;
}
