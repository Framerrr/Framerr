/**
 * Build Info Hook
 * 
 * Fetches build channel from /api/health to determine if running
 * a beta (`:develop`) or stable (`:latest`/`:vX.X.X`) Docker image.
 * 
 * Badge is only shown for `beta` channel — not for `dev` (local) or `stable` (production).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface HealthResponse {
    status: string;
    timestamp: string;
    version: string;
    channel: string;
    environment: string;
    logLevel?: string;
}

export interface BuildInfo {
    version: string;
    channel: string;
    isBeta: boolean;
}

/**
 * Hook to get build info (version + channel).
 * Fetched once at startup, very long staleTime since it never changes at runtime.
 */
export function useBuildInfo(): BuildInfo {
    const { data } = useQuery({
        queryKey: ['build-info'],
        queryFn: () => api.get<HealthResponse>('/api/health'),
        staleTime: Infinity, // Never refetch — channel doesn't change at runtime
        gcTime: Infinity,
        retry: 1,
    });

    return {
        version: data?.version ?? '',
        channel: data?.channel ?? 'dev',
        isBeta: data?.channel === 'beta',
    };
}
