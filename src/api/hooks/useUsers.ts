/**
 * Users React Query Hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, CreateUserData, UpdateUserData } from '../endpoints/users';
import { UserId } from '../types';
import { queryKeys } from '../queryKeys';

// Alias for brevity within this file
const usersKeys = queryKeys.users;

/**
 * Hook to get all users
 */
export function useUsers() {
    return useQuery({
        queryKey: usersKeys.list(),
        queryFn: () => usersApi.getAll(),
    });
}

/**
 * Hook to get single user
 */
export function useUser(id: UserId) {
    return useQuery({
        queryKey: usersKeys.detail(id),
        queryFn: () => usersApi.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create user
 */
export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateUserData) => usersApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
        },
    });
}

/**
 * Hook to update user
 */
export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: UserId; data: UpdateUserData }) =>
            usersApi.update(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
            queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.id) });
        },
    });
}

/**
 * Hook to delete user
 */
export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: UserId) => usersApi.delete(id),
        onSuccess: () => {
            // Invalidate user lists
            queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
            // Invalidate widget shares since user deletion cleans up their shares
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.allShares() });
            queryClient.invalidateQueries({ queryKey: queryKeys.widgets.access() });
        },
    });
}
