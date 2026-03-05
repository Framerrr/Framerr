/**
 * OidcPage
 * OpenID Connect SSO configuration for AuthSettings
 *
 * Features:
 * - Enable/disable OIDC SSO
 * - Provider configuration (issuer URL, client ID/secret, display name, scopes)
 * - Discovery test button
 * - Callback URL display with copy button
 * - Auto-create users toggle
 */
import React, { useState, ChangeEvent } from 'react';
import { KeyRound, CheckCircle, AlertCircle, Copy, Check, Search, Loader, Lock } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Switch } from '@/shared/ui';
import { SettingsPage, SettingsSection, SettingsCard, SettingsAlert } from '../../../shared/ui/settings';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import IconPicker from '../../../components/IconPicker';
import { useOidcSettings } from '../hooks/useOidcSettings';

interface OidcPageProps {
    onSaveNeeded?: (hasChanges: boolean) => void;
    onSave?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export const OidcPage: React.FC<OidcPageProps> = ({ onSaveNeeded, onSave }) => {
    const {
        enabled, setEnabled,
        issuerUrl, setIssuerUrl,
        clientId, setClientId,
        clientSecret, setClientSecret,
        hasClientSecret,
        displayName, setDisplayName,
        buttonIcon, setButtonIcon,
        scopes, setScopes,
        autoCreateUsers, setAutoCreateUsers,
        loading, callbackUrl,
        testing, testResult, handleTestDiscovery,
    } = useOidcSettings({ onSaveNeeded, onSave });

    const [copied, setCopied] = useState(false);
    const [showAuthentik, setShowAuthentik] = useState(false);
    const [showAuthelia, setShowAuthelia] = useState(false);
    const [showKeycloak, setShowKeycloak] = useState(false);

    const handleCopyCallback = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(callbackUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-HTTPS contexts
            const input = document.createElement('input');
            input.value = callbackUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" message="Loading OIDC configuration..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="OpenID Connect"
            description="Configure OIDC/OAuth2 single sign-on with your identity provider"
        >
            <SettingsSection title="OpenID Connect" icon={KeyRound}>
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <label className="text-sm font-medium text-theme-primary">
                            Enable OpenID Connect
                        </label>
                        <p className="text-xs text-theme-tertiary mt-1">
                            Allow users to sign in with your OIDC identity provider
                        </p>
                    </div>
                    <Switch
                        checked={enabled}
                        onCheckedChange={setEnabled}
                    />
                </div>

                <div className="space-y-4">
                    {/* Issuer URL */}
                    <Input
                        label="Issuer URL"
                        type="url"
                        value={issuerUrl}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setIssuerUrl(e.target.value)}
                        placeholder="https://auth.example.com"
                        required
                        helperText="The base URL of your OIDC provider (e.g., Authentik, Authelia, Keycloak)"
                        action={{
                            label: 'Test',
                            onClick: handleTestDiscovery,
                            disabled: testing || !issuerUrl.trim(),
                            icon: testing ? <Loader className="animate-spin" size={14} /> : <Search size={14} />,
                        }}
                    />

                    {/* HTTP issuer warning — informational, not blocking */}
                    {issuerUrl.startsWith('http://') && (
                        <SettingsAlert type="warning">
                            Your issuer URL uses HTTP. For production deployments exposed to the internet, HTTPS is strongly recommended.
                        </SettingsAlert>
                    )}
                    {testResult && (
                        <div className={`rounded-lg p-3 border ${testResult.success ? 'border-[var(--success)]/30 bg-[var(--success)]/5' : 'border-[var(--error)]/30 bg-[var(--error)]/5'}`}>
                            {testResult.success ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--success)' }}>
                                        <CheckCircle size={16} />
                                        Discovery successful
                                    </div>
                                    <div className="text-xs text-theme-secondary space-y-1">
                                        <p><span className="text-theme-tertiary">Issuer:</span> {testResult.issuerName}</p>
                                        <p><span className="text-theme-tertiary">Authorization:</span> {testResult.authorizationEndpoint}</p>
                                        <p><span className="text-theme-tertiary">Token:</span> {testResult.tokenEndpoint}</p>
                                        {testResult.userinfoEndpoint && (
                                            <p><span className="text-theme-tertiary">UserInfo:</span> {testResult.userinfoEndpoint}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--error)' }}>
                                    <AlertCircle size={16} />
                                    {testResult.error || 'Discovery failed'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Client ID */}
                    <Input
                        label="Client ID"
                        type="text"
                        value={clientId}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
                        placeholder="your-client-id"
                        required
                    />

                    {/* Client Secret */}
                    <Input
                        label="Client Secret"
                        type="text"
                        value={clientSecret}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setClientSecret(e.target.value)}
                        placeholder={hasClientSecret ? 'Secret is set — leave blank to keep' : 'Enter client secret'}
                        required
                        autoComplete="off"
                    />

                    {/* Display Name + Button Icon */}
                    <Input
                        label="Display Name"
                        type="text"
                        value={displayName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                        placeholder="SSO"
                        helperText='Text shown on the login button (e.g., "Sign in with Authentik", "Company SSO")'
                        prefixElement={
                            <IconPicker
                                value={buttonIcon}
                                onChange={setButtonIcon}
                                compact
                            />
                        }
                    />

                    {/* Scopes */}
                    <Input
                        label="Scopes"
                        type="text"
                        value={scopes}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setScopes(e.target.value)}
                        placeholder="openid email profile"
                        helperText='Space-separated OAuth scopes. Must include "openid".'
                    />

                    {/* Auto-create Users */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                        <div>
                            <label className="text-sm font-medium text-theme-primary">
                                Auto-create Users
                            </label>
                            <p className="text-xs text-theme-tertiary mt-1">
                                Automatically create a Framerr account when a new user signs in via OIDC.
                                If disabled, users must be pre-created and linked manually.
                            </p>
                        </div>
                        <Switch
                            checked={autoCreateUsers}
                            onCheckedChange={setAutoCreateUsers}
                        />
                    </div>

                    {/* Callback URL */}
                    <SettingsAlert type="info">
                        Register this callback URL in your identity provider&apos;s application settings.
                    </SettingsAlert>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-theme-tertiary border border-theme rounded-lg text-sm text-theme-primary font-mono break-all select-all">
                            {callbackUrl}
                        </code>
                        <button
                            onClick={handleCopyCallback}
                            className="px-3 py-2 bg-theme-tertiary border border-theme rounded-lg text-theme-secondary transition-colors hover:bg-theme-hover"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                        </button>
                    </div>

                    {/* Admin next-step reminder */}
                    <SettingsAlert type="info">
                        <strong>After setup:</strong> Go to <a href="#settings/account/connected" className="text-accent hover:underline font-medium">Connected Accounts</a> to connect your own OIDC identity. Other users can do the same from their account settings.
                    </SettingsAlert>
                </div>
            </SettingsSection>

            {/* Provider Setup Guides */}
            <SettingsCard
                title="Authentik Setup Guide"
                icon={Lock}
                expanded={showAuthentik}
                onToggleExpand={() => setShowAuthentik(!showAuthentik)}
            >
                <div className="space-y-4 text-sm text-theme-secondary">
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="font-medium text-theme-primary">
                            Go to your Authentik Admin → Applications → <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">Create with provider</span>
                        </li>
                        <li>
                            Enter a name (e.g., <span className="font-semibold">Framerr</span>) and click <span className="font-semibold">Next</span>
                        </li>
                        <li>
                            Select <span className="font-semibold">OAuth2/OIDC</span> as the provider type and click <span className="font-semibold">Next</span>
                        </li>
                        <li>
                            Configure the provider:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                <li><span className="font-medium">Client Type:</span> Confidential</li>
                                <li><span className="font-medium">Redirect URI:</span> <span className="font-mono text-accent">{callbackUrl}</span></li>
                                <li><span className="font-medium">Scopes:</span> openid, email, profile</li>
                            </ul>
                        </li>
                        <li>
                            Click <span className="font-semibold">Submit</span> to create the application and provider
                        </li>
                        <li>
                            Copy the <span className="font-semibold">Client ID</span> and <span className="font-semibold">Client Secret</span> into the fields above
                        </li>
                        <li>
                            Set the <span className="font-semibold">Issuer URL</span> to: <span className="font-mono text-accent">https://auth.example.com/application/o/your-app-slug/</span>
                        </li>
                        <li>
                            Click <span className="font-semibold">Save Settings</span> and use the <span className="font-semibold">Test</span> button to verify discovery
                        </li>
                    </ol>

                    <div className="mt-4 p-4 bg-theme-tertiary rounded-lg">
                        <p className="text-xs text-theme-tertiary">
                            <span className="font-semibold text-theme-secondary">Note:</span> The Issuer URL format for Authentik is <span className="font-mono">https://your-authentik-domain/application/o/your-slug/</span> — include the trailing slash.
                        </p>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard
                title="Authelia Setup Guide"
                icon={Lock}
                expanded={showAuthelia}
                onToggleExpand={() => setShowAuthelia(!showAuthelia)}
            >
                <div className="space-y-4 text-sm text-theme-secondary">
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="font-medium text-theme-primary">
                            Open your Authelia <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">configuration.yml</span>
                        </li>
                        <li>
                            Under <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">identity_providers.oidc.clients</span>, add a new client block
                        </li>
                        <li>
                            Configure the client:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                <li><span className="font-medium">client_id:</span> Choose a unique ID (e.g., <span className="font-mono">framerr</span>)</li>
                                <li><span className="font-medium">client_name:</span> Framerr</li>
                                <li><span className="font-medium">client_secret:</span> Generate with <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">authelia crypto hash generate pbkdf2</span></li>
                                <li><span className="font-medium">redirect_uris:</span> <span className="font-mono text-accent">{callbackUrl}</span></li>
                                <li><span className="font-medium">scopes:</span> openid, email, profile</li>
                                <li><span className="font-medium">authorization_policy:</span> two_factor (or one_factor)</li>
                            </ul>
                        </li>
                        <li>
                            Restart Authelia to apply the configuration changes
                        </li>
                        <li>
                            Enter the <span className="font-semibold">Client ID</span> and the <span className="font-semibold">unhashed</span> secret into the fields above
                        </li>
                        <li>
                            Set the <span className="font-semibold">Issuer URL</span> to your Authelia base URL: <span className="font-mono text-accent">https://auth.example.com</span>
                        </li>
                        <li>
                            Click <span className="font-semibold">Save Settings</span> and use the <span className="font-semibold">Test</span> button to verify discovery
                        </li>
                    </ol>

                    <div className="mt-4 p-4 bg-theme-tertiary rounded-lg">
                        <p className="text-xs text-theme-tertiary">
                            <span className="font-semibold text-theme-secondary">Note:</span> Authelia requires you to hash the client secret for the config file, but enter the <span className="font-semibold text-theme-secondary">original unhashed secret</span> in Framerr. The Issuer URL is just your Authelia base URL with no path suffix.
                        </p>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard
                title="Keycloak Setup Guide"
                icon={Lock}
                expanded={showKeycloak}
                onToggleExpand={() => setShowKeycloak(!showKeycloak)}
            >
                <div className="space-y-4 text-sm text-theme-secondary">
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="font-medium text-theme-primary">
                            Log into the Keycloak Admin Console and select your <span className="font-semibold">Realm</span>
                        </li>
                        <li>
                            Go to <span className="font-semibold">Clients</span> → <span className="font-mono bg-theme-tertiary px-2 py-1 rounded">Create client</span>
                        </li>
                        <li>
                            Set <span className="font-semibold">Client type</span> to <span className="font-semibold">OpenID Connect</span> and enter a <span className="font-semibold">Client ID</span>
                        </li>
                        <li>
                            On the next screen, enable <span className="font-semibold">Client authentication</span> (Confidential) and ensure <span className="font-semibold">Standard flow</span> is checked
                        </li>
                        <li>
                            Configure login settings:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                <li><span className="font-medium">Valid Redirect URIs:</span> <span className="font-mono text-accent">{callbackUrl}</span></li>
                                <li><span className="font-medium">Web origins:</span> Your Framerr URL (e.g., <span className="font-mono">https://framerr.example.com</span>)</li>
                            </ul>
                        </li>
                        <li>
                            Save, then go to the <span className="font-semibold">Credentials</span> tab and copy the <span className="font-semibold">Client Secret</span>
                        </li>
                        <li>
                            Enter the <span className="font-semibold">Client ID</span> and <span className="font-semibold">Client Secret</span> into the fields above
                        </li>
                        <li>
                            Set the <span className="font-semibold">Issuer URL</span> to: <span className="font-mono text-accent">https://keycloak.example.com/realms/your-realm</span>
                        </li>
                        <li>
                            Click <span className="font-semibold">Save Settings</span> and use the <span className="font-semibold">Test</span> button to verify discovery
                        </li>
                    </ol>

                    <div className="mt-4 p-4 bg-theme-tertiary rounded-lg">
                        <p className="text-xs text-theme-tertiary">
                            <span className="font-semibold text-theme-secondary">Note:</span> The Issuer URL for Keycloak follows the format <span className="font-mono">https://your-keycloak/realms/realm-name</span>. Make sure you use the correct realm name.
                        </p>
                    </div>
                </div>
            </SettingsCard>
        </SettingsPage>
    );
};
