/**
 * Metric History Config Hooks
 * 
 * React Query hooks for fetching and updating per-integration
 * metric history configuration (mode, retention, availability).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../client';
import { queryKeys } from '../queryKeys';

// ============================================================================
// Types
// ============================================================================

export type MetricHistoryMode = 'auto' | 'internal' | 'external' | 'off';

export interface MetricHistoryIntegrationConfig {
    mode: MetricHistoryMode;
    retentionDays: number;
}

export interface MetricHistoryIntegrationResponse {
    success: boolean;
    integrationId: string;
    globalEnabled: boolean;
    config: MetricHistoryIntegrationConfig;
}

export interface MetricHistoryStatusResponse {
    success: boolean;
    enabled: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch global metric history status (enabled/disabled).
 */
export function useMetricHistoryStatus() {
    return useQuery({
        queryKey: queryKeys.metricHistory.status(),
        queryFn: () => api.get<MetricHistoryStatusResponse>('/api/metric-history/status'),
        staleTime: 0, // Always refetch on mount — lightweight call, ensures toggle changes propagate immediately
        refetchOnMount: 'always',
    });
}

/**
 * Fetch per-integration metric history config + availability.
 * Only fetches when integrationId is provided.
 */
export function useMetricHistoryConfig(integrationId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.metricHistory.integration(integrationId ?? ''),
        queryFn: () => api.get<MetricHistoryIntegrationResponse>(
            `/api/metric-history/integration/${integrationId}`
        ),
        enabled: !!integrationId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Mutation to update per-integration metric history config.
 * Invalidates the integration-specific query on success.
 */
export function useUpdateMetricHistoryConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ integrationId, config }: {
            integrationId: string;
            config: Partial<MetricHistoryIntegrationConfig>;
        }) => api.put<{ success: boolean; integrationId: string; config: MetricHistoryIntegrationConfig }>(
            `/api/metric-history/integration/${integrationId}`,
            config
        ),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.metricHistory.integration(variables.integrationId)
            });
        },
    });
}
