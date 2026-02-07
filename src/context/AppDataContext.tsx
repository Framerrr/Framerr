import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { isAdmin } from '../utils/permissions';
import logger from '../utils/logger';
import { configApi } from '../api/endpoints/config';
import { integrationsApi } from '../api/endpoints/integrations';
import { widgetsApi } from '../api/endpoints/widgets';
import useRealtimeSSE from '../hooks/useRealtimeSSE';
import type { FramerrWidget } from '../../shared/types/widget';
import type { TabGroup } from '../../shared/types/tab';
import type { IntegrationsMap } from '../../shared/types/integration';
import type { AppDataContextValue, UserSettings } from '../types/context/appData';

interface UserConfigResponse {
    preferences?: Record<string, unknown>;
    dashboard?: {
        widgets?: FramerrWidget[];
    };
}

interface SystemConfigResponse {
    tabGroups?: TabGroup[];
}

interface SharedIntegration {
    name: string;
    enabled: boolean;
    url?: string;
    apiKey?: string;
    token?: string;
    [key: string]: unknown;
}

interface AppBrandingResponse {
    name?: string;
    icon?: string;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

interface AppDataProviderProps {
    children: ReactNode;
}

export const AppDataProvider = ({ children }: AppDataProviderProps): React.JSX.Element => {
    const { isAuthenticated, user } = useAuth();
    const { onSettingsInvalidate } = useRealtimeSSE();
    const [userSettings, setUserSettings] = useState<UserSettings>({});
    const [services, setServices] = useState<unknown[]>([]);
    const [groups, setGroups] = useState<TabGroup[]>([]);
    const [widgets, setWidgets] = useState<FramerrWidget[]>([]);
    const [integrations, setIntegrations] = useState<IntegrationsMap>({});
    const [integrationsLoaded, setIntegrationsLoaded] = useState<boolean>(false);
    const [integrationsError, setIntegrationsError] = useState<Error | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchData = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Fetch user config (includes preferences, dashboard layout)
            const userConfig = await configApi.getUser() as UserConfigResponse;

            // Only fetch admin-only endpoints for admins
            let systemConfig: SystemConfigResponse = {};
            if (isAdmin(user)) {
                try {
                    const sysData = await configApi.getSystem();
                    systemConfig = sysData as SystemConfigResponse;
                } catch (sysError) {
                    logger.debug('System config not available');
                }

                // Fetch integrations config (admin-only)
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
                        // Destructure to separate known fields from rest
                        const { name, ...restIntegration } = integration;
                        sharedIntegrations[name] = {
                            ...restIntegration,
                            // Plex uses 'token' - ensure it's set from token or apiKey
                            token: integration.token || integration.apiKey
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

            // Fetch app branding (public endpoint - works for all users)
            let appBranding: AppBrandingResponse = { name: 'Framerr', icon: 'Server' };
            try {
                // Use raw fetch for simple public endpoint
                const brandingRes = await fetch('/api/config/app-name');
                if (brandingRes.ok) {
                    appBranding = await brandingRes.json();
                }
            } catch (brandingError) {
                logger.debug('App branding not available, using defaults');
            }

            // Set user settings with server name/icon from branding API
            setUserSettings({
                serverName: appBranding.name || 'Framerr',
                serverIcon: appBranding.icon || 'Server',
                ...userConfig.preferences
            });

            setWidgets(userConfig.dashboard?.widgets || []);

            // Set tab groups from system config (or empty for non-admins)
            setGroups((systemConfig.tabGroups || []).sort((a, b) => a.order - b.order));

            // TODO: Fetch real services from backend when service system is implemented
            setServices([]);

        } catch (error) {
            logger.error('Failed to fetch app data', { error: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchData();

        // Listen for system config updates (app name/icon changes) via window events (legacy, internal)
        const handleSystemConfigUpdated = (): void => {
            fetchData();
        };

        // Listen for integrations updates (when user saves integrations)
        const handleIntegrationsUpdated = (): void => {
            fetchData();
        };

        window.addEventListener('systemConfigUpdated', handleSystemConfigUpdated);
        window.addEventListener('integrationsUpdated', handleIntegrationsUpdated);

        return () => {
            window.removeEventListener('systemConfigUpdated', handleSystemConfigUpdated);
            window.removeEventListener('integrationsUpdated', handleIntegrationsUpdated);
        };
    }, [fetchData]);

    // SSE: Listen for app-config invalidation (server name, icon changes from admin)
    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'app-config') {
                logger.debug('[AppDataContext] App config invalidated via SSE, refreshing');
                fetchData();
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate, fetchData]);

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
                    logger.info('[Visibility] Tab restored after idle, refreshing data', {
                        hiddenFor: Math.round(hiddenDuration / 1000) + 's'
                    });
                    fetchData();
                }
                lastHiddenTime = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, fetchData]);

    const updateWidgetLayout = useCallback(async (newLayout: FramerrWidget[]): Promise<void> => {
        try {
            // Optimistically update UI
            setWidgets(newLayout);

            // Save to backend
            await widgetsApi.saveAll({ widgets: newLayout });

            logger.debug('Widget layout saved', { widgetCount: newLayout.length });
        } catch (error) {
            logger.error('Failed to save widget layout', { error: (error as Error).message });
            // Revert on error
            fetchData();
        }
    }, [fetchData]);

    // Memoize context value to prevent unnecessary re-renders
    const value: AppDataContextValue = useMemo(() => ({
        userSettings,
        services,
        groups,
        widgets,
        integrations,
        integrationsLoaded,
        integrationsError,
        loading,
        updateWidgetLayout,
        refreshData: fetchData
    }), [
        userSettings, services, groups, widgets, integrations,
        integrationsLoaded, integrationsError, loading,
        updateWidgetLayout, fetchData
    ]);

    return (
        <AppDataContext.Provider value={value}>
            {children}
        </AppDataContext.Provider>
    );
};

export const useAppData = (): AppDataContextValue => {
    const context = useContext(AppDataContext);
    if (!context) {
        throw new Error('useAppData must be used within an AppDataProvider');
    }
    return context;
};

