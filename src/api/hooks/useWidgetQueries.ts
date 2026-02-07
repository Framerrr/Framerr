/**
 * Widget & Template React Query Hooks
 * 
 * Hooks for widget sharing and template management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { widgetSharesApi, SaveSharesData, UsersAndGroupsResponse, ExistingSharesResponse } from '../endpoints/widgetShares';
import { templatesApi, CreateTemplateData, UpdateTemplateData, Template } from '../endpoints/templates';
import { queryKeys } from '../queryKeys';

// ============================================================================
// WIDGET SHARES
// ============================================================================

/**
 * Get widget type access for current user
 */
export function useMyWidgetAccess() {
    return useQuery({
        queryKey: queryKeys.widgets.access(),
        queryFn: () => widgetSharesApi.getMyAccess(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Get users and groups for admin sharing modal
 */
export function useUsersAndGroups() {
    return useQuery({
        queryKey: ['admin', 'usersAndGroups'] as const,
        queryFn: () => widgetSharesApi.getUsersAndGroups(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Get existing shares for a widget type (admin)
 */
export function useWidgetSharesFor(widgetType: string) {
    return useQuery({
        queryKey: queryKeys.widgets.shares(widgetType),
        queryFn: () => widgetSharesApi.getExisting(widgetType),
        enabled: !!widgetType,
    });
}

/**
 * Get all widget shares across all widget types (admin)
 * Used by the Shared Widgets settings page
 */
export function useAllWidgetShares() {
    return useQuery({
        queryKey: queryKeys.widgets.allShares(),
        queryFn: () => widgetSharesApi.getAllShares(),
        staleTime: 30 * 1000, // 30 seconds
    });
}

/**
 * Save widget shares (admin)
 */
export function useSaveWidgetShares() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ widgetType, data }: { widgetType: string; data: SaveSharesData }) =>
            widgetSharesApi.save(widgetType, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.shares(variables.widgetType) });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.allShares() });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.access() });
        },
    });
}

/**
 * Revoke all shares for a specific widget type (admin)
 */
export function useRevokeWidgetShares() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (widgetType: string) => widgetSharesApi.revokeWidget(widgetType),
        onSuccess: (_data, widgetType) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.shares(widgetType) });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.allShares() });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.access() });
        },
    });
}

/**
 * Revoke ALL widget and integration shares globally (admin)
 */
export function useRevokeAllShares() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => widgetSharesApi.revokeAll(),
        onSuccess: () => {
            // Invalidate all widget-related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.all });
        },
    });
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Fetch all templates with categories
 */
export function useTemplates() {
    return useQuery({
        queryKey: queryKeys.templates.list(),
        queryFn: () => templatesApi.getAll(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch single template
 */
export function useTemplate(id: string) {
    return useQuery({
        queryKey: queryKeys.templates.detail(Number(id)),
        queryFn: () => templatesApi.getById(id),
        enabled: !!id,
    });
}

/**
 * Create template
 */
export function useCreateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateTemplateData) => templatesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() });
        },
    });
}

/**
 * Update template
 */
export function useUpdateTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateTemplateData }) =>
            templatesApi.update(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.detail(Number(variables.id)) });
        },
    });
}

/**
 * Delete template
 */
export function useDeleteTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => templatesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() });
        },
    });
}

/**
 * Apply template to dashboard
 */
export function useApplyTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => templatesApi.apply(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.dashboard() });
        },
    });
}

/**
 * Get template shares
 */
export function useTemplateShares(id: string) {
    return useQuery({
        queryKey: queryKeys.templates.shares(Number(id)),
        queryFn: () => templatesApi.getShares(id),
        enabled: !!id,
    });
}

/**
 * Share template with user
 */
export function useShareTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, sharedWith }: { id: string; sharedWith: string }) =>
            templatesApi.share(id, sharedWith),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.shares(Number(variables.id)) });
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() });
        },
    });
}

/**
 * Unshare template from user
 */
export function useUnshareTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, sharedWith }: { id: string; sharedWith: string }) =>
            templatesApi.unshare(id, sharedWith),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.shares(Number(variables.id)) });
            queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() });
        },
    });
}
