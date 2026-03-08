import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import logger from '../../utils/logger';
import { integrationsApi } from '../../api/endpoints/integrations';
import useRealtimeSSE from '../../hooks/useRealtimeSSE';
import type { IntegrationsMap } from '../../../shared/types/integration';

// ============================================================================
// Types
// ============================================================================

interface SharedIntegration {
    name: string;
    enabled: boolean;
    [key: string]: unknown;
}

export interface IntegrationDataContextValue {
    /** Keyed integration configurations */
    integrations: IntegrationsMap;
    /** True when integrations have finished initial load */
    integrationsLoaded: boolean;
    /** Error from loading integrations, null on success */
    integrationsError: Error | null;
}

interface IntegrationDataProviderProps {
    children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const IntegrationDataContext = createContext<IntegrationDataContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export const IntegrationDataProvider = ({ children }: IntegrationDataProviderProps): React.JSX.Element => {
    const { isAuthenticated, user } = useAuth();
    const { onSettingsInvalidate } = useRealtimeSSE();
    const [integrations, setIntegrations] = useState<IntegrationsMap>({});
    const [integrationsLoaded, setIntegrationsLoaded] = useState<boolean>(false);
    const [integrationsError, setIntegrationsError] = useState<Error | null>(null);

    const fetchIntegrations = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }

        // Only fetch admin-only endpoints for admins
        if (isAdmin(user)) {
            try {
                const integrationsData = await integrationsApi.getAll();
                // Convert array to keyed object if needed
                if (Array.isArray(integrationsData)) {
                    const keyed: IntegrationsMap = {};
                    integrationsData.forEach(inst => {
                        keyed[inst.type] = inst;
                    });
                    setIntegrations(keyed);
                } else {
                    setIntegrations((integrationsData as { integrations?: IntegrationsMap }).integrations || {});
                }
                setIntegrationsLoaded(true);
                setIntegrationsError(null);
            } catch (intError) {
                logger.debug('Full integrations not available');
                setIntegrations({});
                setIntegrationsLoaded(true);
                setIntegrationsError(intError as Error);
            }
        } else {
            // Non-admin: fetch shared integrations that admin has granted access to
            try {
                const sharedRes = await integrationsApi.getShared();
                const sharedList = (sharedRes.integrations || []) as unknown as SharedIntegration[];

                // Convert array to object keyed by service name for widget compatibility
                const sharedIntegrations: IntegrationsMap = {};
                for (const integration of sharedList) {
                    const { name, ...restIntegration } = integration;
                    sharedIntegrations[name] = {
                        ...restIntegration,
                    };
                }
                setIntegrations(sharedIntegrations);
                setIntegrationsLoaded(true);
                setIntegrationsError(null);
                logger.debug('Shared integrations loaded', { count: sharedList.length });
            } catch (sharedError) {
                logger.debug('Shared integrations not available');
                setIntegrations({});
                setIntegrationsLoaded(true);
                setIntegrationsError(sharedError as Error);
            }
        }
    }, [isAuthenticated, user]);

    // Initial fetch + window event listeners for integration data
    useEffect(() => {
        fetchIntegrations();

        // Listen for integrations updates (when user saves integrations)
        const handleIntegrationsUpdated = (): void => {
            fetchIntegrations();
        };

        // Listen for system config updates (preserves identical trigger set)
        const handleSystemConfigUpdated = (): void => {
            fetchIntegrations();
        };

        window.addEventListener('integrationsUpdated', handleIntegrationsUpdated);
        window.addEventListener('systemConfigUpdated', handleSystemConfigUpdated);

        return () => {
            window.removeEventListener('integrationsUpdated', handleIntegrationsUpdated);
            window.removeEventListener('systemConfigUpdated', handleSystemConfigUpdated);
        };
    }, [fetchIntegrations]);

    // SSE: Listen for app-config invalidation (identical SSE entity)
    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'app-config') {
                logger.debug('[IntegrationDataProvider] App config invalidated via SSE, refreshing integrations');
                fetchIntegrations();
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate, fetchIntegrations]);

    // Refresh data when tab becomes visible after being hidden for 30+ seconds
    useEffect(() => {
        let lastHiddenTime: number | null = null;
        const REFRESH_THRESHOLD = 30000; // 30 seconds

        const handleVisibilityChange = (): void => {
            if (document.hidden) {
                lastHiddenTime = Date.now();
            } else if (lastHiddenTime && isAuthenticated) {
                const hiddenDuration = Date.now() - lastHiddenTime;
                if (hiddenDuration > REFRESH_THRESHOLD) {
                    logger.info('[Visibility] Tab restored after idle, refreshing integration data', {
                        hiddenFor: Math.round(hiddenDuration / 1000) + 's'
                    });
                    fetchIntegrations();
                }
                lastHiddenTime = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, fetchIntegrations]);

    // Memoize context value to prevent unnecessary re-renders
    const value: IntegrationDataContextValue = useMemo(() => ({
        integrations,
        integrationsLoaded,
        integrationsError,
    }), [integrations, integrationsLoaded, integrationsError]);

    return (
        <IntegrationDataContext.Provider value={value}>
            {children}
        </IntegrationDataContext.Provider>
    );
};

// ============================================================================
// Hook
// ============================================================================

export const useIntegrationData = (): IntegrationDataContextValue => {
    const context = useContext(IntegrationDataContext);
    if (!context) {
        throw new Error('useIntegrationData must be used within an IntegrationDataProvider');
    }
    return context;
};

export { IntegrationDataContext };
