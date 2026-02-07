import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { configApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';
import { useSystemConfig } from '../../../context/SystemConfigContext';
import { detectAuthNeed, isAuthDetectionEnabled, getSensitivity, getUserAuthPatterns, AuthDetectionResult } from '../../../utils/authDetection';
import { useNotifications } from '../../../context/NotificationContext';
import type { Tab } from '../types';

interface UseTabAuthOptions {
    tabs: Tab[];
    loadedTabs: Set<string>;
    reloadTab: (slug: string) => void;
}

interface UseTabAuthReturn {
    // State
    needsAuth: Record<string, boolean>;
    authDetectionInfo: Record<string, AuthDetectionResult>;
    isReloading: Record<string, boolean>;
    iframeAuthEnabled: boolean;

    // Refs
    iframeRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;

    // Handlers
    handleOpenAuth: (slug: string, authUrl: string) => void;
    handleManualAuth: (slug: string) => void;
    handleDismissOverlay: (slug: string) => void;
}

/**
 * Hook for managing iframe authentication detection and OAuth flow.
 * Handles auto-detection of auth pages, OAuth popup flow, and auth completion.
 */
export function useTabAuth({ tabs, loadedTabs, reloadTab }: UseTabAuthOptions): UseTabAuthReturn {
    const { systemConfig } = useSystemConfig();
    const { warning: showWarning } = useNotifications();

    // Auth detection state (per tab)
    const [needsAuth, setNeedsAuth] = useState<Record<string, boolean>>({});
    const [authDetectionInfo, setAuthDetectionInfo] = useState<Record<string, AuthDetectionResult>>({});
    const [isReloading, setIsReloading] = useState<Record<string, boolean>>({});

    // Local state for iframe auth enabled
    const [iframeAuthEnabled, setIframeAuthEnabled] = useState<boolean>(
        systemConfig?.auth?.iframe?.enabled || false
    );

    // Refs
    const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
    const authWindowRefs = useRef<Record<string, Window | null>>({});
    const detectionIntervalRefs = useRef<Record<string, NodeJS.Timeout>>({});

    // Listen for auth settings changes
    useEffect(() => {
        const handleAuthSettingsUpdated = async (): Promise<void> => {
            try {
                const response = await configApi.getAuth();
                setIframeAuthEnabled(response?.iframe?.enabled || false);
            } catch (e) {
                // Ignore errors, keep current state
            }
        };

        window.addEventListener('authSettingsUpdated', handleAuthSettingsUpdated);
        return () => window.removeEventListener('authSettingsUpdated', handleAuthSettingsUpdated);
    }, []);

    // Listen for auth-complete messages from login-complete page
    useEffect(() => {
        const handleAuthMessage = (event: MessageEvent): void => {
            if (event.origin !== window.location.origin) {
                logger.warn('Ignored auth message from untrusted origin:', { origin: event.origin });
                return;
            }

            if (event.data?.type === 'auth-complete') {
                logger.info('Auth complete message received via postMessage', { data: event.data });
                const tab = event.data?.tab as string | undefined;

                if (tab) {
                    logger.info(`Restoring tab: ${tab}`);
                    window.location.hash = `#${tab}`;
                    handleAuthComplete(tab);
                } else {
                    Object.keys(authWindowRefs.current).forEach(slug => {
                        if (authWindowRefs.current[slug] && !authWindowRefs.current[slug]?.closed) {
                            logger.info(`Handling auth completion for tab: ${slug}`);
                            handleAuthComplete(slug);
                        }
                    });
                }
            }
        };

        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, []);

    // Auto-detect authentication requirements
    useEffect(() => {
        if (!systemConfig || !isAuthDetectionEnabled(systemConfig as Parameters<typeof isAuthDetectionEnabled>[0])) {
            return;
        }

        const sensitivity = getSensitivity(systemConfig as Parameters<typeof getSensitivity>[0]);
        const userPatterns = getUserAuthPatterns(systemConfig as Parameters<typeof getUserAuthPatterns>[0]);

        Array.from(loadedTabs).forEach(slug => {
            const interval = setInterval(() => {
                const iframe = iframeRefs.current[slug];
                const tab = tabs.find(t => t.slug === slug);

                if (!iframe || !tab || needsAuth[slug]) return;

                try {
                    const currentSrc = iframe.src;
                    if (currentSrc) {
                        const detection = detectAuthNeed(currentSrc, tab.url, userPatterns, sensitivity);
                        if (detection.needsAuth) {
                            logger.info(`Auth detected for ${slug}:`, { detection });
                            setNeedsAuth(prev => ({ ...prev, [slug]: true }));
                            setAuthDetectionInfo(prev => ({ ...prev, [slug]: detection }));
                        }
                    }
                } catch (e) {
                    // Cross-origin restriction - expected
                }
            }, 1000);

            detectionIntervalRefs.current[slug] = interval;
        });

        return () => {
            Object.values(detectionIntervalRefs.current).forEach(clearInterval);
            detectionIntervalRefs.current = {};
        };
    }, [tabs, loadedTabs, systemConfig, needsAuth]);

    const handleOpenAuth = (slug: string, authUrl: string): void => {
        logger.info(`Opening auth in new tab for ${slug}:`, { authUrl });

        const clientId = systemConfig?.auth?.iframe?.clientId || '';
        const redirectUri = systemConfig?.auth?.iframe?.redirectUri || `${window.location.origin}/login-complete`;
        const oauthEndpoint = systemConfig?.auth?.iframe?.endpoint || '';
        const scopes = systemConfig?.auth?.iframe?.scopes || 'openid profile email';

        if (!clientId || !oauthEndpoint) {
            logger.error('iFrame auth not configured', { clientId: !!clientId, endpoint: !!oauthEndpoint });
            showWarning(
                'Not Configured',
                'iFrame authentication is not configured. Please go to Settings → Authentication → iFrame Auth to set up OAuth.'
            );
            return;
        }

        const state = JSON.stringify({ tab: slug });
        const oauthUrl = `${oauthEndpoint}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

        logger.debug('OAuth authorize URL:', { oauthUrl });

        const authWindow = window.open(oauthUrl, '_blank');
        authWindowRefs.current[slug] = authWindow;

        if (!authWindow) {
            logger.error('Failed to open auth window - popup blocked?');
            showWarning('Popup Blocked', 'Please allow popups for Framerr to enable automatic authentication.');
            return;
        }

        const pollInterval = setInterval(() => {
            if (authWindowRefs.current[slug]?.closed) {
                clearInterval(pollInterval);
                if (needsAuth[slug]) {
                    logger.info('Auth window closed (detected via polling)');
                    handleAuthComplete(slug);
                }
            }
        }, 500);
    };

    const handleAuthComplete = (slug: string): void => {
        logger.info(`Auth window closed for ${slug}, reloading iframe`);

        if (authWindowRefs.current[slug] && !authWindowRefs.current[slug]?.closed) {
            authWindowRefs.current[slug]?.close();
        }
        window.focus();

        setIsReloading(prev => ({ ...prev, [slug]: true }));
        setNeedsAuth(prev => ({ ...prev, [slug]: false }));

        setTimeout(() => {
            reloadTab(slug);
            setTimeout(() => {
                setIsReloading(prev => ({ ...prev, [slug]: false }));

                const iframe = iframeRefs.current[slug];
                if (iframe) {
                    try {
                        const currentSrc = iframe.src;
                        const tab = tabs.find(t => t.slug === slug);
                        if (tab) {
                            const sensitivity = getSensitivity(systemConfig as Parameters<typeof getSensitivity>[0]);
                            const userPatterns = getUserAuthPatterns(systemConfig as Parameters<typeof getUserAuthPatterns>[0]);
                            const detection = detectAuthNeed(currentSrc, tab.url, userPatterns, sensitivity);
                            if (detection.needsAuth) {
                                setNeedsAuth(prev => ({ ...prev, [slug]: true }));
                                setAuthDetectionInfo(prev => ({ ...prev, [slug]: detection }));
                            }
                        }
                    } catch (e) {
                        // Cross-origin - can't read src
                    }
                }
            }, 500);
        }, 500);
    };

    const handleManualAuth = (slug: string): void => {
        const tab = tabs.find(t => t.slug === slug);
        if (!tab) return;

        const iframe = iframeRefs.current[slug];
        const authUrl = iframe?.src || tab.url;

        logger.info(`Manual auth triggered for ${slug}`);
        setNeedsAuth(prev => ({ ...prev, [slug]: true }));
        setAuthDetectionInfo(prev => ({
            ...prev,
            [slug]: {
                needsAuth: true,
                confidence: 10,
                reasons: ['Manual auth trigger'],
                threshold: 0
            }
        }));
    };

    const handleDismissOverlay = (slug: string): void => {
        setNeedsAuth(prev => ({ ...prev, [slug]: false }));
    };

    return {
        needsAuth,
        authDetectionInfo,
        isReloading,
        iframeAuthEnabled,
        iframeRefs,
        handleOpenAuth,
        handleManualAuth,
        handleDismissOverlay,
    };
}
