import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger';
import useRealtimeSSE from '../../hooks/useRealtimeSSE';

// ============================================================================
// Types
// ============================================================================

interface AppBrandingResponse {
    name?: string;
    icon?: string;
}

export interface AppBrandingContextValue {
    /** Server display name (e.g. 'Framerr' or user-configured name) */
    serverName: string;
    /** Server icon identifier */
    serverIcon: string;
    /** True when branding has finished initial load */
    brandingLoaded: boolean;
}

interface AppBrandingProviderProps {
    children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const AppBrandingContext = createContext<AppBrandingContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export const AppBrandingProvider = ({ children }: AppBrandingProviderProps): React.JSX.Element => {
    const { isAuthenticated } = useAuth();
    const { onSettingsInvalidate } = useRealtimeSSE();
    const [serverName, setServerName] = useState<string>('Framerr');
    const [serverIcon, setServerIcon] = useState<string>('Server');
    const [brandingLoaded, setBrandingLoaded] = useState<boolean>(false);

    const fetchBranding = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }

        try {
            // Fetch app branding (public endpoint - works for all users)
            let appBranding: AppBrandingResponse = { name: 'Framerr', icon: 'Server' };
            try {
                const brandingRes = await fetch('/api/config/app-name');
                if (brandingRes.ok) {
                    appBranding = await brandingRes.json();
                }
            } catch (brandingError) {
                logger.debug('App branding not available, using defaults');
            }

            setServerName(appBranding.name || 'Framerr');
            setServerIcon(appBranding.icon || 'Server');
            setBrandingLoaded(true);
        } catch (error) {
            logger.error('Failed to fetch app branding', { error: (error as Error).message });
            setBrandingLoaded(true);
        }
    }, [isAuthenticated]);

    // Initial fetch + window event listeners
    useEffect(() => {
        fetchBranding();

        // Listen for system config updates (app name/icon changes)
        const handleSystemConfigUpdated = (): void => {
            fetchBranding();
        };

        window.addEventListener('systemConfigUpdated', handleSystemConfigUpdated);

        return () => {
            window.removeEventListener('systemConfigUpdated', handleSystemConfigUpdated);
        };
    }, [fetchBranding]);

    // SSE: Listen for app-config invalidation (server name, icon changes from admin)
    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'app-config') {
                logger.debug('[AppBrandingProvider] App config invalidated via SSE, refreshing branding');
                fetchBranding();
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate, fetchBranding]);

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
                    logger.info('[Visibility] Tab restored after idle, refreshing branding', {
                        hiddenFor: Math.round(hiddenDuration / 1000) + 's'
                    });
                    fetchBranding();
                }
                lastHiddenTime = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, fetchBranding]);

    // Memoize context value to prevent unnecessary re-renders
    const value: AppBrandingContextValue = useMemo(() => ({
        serverName,
        serverIcon,
        brandingLoaded,
    }), [serverName, serverIcon, brandingLoaded]);

    return (
        <AppBrandingContext.Provider value={value}>
            {children}
        </AppBrandingContext.Provider>
    );
};

// ============================================================================
// Hook
// ============================================================================

export const useAppBranding = (): AppBrandingContextValue => {
    const context = useContext(AppBrandingContext);
    if (!context) {
        throw new Error('useAppBranding must be used within an AppBrandingProvider');
    }
    return context;
};

export { AppBrandingContext };
