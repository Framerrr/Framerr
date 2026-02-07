/**
 * Integrations React Query Hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi, CreateIntegrationData, UpdateIntegrationData } from '../endpoints/integrations';
import { IntegrationId } from '../types';
import { queryKeys } from '../queryKeys';
import { useAuth } from '../../context/AuthContext';

// Alias for backwards compatibility and brevity within this file
const integrationsKeys = queryKeys.integrations;

/**
 * Hook to get all integrations (admin)
 * WARNING: Only use this in admin-only pages (e.g., IntegrationsSettings)
 * For widgets/dashboard, use useRoleAwareIntegrations() instead
 */
export function useIntegrations() {
    return useQuery({
        queryKey: integrationsKeys.list(),
        queryFn: () => integrationsApi.getAll(),
    });
}

/**
 * Hook to get integrations based on user role (non-admin safe)
 * - Admin: calls /api/integrations (full list)
 * - Non-admin: calls /api/integrations/shared (accessible only)
 * 
 * Use this in widgets, dashboard, and any non-admin-only context
 */
export function useRoleAwareIntegrations() {
    const { user } = useAuth();
    const isAdmin = user?.group === 'admin';

    return useQuery({
        queryKey: isAdmin ? integrationsKeys.list() : integrationsKeys.shared(),
        queryFn: async () => {
            if (isAdmin) {
                // getAll() already returns IntegrationInstance[] (extracts .integrations)
                return integrationsApi.getAll();
            } else {
                // getShared() returns { integrations: [...] }
                const response = await integrationsApi.getShared();
                return response.integrations || [];
            }
        },
    });
}

/**
 * Hook to get all plugin schemas for form generation (P4 Phase 4.4)
 */
export function useIntegrationSchemas() {
    return useQuery({
        queryKey: integrationsKeys.schemas(),
        queryFn: () => integrationsApi.getSchemas(),
        staleTime: Infinity, // Schemas don't change at runtime
        gcTime: Infinity,
    });
}

/**
 * Hook to get accessible integrations (for current user)
 */
export function useAccessibleIntegrations() {
    return useQuery({
        queryKey: integrationsKeys.accessible(),
        queryFn: () => integrationsApi.getAccessible(),
    });
}

/**
 * Hook to get single integration
 */
export function useIntegration(id: IntegrationId) {
    return useQuery({
        queryKey: integrationsKeys.detail(id),
        queryFn: () => integrationsApi.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create integration
 */
export function useCreateIntegration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateIntegrationData) => integrationsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: integrationsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: integrationsKeys.accessible() });
        },
    });
}

/**
 * Hook to update integration
 */
export function useUpdateIntegration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: IntegrationId; data: UpdateIntegrationData }) =>
            integrationsApi.update(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: integrationsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: integrationsKeys.accessible() });
            queryClient.invalidateQueries({ queryKey: integrationsKeys.detail(variables.id) });
        },
    });
}

/**
 * Hook to delete integration
 */
export function useDeleteIntegration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: IntegrationId) => integrationsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: integrationsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: integrationsKeys.accessible() });
        },
    });
}

/**
 * Hook to test integration connection
 */
export function useTestConnection() {
    return useMutation({
        mutationFn: (id: IntegrationId) => integrationsApi.testConnection(id),
    });
}

/**
 * Hook to get shared integrations for current user (non-admin)
 */
export function useSharedIntegrations() {
    return useQuery({
        queryKey: integrationsKeys.shared(),
        queryFn: () => integrationsApi.getShared(),
    });
}

/**
 * Hook to get integrations by type (for widget auto-binding)
 */
export function useIntegrationsByType(type: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: integrationsKeys.byType(type),
        queryFn: () => integrationsApi.getByType(type),
        enabled: options?.enabled ?? !!type,
    });
}
