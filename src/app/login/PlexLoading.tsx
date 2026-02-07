/**
 * PlexLoading - Loading page for Plex OAuth flow
 * 
 * URL: /login/plex/loading
 * 
 * Shown during Plex OAuth in two scenarios:
 * 1. Initial load: Shows spinner, then redirects to Plex OAuth
 * 2. Return from Plex: Shows spinner, polls for token, sends result to opener
 * 
 * Uses postMessage to communicate with opener window (usePlexOAuth hook).
 */

import React, { useEffect, useState, useRef } from 'react';
import { plexApi } from '../../api/endpoints/plex';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import logger from '../../utils/logger';
import { PLEX_PIN_KEY, PLEX_ORIGIN_KEY, PlexUser } from '../../hooks/usePlexOAuth';

type LoadingState = 'redirecting' | 'completing' | 'error';

const PlexLoading: React.FC = () => {
    const [state, setState] = useState<LoadingState>('redirecting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const hasStarted = useRef(false);

    useEffect(() => {
        // Prevent double-execution in strict mode
        if (hasStarted.current) return;
        hasStarted.current = true;

        const handleOAuth = async () => {
            const pinId = localStorage.getItem(PLEX_PIN_KEY);
            const authUrl = localStorage.getItem('plexOAuthUrl');
            const origin = localStorage.getItem(PLEX_ORIGIN_KEY);

            logger.debug('[PlexLoading] Starting OAuth flow', {
                hasPinId: !!pinId,
                hasAuthUrl: !!authUrl,
                isPopup: !!window.opener
            });

            if (!pinId) {
                // No PIN - something went wrong
                showError('No authentication session found. Please try again.');
                return;
            }

            // Check if this is the first load (need to redirect to Plex)
            // or return from Plex (need to complete auth)
            if (authUrl) {
                // First load - redirect to Plex
                // Clear the URL so we know this is the return trip
                localStorage.removeItem('plexOAuthUrl');

                logger.debug('[PlexLoading] Redirecting to Plex');
                window.location.href = authUrl;
                return;
            }

            // Return from Plex - poll for token
            setState('completing');

            const maxAttempts = 30; // 60 seconds (2s interval)
            let attempts = 0;

            const pollForToken = async (): Promise<void> => {
                attempts++;

                try {
                    const response = await plexApi.getToken(pinId);

                    if (response.authToken && response.user) {
                        // Success! Send result to opener
                        logger.info('[PlexLoading] Auth successful', {
                            username: response.user.username
                        });

                        sendResultToOpener(true, response.authToken, response.user as PlexUser);
                        return;
                    }

                    // Token not ready yet, keep polling
                    if (attempts < maxAttempts) {
                        setTimeout(pollForToken, 2000);
                    } else {
                        showError('Authentication timed out. Please try again.');
                    }
                } catch (error) {
                    const err = error as { status?: number; message?: string };

                    if (err.status === 404) {
                        showError('Authentication session expired. Please try again.');
                    } else {
                        // Might just be pending, try again
                        if (attempts < maxAttempts) {
                            setTimeout(pollForToken, 2000);
                        } else {
                            showError(err.message || 'Authentication failed');
                        }
                    }
                }
            };

            pollForToken();
        };

        handleOAuth();
    }, []);

    const sendResultToOpener = (
        success: boolean,
        token?: string,
        user?: PlexUser,
        error?: string
    ) => {
        const origin = localStorage.getItem(PLEX_ORIGIN_KEY) || window.location.origin;

        // Clean up storage
        localStorage.removeItem(PLEX_PIN_KEY);
        localStorage.removeItem(PLEX_ORIGIN_KEY);
        localStorage.removeItem('plexOAuthUrl');

        if (window.opener) {
            // Send message to opener
            window.opener.postMessage({
                type: 'PLEX_OAUTH_RESULT',
                success,
                token,
                user,
                error
            }, origin);

            // Close this popup
            setTimeout(() => window.close(), 100);
        } else {
            // Not a popup - this shouldn't happen in normal flow
            // Redirect to login page
            logger.warn('[PlexLoading] No opener window, redirecting to login');
            window.location.href = '/login';
        }
    };

    const showError = (message: string) => {
        setState('error');
        setErrorMessage(message);

        // Also send error to opener
        sendResultToOpener(false, undefined, undefined, message);
    };

    const getMessage = (): string => {
        switch (state) {
            case 'redirecting':
                return 'Connecting to Plex...';
            case 'completing':
                return 'Completing sign-in...';
            case 'error':
                return errorMessage;
            default:
                return 'Please wait...';
        }
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center p-4"
            style={{ backgroundColor: 'var(--bg-primary)' }}
        >
            <div className="flex flex-col items-center gap-4 text-center">
                {state !== 'error' ? (
                    <LoadingSpinner size="lg" />
                ) : (
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--error)', opacity: 0.2 }}
                    >
                        <span className="text-2xl">✕</span>
                    </div>
                )}

                <p
                    className="text-sm"
                    style={{ color: state === 'error' ? 'var(--error)' : 'var(--text-secondary)' }}
                >
                    {getMessage()}
                </p>

                {state === 'error' && (
                    <button
                        onClick={() => window.close()}
                        className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)'
                        }}
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};

export default PlexLoading;
