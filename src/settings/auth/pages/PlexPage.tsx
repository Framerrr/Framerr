/**
 * PlexPage
 * Plex SSO configuration for AuthSettings
 * 
 * Features:
 * - Plex OAuth login button for admin setup
 * - Machine (server) selector
 * - Auto-create users toggle
 * - Default group selector
 */
import React, { useState, useEffect } from 'react';
import { plexApi } from '../../../api/endpoints';
import { usePlexOAuth, PlexUser } from '../../../hooks/usePlexOAuth';
import { Tv, Loader, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Switch, Select } from '@/shared/ui';
import { SettingsPage, SettingsSection } from '../../../shared/ui/settings';
import { useNotifications } from '../../../context/NotificationContext';
import logger from '../../../utils/logger';
import type { PlexConfig, PlexServer, PlexAuthSettingsProps } from '../types';

export const PlexPage: React.FC<PlexAuthSettingsProps> = ({ onSaveNeeded, onSave }) => {
    const { success: showSuccess, error: showError } = useNotifications();

    // Config state
    const [config, setConfig] = useState<PlexConfig>({
        enabled: false,
        adminEmail: '',
        machineId: '',
        autoCreateUsers: false,
        hasToken: false
    });

    // UI state
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [servers, setServers] = useState<PlexServer[]>([]);
    const [loadingServers, setLoadingServers] = useState<boolean>(false);

    // Change tracking
    const [originalConfig, setOriginalConfig] = useState<PlexConfig | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    // Fetch servers when config is loaded and has token
    useEffect(() => {
        if (config.hasToken && servers.length === 0) {
            fetchAdminServers();
        }
    }, [config.hasToken]);

    const fetchConfig = async (): Promise<void> => {
        try {
            const response = await plexApi.getSSOConfig();
            setConfig(response as PlexConfig);
            setOriginalConfig(response as PlexConfig);
        } catch (error) {
            const err = error as Error;
            logger.error('[PlexAuth] Failed to fetch config:', err.message);
        } finally {
            setLoading(false);
        }
    };



    const fetchAdminServers = async (): Promise<void> => {
        setLoadingServers(true);
        try {
            const response = await plexApi.getAdminResources();
            setServers(response);
        } catch (error) {
            const err = error as Error;
            logger.debug('[PlexAuth] Failed to fetch admin servers:', err.message);
        } finally {
            setLoadingServers(false);
        }
    };

    // Plex OAuth hook
    const handlePlexAuthSuccess = async (token: string, user: PlexUser): Promise<void> => {
        try {
            // Save token to config
            await plexApi.saveSSOConfig({
                adminToken: token,
                adminEmail: user.email,
                adminPlexId: String(user.id)
            });

            // Fetch servers
            await fetchServers(token);

            // Auto-enable SSO on first connection
            setConfig(prev => ({
                ...prev,
                hasToken: true,
                adminEmail: user.email || '',
                enabled: true
            }));

            showSuccess('Plex Connected', `Connected as ${user.username}`);
        } catch (error) {
            const err = error as Error;
            logger.error('[PlexAuth] Failed to save after auth:', err.message);
            showError('Failed to Save', err.message);
        }
    };

    const { startAuth, isAuthenticating } = usePlexOAuth({
        mode: 'popup',
        onSuccess: handlePlexAuthSuccess,
        onError: (error) => showError('Plex Auth Failed', error)
    });

    const fetchServers = async (token: string): Promise<void> => {
        setLoadingServers(true);
        try {
            const servers = await plexApi.getResources(token);
            setServers(servers || []);
        } catch (error) {
            const err = error as Error;
            logger.error('[PlexAuth] Failed to fetch servers:', err.message);
        } finally {
            setLoadingServers(false);
        }
    };

    const handleSave = async (): Promise<void> => {
        setSaving(true);
        try {
            await plexApi.saveSSOConfig({
                enabled: config.enabled,
                machineId: config.machineId,
                autoCreateUsers: config.autoCreateUsers
            });

            showSuccess('Settings Saved', 'Plex SSO configuration updated');
            setOriginalConfig(config); // Reset change tracking
            if (onSaveNeeded) onSaveNeeded(false);
        } catch (error) {
            const err = error as Error;
            logger.error('[PlexAuth] Failed to save:', err.message);
            showError('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    // Expose save function to parent
    useEffect(() => {
        if (onSave) {
            onSave.current = handleSave;
        }
    }, [config]);

    // Track changes and notify parent
    useEffect(() => {
        if (!originalConfig || !onSaveNeeded) return;

        // Normalize values for comparison (handle undefined/null/empty string)
        const normalize = (val: unknown): string => (val as string) ?? '';

        const hasChanges =
            !!config.enabled !== !!originalConfig.enabled ||
            normalize(config.machineId) !== normalize(originalConfig.machineId) ||
            !!config.autoCreateUsers !== !!originalConfig.autoCreateUsers;

        onSaveNeeded(hasChanges);
    }, [config, originalConfig, onSaveNeeded]);

    const handleChange = (field: keyof PlexConfig, value: string | boolean): void => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader className="animate-spin text-accent" size={32} />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Plex Auth"
            description="Allow users to sign in with their Plex account"
        >
            <SettingsSection title="Plex SSO" icon={Tv}>
                {/* Header with Enable Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <span className="text-sm font-medium text-theme-primary">Enable Plex SSO</span>
                        <p className="text-xs text-theme-tertiary mt-1">Allow users to sign in with Plex</p>
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked: boolean) => handleChange('enabled', checked)}
                        disabled={!config.hasToken}
                    />
                </div>

                {/* Plex Connection Status */}
                <div className="p-4 rounded-lg border border-theme bg-theme-tertiary">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {config.hasToken ? (
                                <>
                                    <CheckCircle size={20} className="text-success flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-theme-primary">Connected to Plex</p>
                                        <p className="text-xs text-theme-secondary break-all">{config.adminEmail}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={20} className="text-warning flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-theme-primary">Not Connected</p>
                                        <p className="text-xs text-theme-secondary">Login with Plex to configure SSO</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => startAuth()}
                            disabled={isAuthenticating}
                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-[#e5a00d] hover:bg-[#c88a0b] text-black font-medium rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
                        >
                            {isAuthenticating ? (
                                <>
                                    <Loader className="animate-spin" size={16} />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <ExternalLink size={16} />
                                    {config.hasToken ? 'Reconnect' : 'Login with Plex'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Server Selection */}
                {config.hasToken && (
                    <div className="space-y-4">
                        {/* Server Selector */}
                        <div>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <Select value={config.machineId || ''} onValueChange={(value) => handleChange('machineId', value)}>
                                        <Select.Trigger className="w-full">
                                            <Select.Value placeholder="Select a server..." />
                                        </Select.Trigger>
                                        <Select.Content>
                                            {servers.map(server => (
                                                <Select.Item key={server.machineId} value={server.machineId}>
                                                    {`${server.name}${server.owned ? ' (Owner)' : ''}`}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select>
                                </div>
                                <button
                                    onClick={fetchAdminServers}
                                    disabled={loadingServers}
                                    className="px-3 py-2 border border-theme rounded-lg text-theme-secondary hover:bg-theme-hover transition-all"
                                    title="Refresh servers"
                                >
                                    <RefreshCw size={18} className={loadingServers ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            <p className="text-xs text-theme-tertiary mt-2">
                                Only users shared with this server can log in via Plex SSO
                            </p>
                        </div>

                        {/* Auto-create Users */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                            <div>
                                <label className="text-sm font-medium text-theme-primary">
                                    Auto-create Users
                                </label>
                                <p className="text-xs text-theme-tertiary mt-1">
                                    Automatically create Framerr accounts for new Plex users
                                </p>
                            </div>
                            <Switch
                                checked={config.autoCreateUsers}
                                onCheckedChange={(checked: boolean) => handleChange('autoCreateUsers', checked)}
                            />
                        </div>

                    </div>
                )}
            </SettingsSection>
        </SettingsPage>
    );
};
