/**
 * IframePage
 * OAuth/iFrame authentication configuration UI
 */

import React, { ChangeEvent } from 'react';
import { Lock, Loader, ExternalLink, Check } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Switch, Button } from '@/shared/ui';
import { SettingsPage, SettingsSection, SettingsCard } from '../../../shared/ui/settings';

export interface IframePageProps {
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
    showAuthentikInstructions: boolean;
    setShowAuthentikInstructions: (value: boolean) => void;
    testingOAuth: boolean;
    handleUseAuthentikTemplate: () => void;
    handleTestOAuth: () => void;
}

export const IframePage: React.FC<IframePageProps> = ({
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
    handleUseAuthentikTemplate,
    handleTestOAuth
}) => {
    return (
        <SettingsPage
            title="iFrame Auth"
            description="Configure OAuth for manual authentication in iframe tabs"
        >
            {/* Main Configuration Card */}
            <SettingsSection title="OAuth Configuration" icon={Lock}>
                {/* Info Box */}
                <div className="bg-info/10 rounded-xl p-4">
                    <p className="text-sm text-theme-secondary">
                        When an iframe tab requires authentication, click the <Lock size={14} className="inline-block text-theme-primary mx-0.5 -mt-0.5" /> <strong className="text-theme-primary">lock icon</strong> in the tab toolbar to open the login page in a new tab. After authenticating, you'll be redirected back.
                    </p>
                </div>

                {/* iFrame Auth Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <label className="text-sm font-medium text-theme-primary">
                            Enable iFrame Auth
                        </label>
                        <p className="text-xs text-theme-tertiary mt-1">
                            Allow OAuth authentication via the toolbar lock button
                        </p>
                    </div>
                    <Switch
                        checked={iframeEnabled}
                        onCheckedChange={setIframeEnabled}
                    />
                </div>

                {/* Template Button */}
                <button
                    onClick={handleUseAuthentikTemplate}
                    className="w-full px-4 py-3 border border-theme rounded-lg text-theme-secondary hover:bg-theme-hover hover:border-accent transition-all text-sm"
                >
                    <div className="flex items-center justify-center gap-2">
                        <Check size={16} />
                        Use Authentik Template
                    </div>
                </button>

                {/* OAuth Configuration Fields */}
                <div className="space-y-4">
                    <Input
                        label="OAuth Provider Endpoint"
                        type="text"
                        value={oauthEndpoint}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setOauthEndpoint(e.target.value)}
                        placeholder="https://auth.example.com/application/o/authorize/"
                        helperText="OAuth 2.0 authorization endpoint URL (must be HTTPS)"
                    />

                    <Input
                        label="Client ID"
                        type="text"
                        value={clientId}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
                        placeholder="your-client-id-here"
                        helperText="OAuth client ID from your provider"
                    />

                    <Input
                        label="Redirect URI"
                        type="text"
                        value={redirectUri}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setRedirectUri(e.target.value)}
                        placeholder={`${window.location.origin}/login-complete`}
                        helperText="OAuth callback URL (auto-populated)"
                    />

                    <Input
                        label="Scopes"
                        type="text"
                        value={scopes}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setScopes(e.target.value)}
                        placeholder="openid profile email"
                        helperText="Space-separated OAuth scopes"
                    />
                </div>

                {/* Test OAuth Button */}
                <Button
                    onClick={handleTestOAuth}
                    disabled={!oauthEndpoint || !clientId || testingOAuth}
                    className="w-full"
                    size="md"
                    textSize="sm"
                    icon={testingOAuth ? Loader : ExternalLink}
                >
                    {testingOAuth ? 'Testing...' : 'Test OAuth Configuration'}
                </Button>
            </SettingsSection>

            {/* Authentik Instructions */}
            <SettingsCard
                title="Authentik Setup Instructions"
                icon={Lock}
                expanded={showAuthentikInstructions}
                onToggleExpand={() => setShowAuthentikInstructions(!showAuthentikInstructions)}
            >
                <div className="space-y-4 text-sm text-theme-secondary">
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="font-medium text-theme-primary">
                            Go to your Authentik Admin Panel → Applications → Providers
                        </li>
                        <li>
                            Click <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">Create</span> and select <span className="font-semibold">OAuth2/OpenID Provider</span>
                        </li>
                        <li>
                            Configure the provider:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                <li><span className="font-medium">Name:</span> Framerr Callback</li>
                                <li><span className="font-medium">Client Type:</span> Public</li>
                                <li><span className="font-medium">Client ID:</span> Copy this and paste above</li>
                                <li><span className="font-medium">Redirect URI:</span> <span className="font-mono text-accent">{redirectUri || `${window.location.origin}/login-complete`}</span></li>
                                <li><span className="font-medium">Scopes:</span> openid, profile, email</li>
                            </ul>
                        </li>
                        <li>
                            Save the provider and copy the <span className="font-semibold">Authorization URL</span>
                        </li>
                        <li>
                            Paste the Authorization URL in the <span className="font-semibold">OAuth Provider Endpoint</span> field above
                        </li>
                        <li>
                            Click <span className="font-semibold">Save Settings</span> below and test with the <span className="font-semibold">Test OAuth</span> button
                        </li>
                    </ol>

                    <div className="mt-4 p-4 bg-theme-tertiary rounded-lg">
                        <p className="text-xs text-theme-tertiary">
                            <span className="font-semibold text-theme-secondary">Note:</span> The OAuth provider must point to the same Authentik instance that protects your services (Radarr, Sonarr, etc.) for automatic iframe authentication to work.
                        </p>
                    </div>
                </div>
            </SettingsCard>
        </SettingsPage>
    );
};
