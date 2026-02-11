import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { setLogoutFunction } from '../api/client';
import logger from '../utils/logger';
import { showLogoutSplash, showLoginSplash } from '../utils/splash';
import useRealtimeSSE, { initializeSSE, disconnectSSE } from '../hooks/useRealtimeSSE';
import type { User, LoginResult } from '../../shared/types/user';
import type { AuthContextValue } from '../types/context/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.JSX.Element => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [needsSetup, setNeedsSetup] = useState<boolean>(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Session expiry handler - clears state and redirects
    const handleSessionExpiry = useCallback((): void => {
        setUser(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    // Logout function - shows splash overlay, transitions theme, then navigates
    const logout = useCallback((): void => {
        // Fetch the admin's login page theme, then show splash with cross-fade
        fetch('/api/theme/default')
            .then(r => r.json())
            .then(data => data.theme || 'dark-pro')
            .catch(() => 'dark-pro')
            .then(loginTheme => {
                showLogoutSplash(loginTheme, () => {
                    window.location.href = '/api/auth/logout';
                });
            });
    }, []);

    /**
     * Check if error is a transient server error that should be retried.
     * Returns true for 500, 502, 503, 504, or network errors.
     */
    const isTransientError = (err: unknown): boolean => {
        const apiError = err as { status?: number; code?: string };
        // Server errors or network errors should be retried
        if (apiError.status && apiError.status >= 500) return true;
        if (apiError.code === 'NETWORK_ERROR') return true;
        return false;
    };

    /**
     * Retry a function with exponential backoff for transient errors.
     * Only retries on 500+ or network errors, not on 401/403.
     */
    const withRetry = useCallback(async <T,>(
        fn: () => Promise<T>,
        maxRetries = 3,
        delayMs = 1000
    ): Promise<T> => {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                if (!isTransientError(err) || attempt === maxRetries) {
                    throw err;
                }
                logger.debug(`[AuthContext] Transient error, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        throw lastError;
    }, []);

    const checkSetupStatus = useCallback(async (): Promise<boolean> => {
        try {
            const response = await withRetry(() => authApi.checkSetupStatus());
            setNeedsSetup(response.needsSetup);
            return response.needsSetup;
        } catch (err) {
            logger.error('Setup status check failed', { error: err });
            setNeedsSetup(false);
            return false;
        }
    }, [withRetry]);

    const checkAuth = useCallback(async (): Promise<void> => {
        try {
            const response = await withRetry(() => authApi.getSession());
            setUser(response.user);
        } catch (err) {
            // 401/403 = not authenticated (normal on first load)
            // Transient errors already retried - if we get here, give up gracefully
            setUser(null);
        }
    }, [withRetry]);

    const checkSetupAndAuth = useCallback(async (): Promise<void> => {
        try {
            // First check if setup is needed
            const setupNeeded = await checkSetupStatus();

            // If setup is not needed, check authentication
            if (!setupNeeded) {
                await checkAuth();
            }
        } catch (err) {
            logger.error('Initial check failed', { error: err });
        } finally {
            setLoading(false);
        }
    }, [checkSetupStatus, checkAuth]);

    // Check setup status and auth on mount
    useEffect(() => {
        checkSetupAndAuth();
    }, [checkSetupAndAuth]);

    // Splash screen lifecycle — theme airlock
    // Not authenticated: dismiss immediately (login page renders)
    // Authenticated: wait for page to signal readiness via 'framerr:app-ready'
    useEffect(() => {
        if (loading) return;

        if (!user) {
            // Not authenticated — dismiss splash so login page shows
            const splash = document.getElementById('framerr-splash');
            if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 300);
            }
            return;
        }

        // Authenticated — wait for page content + theme airlock to complete
        const dismiss = () => {
            // signalAppReady in splash.ts handles the actual fade-out
            // This is just a safety net event listener
        };
        const safetyTimeout = setTimeout(() => {
            // Safety: if nothing signals ready in 8s, force dismiss
            const splash = document.getElementById('framerr-splash');
            if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 300);
            }
        }, 8000);

        return () => {
            clearTimeout(safetyTimeout);
        };
    }, [loading, user]);

    // Register session expiry handler with axios interceptor for auto-logout on 401
    // Use handleSessionExpiry (just clears state) - don't call full logout() which makes API calls
    // For proxy auth, the simple state clear + navigate is enough - Authentik will handle the rest
    useEffect(() => {
        setLogoutFunction(handleSessionExpiry);
        return () => setLogoutFunction(null);
    }, [handleSessionExpiry]);

    // Check auth when tab becomes visible (handles sleeping tabs)
    useEffect(() => {
        const handleVisibilityChange = async (): Promise<void> => {
            // Only check if tab is becoming visible and user is logged in
            if (document.visibilityState === 'visible' && user) {
                try {
                    await authApi.verifySession();
                } catch (err) {
                    // 401 will be handled by axios interceptor
                    // which calls handleSessionExpiry
                    logger.debug('Visibility auth check failed');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user]);

    // P9: Initialize/disconnect SSE based on authentication state
    useEffect(() => {
        if (user) {
            logger.debug('[AuthContext] User authenticated, initializing SSE');
            initializeSSE();
        } else if (!loading) {
            // Only disconnect when explicitly logged out (not on initial load)
            logger.debug('[AuthContext] User logged out, disconnecting SSE');
            disconnectSSE();
        }
    }, [user, loading]);

    // Handle redirects when setup status or auth changes
    useEffect(() => {
        if (loading) return; // Don't redirect while loading

        const currentPath = location.pathname;

        // If setup needed: redirect to /setup (unless already there)
        if (needsSetup) {
            if (currentPath !== '/setup') {
                navigate('/setup', { replace: true });
            }
            return; // Don't process other redirects when setup is needed
        }

        // Setup complete: redirect away from /setup to /login
        if (currentPath === '/setup') {
            navigate('/login', { replace: true });
        }
    }, [needsSetup, loading, location.pathname, navigate]);

    // SSE: Listen for user-profile changes to refresh session (displayName, picture)
    const { onSettingsInvalidate } = useRealtimeSSE();
    useEffect(() => {
        if (!user) return; // Only listen when logged in

        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'user-profile') {
                logger.debug('[AuthContext] User profile invalidated via SSE, refreshing session');
                checkAuth();
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate, checkAuth, user]);

    const login = useCallback(async (username: string, password: string, rememberMe: boolean): Promise<LoginResult> => {
        try {
            const response = await authApi.login({ username, password, rememberMe });
            showLoginSplash(); // Show splash before navigating to dashboard
            setUser(response.user);
            return { success: true };
        } catch (err) {
            const msg = (err as { message?: string }).message || 'Login failed';
            setError(msg);
            return { success: false, error: msg };
        }
    }, []);

    const loginWithPlex = useCallback(async (plexToken: string, plexUserId: string): Promise<LoginResult> => {
        try {
            const response = await authApi.loginWithPlex({ plexToken, plexUserId });

            // Check if account setup is needed (new Plex user, no linked account)
            if (response.needsAccountSetup && response.setupToken) {
                return {
                    success: false,
                    needsAccountSetup: true,
                    setupToken: response.setupToken
                };
            }

            // Check if password setup is needed (migrating user)
            if (response.needsPasswordSetup && response.user) {
                setUser(response.user);
                return {
                    success: true,
                    needsPasswordSetup: true
                };
            }

            // Normal login
            if (response.user) {
                showLoginSplash(); // Show splash before navigating to dashboard
                setUser(response.user);
                return { success: true };
            }

            return { success: false, error: 'Unexpected response from server' };
        } catch (err) {
            const msg = (err as { message?: string }).message || 'Plex login failed';
            setError(msg);
            return { success: false, error: msg };
        }
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value: AuthContextValue = useMemo(() => ({
        user,
        loading,
        error,
        needsSetup,
        login,
        loginWithPlex,
        logout,
        checkAuth,
        checkSetupStatus,
        isAuthenticated: !!user
        // isAdmin removed - use isAdmin(user, systemConfig) utility instead
    }), [user, loading, error, needsSetup, login, loginWithPlex, logout, checkAuth, checkSetupStatus]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};


export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

