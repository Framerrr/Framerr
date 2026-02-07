/**
 * useAuthSettings Hook
 * Manages all state and logic for authentication settings
 * 
 * Uses React Query for server state (fetch/mutation).
 * Local state for form fields (edited before save).
 */

import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuthConfig, useUpdateAuthConfig } from '../../../api/hooks/useSettings';
import { extractErrorMessage } from '../../../api/errors';
import type { TabId, OriginalSettings } from '../types';

interface UseAuthSettingsOptions {
    propSubTab?: string | null;
}

interface UseAuthSettingsReturn {
    // Tab state
    activeTab: TabId;
    setActiveTab: (id: TabId) => void;
    subTabRefs: MutableRefObject<Record<TabId, HTMLButtonElement | null>>;

    // Auth proxy state
    proxyEnabled: boolean;
    setProxyEnabled: (value: boolean) => void;
    headerName: string;
    setHeaderName: (value: string) => void;
    emailHeaderName: string;
    setEmailHeaderName: (value: string) => void;
    whitelist: string;
    setWhitelist: (value: string) => void;
    overrideLogout: boolean;
    setOverrideLogout: (value: boolean) => void;
    logoutUrl: string;
    setLogoutUrl: (value: string) => void;

    // iFrame auth state
    iframeEnabled: boolean;
    setIframeEnabled: (value: boolean) => void;
    oauthEndpoint: string;
    setOauthEndpoint: (value: string) => void;
    clientId: string;
    setClientId: (value: string) => void;
    redirectUri: string;
    setRedirectUri: (value: string) => void;
    scopes: string;
    setScopes: (value: string) => void;

    // UI state
    loading: boolean;
    saving: boolean;
    hasChanges: boolean;
    showAuthentikInstructions: boolean;
    setShowAuthentikInstructions: (value: boolean) => void;
    testingOAuth: boolean;

    // Plex SSO integration
    plexHasChanges: boolean;
    setPlexHasChanges: (value: boolean) => void;
    plexSaveRef: MutableRefObject<(() => Promise<void>) | null>;

    // Actions
    handleSave: () => Promise<void>;
    handleUseAuthentikTemplate: () => void;
    handleTestOAuth: () => void;
}

const DEFAULT_SETTINGS: OriginalSettings = {
    proxyEnabled: false,
    headerName: '',
    emailHeaderName: '',
    whitelist: '',
    overrideLogout: false,
    logoutUrl: '',
    iframeEnabled: false,
    oauthEndpoint: '',
    clientId: '',
    redirectUri: '',
    scopes: ''
};

export function useAuthSettings({ propSubTab }: UseAuthSettingsOptions = {}): UseAuthSettingsReturn {
    const { error: showError, warning: showWarning } = useNotifications();

    // React Query hooks for server state
    const { data: authConfig, isPending: loading } = useAuthConfig();
    const updateAuthConfig = useUpdateAuthConfig();

    // Subtab state - use prop if provided, otherwise use internal state
    const [internalTab, setInternalTab] = useState<TabId>('proxy');
    const activeTab: TabId = (propSubTab as TabId) || internalTab;
    const setActiveTab = (id: TabId) => setInternalTab(id);

    // Refs for auto-scrolling sub-tab buttons into view
    const subTabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
        proxy: null,
        plex: null,
        iframe: null
    });

    // Auth proxy form state
    const [proxyEnabled, setProxyEnabled] = useState<boolean>(false);
    const [headerName, setHeaderName] = useState<string>('');
    const [emailHeaderName, setEmailHeaderName] = useState<string>('');
    const [whitelist, setWhitelist] = useState<string>('');
    const [overrideLogout, setOverrideLogout] = useState<boolean>(false);
    const [logoutUrl, setLogoutUrl] = useState<string>('');

    // iFrame auth form state
    const [iframeEnabled, setIframeEnabled] = useState<boolean>(false);
    const [oauthEndpoint, setOauthEndpoint] = useState<string>('');
    const [clientId, setClientId] = useState<string>('');
    const [redirectUri, setRedirectUri] = useState<string>('');
    const [scopes, setScopes] = useState<string>('openid profile email');

    // UI state
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [originalSettings, setOriginalSettings] = useState<OriginalSettings>(DEFAULT_SETTINGS);
    const [showAuthentikInstructions, setShowAuthentikInstructions] = useState<boolean>(false);
    const [testingOAuth, setTestingOAuth] = useState<boolean>(false);

    // Plex SSO integration
    const [plexHasChanges, setPlexHasChanges] = useState<boolean>(false);
    const plexSaveRef = useRef<(() => Promise<void>) | null>(null);

    // Sync form state when server data loads
    useEffect(() => {
        if (authConfig) {
            const { proxy, iframe } = authConfig;

            setProxyEnabled(proxy?.enabled || false);
            setHeaderName(proxy?.headerName || '');
            setEmailHeaderName(proxy?.emailHeaderName || '');
            setWhitelist((proxy?.whitelist || []).join(', '));
            setOverrideLogout(proxy?.overrideLogout || false);
            setLogoutUrl(proxy?.logoutUrl || '');

            setIframeEnabled(iframe?.enabled || false);
            setOauthEndpoint(iframe?.endpoint || '');
            setClientId(iframe?.clientId || '');
            setRedirectUri(iframe?.redirectUri || `${window.location.origin}/login-complete`);
            setScopes(iframe?.scopes || 'openid profile email');

            setOriginalSettings({
                proxyEnabled: proxy?.enabled || false,
                headerName: proxy?.headerName || '',
                emailHeaderName: proxy?.emailHeaderName || '',
                whitelist: (proxy?.whitelist || []).join(', '),
                overrideLogout: proxy?.overrideLogout || false,
                logoutUrl: proxy?.logoutUrl || '',
                iframeEnabled: iframe?.enabled || false,
                oauthEndpoint: iframe?.endpoint || '',
                clientId: iframe?.clientId || '',
                redirectUri: iframe?.redirectUri || `${window.location.origin}/login-complete`,
                scopes: iframe?.scopes || 'openid profile email'
            });
        }
    }, [authConfig]);

    // Scroll active sub-tab into view when it changes
    useEffect(() => {
        const tabButton = subTabRefs.current[activeTab];
        if (tabButton) {
            tabButton.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [activeTab]);

    // Auto-populate redirect URI if empty (only on mount)
    useEffect(() => {
        if (!redirectUri) {
            setRedirectUri(`${window.location.origin}/login-complete`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track changes
    useEffect(() => {
        const current = {
            proxyEnabled,
            headerName,
            emailHeaderName,
            whitelist,
            overrideLogout,
            logoutUrl,
            iframeEnabled,
            oauthEndpoint,
            clientId,
            redirectUri,
            scopes
        };
        // hasChanges for proxy/iframe tabs only (Plex has its own tracking)
        const proxyIframeChanged = JSON.stringify(current) !== JSON.stringify(originalSettings);
        setHasChanges(proxyIframeChanged);
    }, [proxyEnabled, headerName, emailHeaderName, whitelist, overrideLogout, logoutUrl,
        iframeEnabled, oauthEndpoint, clientId, redirectUri, scopes, originalSettings]);

    // Auto-toggle logout override based on proxy state
    useEffect(() => {
        if (!proxyEnabled && overrideLogout) {
            setOverrideLogout(false);
        } else if (proxyEnabled && logoutUrl && !overrideLogout) {
            setOverrideLogout(true);
        }
    }, [proxyEnabled]);

    const handleSave = async (): Promise<void> => {
        // If on Plex tab, delegate to PlexSection save
        if (activeTab === 'plex' && plexSaveRef.current) {
            await plexSaveRef.current();
            return;
        }

        // Validation: Proxy auth requires header name
        if (proxyEnabled && !headerName.trim()) {
            showWarning('Missing Field', 'Header Name is required when Auth Proxy is enabled');
            return;
        }

        // Validation: iFrame auth requires endpoint and client ID
        if (iframeEnabled) {
            if (!oauthEndpoint.trim()) {
                showWarning('Missing Field', 'OAuth Endpoint is required when iFrame Auth is enabled');
                return;
            }
            if (!clientId.trim()) {
                showWarning('Missing Field', 'Client ID is required when iFrame Auth is enabled');
                return;
            }
        }

        try {
            const whitelistArray = whitelist
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            await updateAuthConfig.mutateAsync({
                proxy: {
                    enabled: proxyEnabled,
                    headerName,
                    emailHeaderName,
                    whitelist: whitelistArray,
                    overrideLogout: overrideLogout && proxyEnabled,
                    logoutUrl
                },
                iframe: {
                    enabled: iframeEnabled,
                    endpoint: oauthEndpoint,
                    clientId,
                    redirectUri,
                    scopes
                }
            });

            setOriginalSettings({
                proxyEnabled,
                headerName,
                emailHeaderName,
                whitelist,
                overrideLogout,
                logoutUrl,
                iframeEnabled,
                oauthEndpoint,
                clientId,
                redirectUri,
                scopes
            });

            // Notify TabContainer that auth settings changed (for lock icon visibility)
            window.dispatchEvent(new CustomEvent('authSettingsUpdated'));
        } catch (error) {
            showError('Save Failed', extractErrorMessage(error));
        }
    };

    const handleUseAuthentikTemplate = (): void => {
        setOauthEndpoint('https://auth.example.com/application/o/authorize/');
        setClientId('');
        setRedirectUri(`${window.location.origin}/login-complete`);
        setScopes('openid profile email');
    };

    const handleTestOAuth = (): void => {
        if (!oauthEndpoint || !clientId) {
            showWarning('Missing Fields', 'Please fill in OAuth endpoint and client ID before testing');
            return;
        }

        setTestingOAuth(true);
        const testUrl = `${oauthEndpoint}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(JSON.stringify({ test: true }))}`;

        const testWindow = window.open(testUrl, '_blank', 'width=600,height=700');

        const interval = setInterval(() => {
            if (testWindow?.closed) {
                clearInterval(interval);
                setTestingOAuth(false);
            }
        }, 500);
    };

    return {
        // Tab state
        activeTab,
        setActiveTab,
        subTabRefs,

        // Auth proxy state
        proxyEnabled,
        setProxyEnabled,
        headerName,
        setHeaderName,
        emailHeaderName,
        setEmailHeaderName,
        whitelist,
        setWhitelist,
        overrideLogout,
        setOverrideLogout,
        logoutUrl,
        setLogoutUrl,

        // iFrame auth state
        iframeEnabled,
        setIframeEnabled,
        oauthEndpoint,
        setOauthEndpoint,
        clientId,
        setClientId,
        redirectUri,
        setRedirectUri,
        scopes,
        setScopes,

        // UI state
        loading,
        saving: updateAuthConfig.isPending,
        hasChanges,
        showAuthentikInstructions,
        setShowAuthentikInstructions,
        testingOAuth,

        // Plex SSO integration
        plexHasChanges,
        setPlexHasChanges,
        plexSaveRef,

        // Actions
        handleSave,
        handleUseAuthentikTemplate,
        handleTestOAuth
    };
}
