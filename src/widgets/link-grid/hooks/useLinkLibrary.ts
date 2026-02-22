/**
 * useLinkLibrary Hook
 * 
 * React Query hooks for link library template CRUD.
 * Library templates are independent reusable presets — no sync with widget links.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linkLibraryApi } from '../../../api/endpoints/linkLibrary';
import { queryKeys } from '../../../api/queryKeys';

/**
 * Fetch all library templates for the current user
 */
export function useLinkLibraryLinks() {
    return useQuery({
        queryKey: queryKeys.linkLibrary.list(),
        queryFn: async () => {
            const data = await linkLibraryApi.getAll();
            return data.links;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Delete a library template
 */
export function useDeleteLibraryLink() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => linkLibraryApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.linkLibrary.list() });
        },
    });
}
