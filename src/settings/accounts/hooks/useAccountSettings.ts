import { useState, useEffect, useCallback } from 'react';
import { plexApi, linkedAccountsApi, authApi } from '../../../api/endpoints';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useAppData } from '../../../context/AppDataContext';
import useRealtimeSSE from '../../../hooks/useRealtimeSSE';
import logger from '../../../utils/logger';
import type {
    DbLinkedAccounts,
    PlexSSOStatusResponse,
    PlexPinResponse,
    PlexTokenResponse,
    UseAccountSettingsReturn
} from '../types';

/**
 * Hook for managing linked account settings
 * Handles Plex and Overseerr account linking/unlinking
 */
export function useAccountSettings(): UseAccountSettingsReturn {
    const { success: showSuccess, error: showError } = useNotifications();
    const { user } = useAuth();
    const { integrations } = useAppData();
    const isAdmin = user?.group === 'admin';

    // Check if user has access to Overseerr integration
    const overseerrIntegration = (integrations as Record<string, { enabled?: boolean }>)?.overseerr;
    const hasOverseerrAccess = overseerrIntegration?.enabled === true;

    // Database-stored linked accounts
    const [dbLinkedAccounts, setDbLinkedAccounts] = useState<DbLinkedAccounts>({});
    const [loading, setLoading] = useState<boolean>(true);

    // Integration availability
    const [plexSSOEnabled, setPlexSSOEnabled] = useState<boolean>(false);
    const [oidcSSOEnabled, setOidcSSOEnabled] = useState<boolean>(false);
    const [oidcDisplayName, setOidcDisplayName] = useState<string>('OpenID Connect');
    const [oidcButtonIcon, setOidcButtonIcon] = useState<string>('KeyRound');

    // Plex linking state
    const [plexLinking, setPlexLinking] = useState<boolean>(false);
    const [plexUnlinking, setPlexUnlinking] = useState<boolean>(false);

    // OIDC linking state
    const [oidcConnecting, setOidcConnecting] = useState<boolean>(false);
    const [oidcDisconnecting, setOidcDisconnecting] = useState<boolean>(false);

    // Overseerr linking state
    const [overseerrModalOpen, setOverseerrModalOpen] = useState<boolean>(false);
    const [overseerrUsername, setOverseerrUsername] = useState<string>('');
    const [overseerrPassword, setOverseerrPassword] = useState<string>('');
    const [overseerrLinking, setOverseerrLinking] = useState<boolean>(false);
    const [overseerrUnlinking, setOverseerrUnlinking] = useState<boolean>(false);
    const [overseerrError, setOverseerrError] = useState<string>('');

    // --- API CALLS ---
    const checkPlexSSOStatus = async (): Promise<void> => {
        try {
            const response = await plexApi.getSSOStatus();
            setPlexSSOEnabled(response.enabled);
        } catch {
            setPlexSSOEnabled(false);
        }
    };

    const checkOidcSSOStatus = async (): Promise<void> => {
        try {
            const ssoConfig = await authApi.getSSOConfig();
            setOidcSSOEnabled(ssoConfig.oidc.enabled);
            setOidcDisplayName(ssoConfig.oidc.displayName || 'OpenID Connect');
            setOidcButtonIcon(ssoConfig.oidc.buttonIcon || 'KeyRound');
        } catch {
            setOidcSSOEnabled(false);
        }
    };



    const fetchAllLinkedAccounts = async (): Promise<void> => {
        try {
            const dbResponse = await linkedAccountsApi.getMyAccounts();
            setDbLinkedAccounts((dbResponse.accounts || {}) as DbLinkedAccounts);
        } catch (error) {
            logger.error('Error fetching linked accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load linked accounts and integration status on mount
    useEffect(() => {
        fetchAllLinkedAccounts();
        checkPlexSSOStatus();
        checkOidcSSOStatus();

        const handleLinkedAccountsUpdated = (): void => {
            fetchAllLinkedAccounts();
        };
        window.addEventListener('linkedAccountsUpdated', handleLinkedAccountsUpdated);

        // Check for OIDC connect callback params in hash
        const hash = window.location.hash;
        if (hash.includes('oidc_linked=true')) {
            showSuccess('OIDC Connected', 'Your OIDC account has been linked');
            // Clean up the hash params
            window.location.hash = hash.split('?')[0];
            fetchAllLinkedAccounts();
        } else if (hash.includes('error=')) {
            const params = new URLSearchParams(hash.split('?')[1] || '');
            const error = params.get('error');
            if (error && hash.includes('settings/account/connected')) {
                const errorMessages: Record<string, string> = {
                    'already_linked_other': 'This identity is already linked to another user.',
                    'connect_failed': 'Failed to connect. Please try again.',
                    'state_expired': 'Connection session expired. Please try again.',
                    'state_invalid': 'Invalid connection session. Please try again.',
                    'discovery_failed': 'Could not reach the identity provider.',
                    'missing_state': 'Connection failed — invalid state. Please try again.',
                };
                showError('OIDC Connection Failed', errorMessages[error] || decodeURIComponent(error));
                window.location.hash = hash.split('?')[0];
            }
        }

        return () => {
            window.removeEventListener('linkedAccountsUpdated', handleLinkedAccountsUpdated);
        };
    }, []);

    // SSE: Listen for SSO config changes (admin enables/disables Plex or OIDC)
    const { onSettingsInvalidate } = useRealtimeSSE();
    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            if (event.entity === 'sso-config') {
                logger.debug('[AccountSettings] SSO config changed via SSE, refreshing');
                checkPlexSSOStatus();
                checkOidcSSOStatus();
            }
        });
        return unsubscribe;
    }, [onSettingsInvalidate]);

    // Check for pending Plex auth on page load (redirect flow)
    useEffect(() => {
        const completePlexLink = async (): Promise<void> => {
            const pendingPinId = localStorage.getItem('plexLinkPendingPinId');
            if (!pendingPinId) return;

            setPlexLinking(true);
            try {
                const tokenResponse = await plexApi.getToken(pendingPinId);

                if (tokenResponse.authToken) {
                    await linkedAccountsApi.linkPlex(tokenResponse.authToken);

                    localStorage.removeItem('plexLinkPendingPinId');
                    showSuccess('Plex Connected', 'Plex account linked');
                    fetchAllLinkedAccounts();
                }
            } catch (err) {
                const error = err as Error & { response?: { data?: { error?: string } } };
                localStorage.removeItem('plexLinkPendingPinId');
                showError('Connection Failed', error.response?.data?.error || 'Failed to link Plex account');
            } finally {
                setPlexLinking(false);
            }
        };

        completePlexLink();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- PLEX HANDLERS ---
    const handleConnectPlex = useCallback(async (): Promise<void> => {
        setPlexLinking(true);
        try {
            const pinResponse = await plexApi.createPin(`${window.location.origin}/settings/linked-accounts`);

            const { pinId, authUrl } = pinResponse;
            localStorage.setItem('plexLinkPendingPinId', pinId.toString());
            window.location.href = authUrl;
        } catch (err) {
            const error = err as Error & { response?: { data?: { error?: string } } };
            showError('Connection Failed', error.response?.data?.error || 'Failed to connect to Plex');
            setPlexLinking(false);
        }
    }, [showError]);

    const handleDisconnectPlex = useCallback(async (): Promise<void> => {
        setPlexUnlinking(true);
        try {
            await linkedAccountsApi.unlinkPlex();
            showSuccess('Plex Disconnected', 'Plex account unlinked');
            fetchAllLinkedAccounts();
        } catch (err) {
            const error = err as Error;
            showError('Disconnect Failed', error.message || 'Failed to disconnect Plex');
        } finally {
            setPlexUnlinking(false);
        }
    }, [showSuccess, showError]);

    // --- OVERSEERR HANDLERS ---
    const handleOpenOverseerrModal = useCallback(() => {
        setOverseerrUsername('');
        setOverseerrPassword('');
        setOverseerrError('');
        setOverseerrModalOpen(true);
    }, []);

    const handleCloseOverseerrModal = useCallback(() => {
        setOverseerrModalOpen(false);
        setOverseerrError('');
    }, []);

    const handleLinkOverseerr = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setOverseerrLinking(true);
        setOverseerrError('');

        try {
            await linkedAccountsApi.linkOverseerr(overseerrUsername, overseerrPassword);

            showSuccess('Overseerr Connected', 'Overseerr account linked');
            setOverseerrModalOpen(false);
            fetchAllLinkedAccounts();
        } catch (err) {
            const error = err as Error & { response?: { data?: { error?: string } } };
            setOverseerrError(error.response?.data?.error || 'Failed to link Overseerr account');
        } finally {
            setOverseerrLinking(false);
        }
    }, [overseerrUsername, overseerrPassword, showSuccess]);

    const handleDisconnectOverseerr = useCallback(async (): Promise<void> => {
        setOverseerrUnlinking(true);
        try {
            await linkedAccountsApi.unlinkOverseerr();
            showSuccess('Overseerr Disconnected', 'Overseerr account unlinked');
            fetchAllLinkedAccounts();
        } catch (err) {
            const error = err as Error & { response?: { data?: { error?: string } } };
            showError('Disconnect Failed', error.response?.data?.error || 'Failed to disconnect Overseerr');
        } finally {
            setOverseerrUnlinking(false);
        }
    }, [showSuccess, showError]);

    // --- OIDC HANDLERS ---
    const handleConnectOidc = useCallback(async (): Promise<void> => {
        setOidcConnecting(true);
        try {
            const { redirectUrl } = await authApi.oidcConnect();
            window.location.href = redirectUrl;
        } catch (err) {
            const error = err as Error & { response?: { data?: { error?: string } } };
            showError('Connection Failed', error.response?.data?.error || 'Failed to initiate OIDC connection');
            setOidcConnecting(false);
        }
    }, [showError]);

    const handleDisconnectOidc = useCallback(async (): Promise<void> => {
        setOidcDisconnecting(true);
        try {
            await authApi.oidcDisconnect();
            showSuccess('OIDC Disconnected', 'OIDC account unlinked');
            fetchAllLinkedAccounts();
        } catch (err) {
            const error = err as Error;
            showError('Disconnect Failed', error.message || 'Failed to disconnect OIDC account');
        } finally {
            setOidcDisconnecting(false);
        }
    }, [showSuccess, showError]);

    return {
        // State
        loading,
        dbLinkedAccounts,
        plexSSOEnabled,

        hasOverseerrAccess,
        isAdmin,

        // Plex state
        plexLinking,
        plexUnlinking,

        // Overseerr state
        overseerrModalOpen,
        overseerrUsername,
        overseerrPassword,
        overseerrLinking,
        overseerrUnlinking,
        overseerrError,

        // Plex handlers
        handleConnectPlex,
        handleDisconnectPlex,

        // Overseerr handlers
        handleOpenOverseerrModal,
        handleCloseOverseerrModal,
        handleLinkOverseerr,
        handleDisconnectOverseerr,
        setOverseerrUsername,
        setOverseerrPassword,

        // OIDC state
        oidcSSOEnabled,
        oidcDisplayName,
        oidcButtonIcon,
        oidcConnecting,
        oidcDisconnecting,
        handleConnectOidc,
        handleDisconnectOidc,
    };
}
