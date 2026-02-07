/**
 * AuthSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: proxy (Auth Proxy), plex (Plex SSO), iframe (iFrame Auth)
 * 
 * Note: Unlike other settings routers, Auth has shared state across tabs
 * (common save button, change detection) so pages receive props.
 */

import React, { MutableRefObject } from 'react';
import { Save, Loader } from 'lucide-react';
import { Button } from '../../shared/ui';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthSettings } from './hooks/useAuthSettings';
import { ProxyPage } from './pages/ProxyPage';
import { PlexPage } from './pages/PlexPage';
import { IframePage } from './pages/IframePage';
import { useSettingsAnimationClass } from '../../context/SettingsAnimationContext';
import type { AuthSettingsProps } from './types';

export const AuthSettings: React.FC<AuthSettingsProps> = ({ activeSubTab: propSubTab }) => {
    const {
        // Tab state
        activeTab,

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
        showAuthentikInstructions,
        setShowAuthentikInstructions,
        testingOAuth,

        // UI state
        loading,
        saving,
        hasChanges,

        // Plex SSO integration
        plexHasChanges,
        setPlexHasChanges,
        plexSaveRef,

        // Actions
        handleSave,
        handleUseAuthentikTemplate,
        handleTestOAuth
    } = useAuthSettings({ propSubTab });

    // Animation class - only animates on first render
    const animClass = useSettingsAnimationClass('auth');

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading authentication settings..." />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${animClass}`}>
            {/* Auth Proxy Tab */}
            {activeTab === 'proxy' && (
                <ProxyPage
                    proxyEnabled={proxyEnabled}
                    setProxyEnabled={setProxyEnabled}
                    headerName={headerName}
                    setHeaderName={setHeaderName}
                    emailHeaderName={emailHeaderName}
                    setEmailHeaderName={setEmailHeaderName}
                    whitelist={whitelist}
                    setWhitelist={setWhitelist}
                    overrideLogout={overrideLogout}
                    setOverrideLogout={setOverrideLogout}
                    logoutUrl={logoutUrl}
                    setLogoutUrl={setLogoutUrl}
                />
            )}

            {/* Plex SSO Tab */}
            {activeTab === 'plex' && (
                <PlexPage
                    onSaveNeeded={setPlexHasChanges}
                    onSave={plexSaveRef as MutableRefObject<(() => Promise<void>) | undefined>}
                />
            )}

            {/* iFrame Auth Tab */}
            {activeTab === 'iframe' && (
                <IframePage
                    iframeEnabled={iframeEnabled}
                    setIframeEnabled={setIframeEnabled}
                    oauthEndpoint={oauthEndpoint}
                    setOauthEndpoint={setOauthEndpoint}
                    clientId={clientId}
                    setClientId={setClientId}
                    redirectUri={redirectUri}
                    setRedirectUri={setRedirectUri}
                    scopes={scopes}
                    setScopes={setScopes}
                    showAuthentikInstructions={showAuthentikInstructions}
                    setShowAuthentikInstructions={setShowAuthentikInstructions}
                    testingOAuth={testingOAuth}
                    handleUseAuthentikTemplate={handleUseAuthentikTemplate}
                    handleTestOAuth={handleTestOAuth}
                />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleSave}
                    disabled={activeTab === 'plex' ? !plexHasChanges : (!hasChanges || saving)}
                    icon={saving ? Loader : Save}
                    size="md"
                    textSize="sm"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
};

export default AuthSettings;
