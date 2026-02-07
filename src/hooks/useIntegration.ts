import { useContext } from 'react';
import { AppDataContext } from '../context/AppDataContext';
import type { BaseIntegration, IntegrationsMap } from '../../shared/types/integration';
import type { AppDataContextValue } from '../types/context/appData';

/**
 * Default disabled integration config
 */
const defaultIntegration: BaseIntegration = {
    enabled: false,
    url: '',
    apiKey: ''
};

/**
 * Hook to get a specific integration config
 */
export const useIntegration = (integrationKey: string): BaseIntegration => {
    const context = useContext(AppDataContext) as AppDataContextValue | null;
    const integrations = context?.integrations;

    // Return the specific integration config or a default disabled config
    return integrations?.[integrationKey] || defaultIntegration;
};

/**
 * Return type for useFetchIntegration
 */
export interface UseFetchIntegrationResult {
    data: null;
    loading: boolean;
    error: string | null;
}

/**
 * Mock fetch integration hook for widget compatibility
 * In a recovered build, this would fetch live data
 */
export const useFetchIntegration = (integrationKey: string): UseFetchIntegrationResult => {
    const config = useIntegration(integrationKey);

    return {
        data: null,
        loading: !config.enabled,
        error: config.enabled ? null : 'Integration not configured'
    };
};
