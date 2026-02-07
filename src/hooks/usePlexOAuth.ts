/**
 * usePlexOAuth - Shared hook for Plex OAuth authentication
 * 
 * Used by:
 * - Login page (Plex SSO login) - REDIRECT mode
 * - PlexPage (SSO setup in auth settings) - POPUP mode
 * - Integration Settings (adding Plex integration) - POPUP mode
 * 
 * Popup Flow:
 * 1. Creates PIN via API
 * 2. Opens popup to /login/plex/loading
 * 3. Listens for postMessage from popup
 * 4. Detects popup close as cancellation
 * 
 * Redirect Flow:
 * 1. Creates PIN via API
 * 2. Stores PIN in localStorage
 * 3. Redirects entire page to Plex
 * 4. On return, complete via completeRedirectAuth()
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { plexApi } from '../api/endpoints/plex';
import logger from '../utils/logger';

export interface PlexUser {
    id: string | number;
    username: string;
    email?: string;
    thumb?: string;
}

export interface PlexOAuthResult {
    success: boolean;
    token?: string;
    user?: PlexUser;
    error?: string;
}

export interface UsePlexOAuthOptions {
    /** 'popup' for settings/integrations, 'redirect' for login page */
    mode: 'popup' | 'redirect';
    /** Callback when auth succeeds (popup mode only) */
    onSuccess?: (token: string, user: PlexUser) => void;
    /** Callback when auth fails or is cancelled (popup mode only) */
    onError?: (error: string) => void;
    /** Optional: Callback when auth starts */
    onStart?: () => void;
}

export interface UsePlexOAuthReturn {
    /** Start the OAuth flow */
    startAuth: () => Promise<void>;
    /** Whether auth is in progress */
    isAuthenticating: boolean;
    /** Cancel ongoing auth (popup mode) */
    cancel: () => void;
}

// Message types for popup communication
interface PlexOAuthMessage {
    type: 'PLEX_OAUTH_RESULT';
    success: boolean;
    token?: string;
    user?: PlexUser;
    error?: string;
}

// Storage keys
const PLEX_PIN_KEY = 'plexOAuthPinId';
const PLEX_ORIGIN_KEY = 'plexOAuthOrigin';
const PLEX_REDIRECT_PIN_KEY = 'plexPendingPinId'; // Legacy key for redirect mode

/**
 * Shared hook for all Plex OAuth flows
 */
export function usePlexOAuth(options: UsePlexOAuthOptions): UsePlexOAuthReturn {
    const { mode, onSuccess, onError, onStart } = options;

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const popupRef = useRef<Window | null>(null);
    const closeCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Handle messages from the popup (popup mode only)
    const handleMessage = useCallback((event: MessageEvent) => {
        // Only handle in popup mode
        if (mode !== 'popup' || !onSuccess || !onError) return;

        // Validate origin matches our app
        if (event.origin !== window.location.origin) {
            return;
        }

        const data = event.data as PlexOAuthMessage;
        if (data?.type !== 'PLEX_OAUTH_RESULT') {
            return;
        }

        logger.debug('[usePlexOAuth] Received message from popup', { success: data.success });

        // Clean up
        cleanup();

        if (data.success && data.token && data.user) {
            onSuccess(data.token, data.user);
        } else {
            onError(data.error || 'Plex authentication failed');
        }
    }, [mode, onSuccess, onError]);

    // Cleanup function
    const cleanup = useCallback(() => {
        setIsAuthenticating(false);

        if (closeCheckIntervalRef.current) {
            clearInterval(closeCheckIntervalRef.current);
            closeCheckIntervalRef.current = null;
        }

        // Clear storage
        localStorage.removeItem(PLEX_PIN_KEY);
        localStorage.removeItem(PLEX_ORIGIN_KEY);
        localStorage.removeItem('plexOAuthUrl');

        // Remove message listener
        window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    // Cancel the auth flow (popup mode)
    const cancel = useCallback(() => {
        logger.debug('[usePlexOAuth] Auth cancelled');

        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }

        cleanup();
        onError?.('Authentication cancelled');
    }, [cleanup, onError]);

    // Start the OAuth flow
    const startAuth = useCallback(async () => {
        if (isAuthenticating) {
            logger.warn('[usePlexOAuth] Auth already in progress');
            return;
        }

        setIsAuthenticating(true);
        onStart?.();

        try {
            if (mode === 'popup') {
                // POPUP MODE: Open loading page in popup
                const loadingUrl = `${window.location.origin}/login/plex/loading`;
                const pinResponse = await plexApi.createPin(loadingUrl);
                const { pinId, authUrl } = pinResponse;

                logger.debug('[usePlexOAuth] PIN created (popup mode)', { pinId });

                // Store PIN for the loading page to use
                localStorage.setItem(PLEX_PIN_KEY, pinId.toString());
                localStorage.setItem(PLEX_ORIGIN_KEY, window.location.origin);
                localStorage.setItem('plexOAuthUrl', authUrl);

                // Listen for messages from popup
                window.addEventListener('message', handleMessage);

                // Open popup to loading page
                const popup = window.open(
                    loadingUrl,
                    'PlexAuth',
                    'width=600,height=700,menubar=no,toolbar=no,location=no,status=no'
                );

                if (!popup) {
                    cleanup();
                    onError?.('Popup blocked. Please allow popups for this site.');
                    return;
                }

                popupRef.current = popup;

                // Check if popup is closed (user cancelled)
                closeCheckIntervalRef.current = setInterval(() => {
                    if (popup.closed) {
                        logger.debug('[usePlexOAuth] Popup closed by user');
                        cleanup();
                        onError?.('Authentication cancelled');
                    }
                }, 500);

            } else {
                // REDIRECT MODE: Store PIN and redirect entire page
                const redirectUrl = `${window.location.origin}/login`;
                const pinResponse = await plexApi.createPin(redirectUrl);
                const { pinId, authUrl } = pinResponse;

                logger.debug('[usePlexOAuth] PIN created (redirect mode)', { pinId });

                // Store PIN for when we return from Plex
                localStorage.setItem(PLEX_REDIRECT_PIN_KEY, pinId.toString());

                // Redirect to Plex
                window.location.href = authUrl;
            }

        } catch (error) {
            const err = error as Error;
            logger.error('[usePlexOAuth] Failed to start auth', { error: err.message });
            cleanup();
            if (mode === 'popup') {
                onError?.(err.message || 'Failed to connect to Plex');
            } else {
                // In redirect mode, can't call callback - throw to let caller handle
                setIsAuthenticating(false);
                throw error;
            }
        }
    }, [isAuthenticating, mode, onStart, handleMessage, cleanup, onError]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (closeCheckIntervalRef.current) {
                clearInterval(closeCheckIntervalRef.current);
            }
            window.removeEventListener('message', handleMessage);
        };
    }, [handleMessage]);

    return {
        startAuth,
        isAuthenticating,
        cancel
    };
}

// Export storage keys for other components to use
export { PLEX_PIN_KEY, PLEX_ORIGIN_KEY, PLEX_REDIRECT_PIN_KEY };
