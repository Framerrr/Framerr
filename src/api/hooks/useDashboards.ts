/**
 * Dashboard list / preferences React Query hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    dashboardsApi,
    CreateDashboardData,
    UpdateDashboardData,
    DashboardPreferencesData,
} from '../endpoints/dashboards';
import { queryKeys } from '../queryKeys';

export function useDashboards() {
    return useQuery({
        queryKey: queryKeys.dashboards.list(),
        queryFn: () => dashboardsApi.list(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateDashboard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateDashboardData) => dashboardsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
        },
    });
}

export function useUpdateDashboard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateDashboardData }) =>
            dashboardsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list() });
        },
    });
}

export function useDeleteDashboard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => dashboardsApi.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
        },
    });
}

export function useSetDashboardPreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: DashboardPreferencesData) => dashboardsApi.setPreferences(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list() });
        },
    });
}
