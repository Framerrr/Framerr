/**
 * Auth React Query Hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, LoginCredentials } from '../endpoints/auth';
import { queryKeys } from '../queryKeys';

// Alias for brevity within this file
const authKeys = queryKeys.auth;

/**
 * Hook to get current session/user
 */
export function useSession() {
    return useQuery({
        queryKey: authKeys.session(),
        queryFn: () => authApi.getSession(),
        staleTime: 1000 * 60, // 1 minute
        retry: false, // Don't retry auth checks
    });
}

/**
 * Hook to check if app is set up
 */
export function useSetupStatus() {
    return useQuery({
        queryKey: authKeys.setup(),
        queryFn: () => authApi.checkSetup(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook for login mutation
 */
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
        onSuccess: () => {
            // Invalidate session query to refetch user data
            queryClient.invalidateQueries({ queryKey: authKeys.session() });
        },
    });
}

/**
 * Hook for logout mutation
 */
export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => authApi.logout(),
        onSuccess: () => {
            // Clear all cached queries on logout
            queryClient.clear();
        },
    });
}
