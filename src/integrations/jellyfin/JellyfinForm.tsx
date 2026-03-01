/**
 * JellyfinForm - Configuration form for Jellyfin integration
 * 
 * Three modes:
 * - New integration: Server URL + username/password → "Connect" → auto-resolves apiKey + userId
 * - Edit existing: Server URL + API Key (redacted) + Web URL + Library Sync
 * - Needs reauth: Warning banner + username/password fields to re-authenticate
 */

import React, { useEffect, useState } from 'react';
import { Input } from '../../components/common/Input';
import { Button } from '../../shared/ui';
import { LibrarySyncSection, type SyncStatus } from '../shared';
import { Loader, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

interface JellyfinConfig {
    url?: string;
    apiKey?: string;
    userId?: string;
    webUrl?: string;
    librarySyncEnabled?: boolean;
    jellyfinUsername?: string;
    jellyfinPassword?: string;
    needsReauth?: boolean;
}

interface JellyfinFormProps {
    /** Integration instance ID this form manages */
    instanceId: string;
    config: JellyfinConfig;
    onFieldChange: (field: string, value: string | boolean) => void;
    /** Whether this is a new integration (not yet saved) */
    isNewIntegration?: boolean;
    /** Current sync status */
    syncStatus?: SyncStatus | null;
    /** Callback to trigger manual sync */
    onSyncNow?: () => void;
}

const JellyfinForm: React.FC<JellyfinFormProps> = ({
    config,
    onFieldChange,
    isNewIntegration = false,
    syncStatus,
    onSyncNow
}) => {
    // Ensure librarySyncEnabled default is persisted to form state
    const librarySyncEnabled = config.librarySyncEnabled ?? true;
    useEffect(() => {
        if (config.librarySyncEnabled === undefined) {
            onFieldChange('librarySyncEnabled', true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one-time init

    // Auth flow state (used for new integrations and re-auth)
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authState, setAuthState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [authError, setAuthError] = useState('');
    const [connectedUser, setConnectedUser] = useState('');
    const [pendingSave, setPendingSave] = useState(false);

    // If config already has apiKey, the auth step is complete
    const isAuthenticated = !!config.apiKey;
    const needsReauth = config.needsReauth === true;

    // Pre-fill username for reauth if stored
    useEffect(() => {
        if (needsReauth && config.jellyfinUsername && !username) {
            setUsername(config.jellyfinUsername);
        }
    }, [needsReauth]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleConnect = async () => {
        if (!config.url || !username) return;

        setAuthState('loading');
        setAuthError('');

        try {
            const response = await fetch('/api/integrations/jellyfin/authenticate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
                credentials: 'include',
                body: JSON.stringify({
                    url: config.url,
                    username,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setAuthState('error');
                setAuthError(data.error || 'Authentication failed');
                return;
            }

            // Set apiKey, userId, and store credentials for auto-reauth
            onFieldChange('apiKey', data.accessToken);
            onFieldChange('userId', data.userId);
            onFieldChange('jellyfinUsername', username);
            onFieldChange('jellyfinPassword', password);
            onFieldChange('needsReauth', false);
            setPendingSave(true);
            setConnectedUser(data.username);
            setAuthState('success');
        } catch (err) {
            setAuthState('error');
            setAuthError('Failed to connect to server. Check the URL and try again.');
        }
    };

    // ── Needs Re-auth Mode ──
    if (!isNewIntegration && needsReauth) {
        return (
            <div className="space-y-4">
                {/* Warning banner */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10">
                    <KeyRound className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-theme-primary">Authentication expired</p>
                        <p className="text-theme-secondary mt-1">
                            Your Jellyfin session has expired. Please re-enter your credentials to restore connectivity.
                        </p>
                    </div>
                </div>

                {/* Server URL (read-only context) */}
                <Input
                    label="Server URL"
                    type="text"
                    value={config.url || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('url', e.target.value)}
                    placeholder="http://192.168.1.x:8096"
                    helperText="Your Jellyfin server address"
                />

                {/* Username */}
                <Input
                    label="Username"
                    type="text"
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    placeholder="Admin username"
                    helperText="An administrator account is required"
                />

                {/* Password */}
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Enter password"
                />

                {/* Reconnect Button */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleConnect}
                        disabled={!config.url || !username || authState === 'loading'}
                        variant="primary"
                        size="sm"
                    >
                        {authState === 'loading' ? (
                            <span className="flex items-center gap-2">
                                <Loader className="w-4 h-4 animate-spin" />
                                Reconnecting...
                            </span>
                        ) : (
                            'Reconnect'
                        )}
                    </Button>
                </div>

                {/* Success message */}
                {authState === 'success' && (
                    <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Reconnected as <strong>{connectedUser}</strong>. Save to apply.</span>
                    </div>
                )}

                {/* Error message */}
                {authState === 'error' && (
                    <div className="flex items-center gap-2 text-error text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{authError}</span>
                    </div>
                )}
            </div>
        );
    }

    // ── New Integration: Username/Password Flow ──
    if (isNewIntegration && !isAuthenticated) {
        return (
            <div className="space-y-4">
                {/* Server URL */}
                <Input
                    label="Server URL"
                    type="text"
                    value={config.url || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('url', e.target.value)}
                    placeholder="http://192.168.1.x:8096"
                    helperText="Your Jellyfin server address"
                />

                {/* Username */}
                <Input
                    label="Username"
                    type="text"
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    placeholder="Admin username"
                    helperText="An administrator account is required"
                />

                {/* Password */}
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    helperText="Leave empty if no password is set"
                />

                {/* Connect Button */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleConnect}
                        disabled={!config.url || !username || authState === 'loading'}
                        variant="primary"
                        size="sm"
                    >
                        {authState === 'loading' ? (
                            <span className="flex items-center gap-2">
                                <Loader className="w-4 h-4 animate-spin" />
                                Connecting...
                            </span>
                        ) : (
                            'Connect'
                        )}
                    </Button>
                </div>

                {/* Error message */}
                {authState === 'error' && (
                    <div className="flex items-center gap-2 text-error text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{authError}</span>
                    </div>
                )}
            </div>
        );
    }

    // ── After successful auth (new) or Edit existing ──
    return (
        <div className="space-y-4">
            {/* Connection success message (new integration only) */}
            {isNewIntegration && authState === 'success' && (
                <div className="flex items-center gap-2 text-success text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Connected as <strong>{connectedUser}</strong></span>
                </div>
            )}

            {/* Server URL */}
            <Input
                label="Server URL"
                type="text"
                value={config.url || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('url', e.target.value)}
                placeholder="http://192.168.1.x:8096"
                helperText="Your Jellyfin server address"
            />

            {/* API Key (edit mode only — not shown after fresh auth on new integration) */}
            {!isNewIntegration && (
                <Input
                    label="API Key"
                    type="text"
                    redacted
                    value={config.apiKey || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('apiKey', e.target.value)}
                    placeholder="Enter your API key"
                    helperText="Authenticated access token"
                />
            )}

            {/* Web Interface URL (optional) */}
            <Input
                label="Web Interface URL"
                type="text"
                value={config.webUrl || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('webUrl', e.target.value)}
                placeholder={config.url || '(Same as Server URL)'}
                helperText="URL for 'Open in Jellyfin' links. Leave empty to use the server URL."
            />

            {/* Library Sync */}
            <LibrarySyncSection
                enabled={librarySyncEnabled}
                onToggle={(checked) => onFieldChange('librarySyncEnabled', checked)}
                isNewIntegration={isNewIntegration || pendingSave}
                syncStatus={syncStatus || null}
                onSyncNow={onSyncNow || (() => { })}
            />
        </div>
    );
};

export default JellyfinForm;
