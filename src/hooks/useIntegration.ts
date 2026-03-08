import { useIntegrationData } from '../app/providers/IntegrationDataProvider';
import type { BaseIntegration } from '../../shared/types/integration';

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
    const { integrations } = useIntegrationData();

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
