import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSystemConfigQuery } from '../api/hooks/useConfig';
import { queryKeys } from '../api/queryKeys';
import type { SystemConfigContextValue, SystemConfig } from '../types/context/systemConfig';

const SystemConfigContext = createContext<SystemConfigContextValue | null>(null);

interface SystemConfigProviderProps {
    children: ReactNode;
}

/**
 * SystemConfigProvider - Provides system-wide configuration (admin only)
 * 
 * Modernized in P3 Phase 2 to use React Query for:
 * - Automatic caching and deduplication
 * - Background refresh
 * - Consistent loading/error states
 */
export const SystemConfigProvider = ({ children }: SystemConfigProviderProps): React.JSX.Element => {
    const queryClient = useQueryClient();
    const { data, isLoading } = useSystemConfigQuery();

    // Refresh function that invalidates the React Query cache
    const refreshSystemConfig = useMemo(() => async (): Promise<void> => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.system.config() });
    }, [queryClient]);

    // Memoize context value to prevent unnecessary re-renders
    const value: SystemConfigContextValue = useMemo(() => ({
        systemConfig: (data as SystemConfig) ?? null,
        loading: isLoading,
        refreshSystemConfig
    }), [data, isLoading, refreshSystemConfig]);

    return (
        <SystemConfigContext.Provider value={value}>
            {children}
        </SystemConfigContext.Provider>
    );
};

export const useSystemConfig = (): SystemConfigContextValue => {
    const context = useContext(SystemConfigContext);
    if (!context) {
        throw new Error('useSystemConfig must be used within a SystemConfigProvider');
    }
    return context;
};

