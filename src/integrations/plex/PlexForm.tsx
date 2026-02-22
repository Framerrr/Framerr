/**
 * PlexForm - Configuration form for Plex integration
 * Supports OAuth login, server selection, manual URL/token entry
 * 
 * This is a "complex" integration that requires custom UI (OAuth flow).
 */

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, Loader, RefreshCw, Server } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Select } from '../../shared/ui';
import { PlexConfig } from '../_core/definitions';
import { LibrarySyncSection, type SyncStatus } from '../shared';

interface PlexFormProps {
    /** Integration instance ID this form manages */
    instanceId: string;
    config: PlexConfig;
    onFieldChange: (field: string, value: string | boolean) => void;
    onPlexLogin: () => void;
    onServerChange: (machineId: string) => void;
    onRefreshServers: () => void;
    authenticating: boolean;
    loadingServers: boolean;
    /** Whether this is a new integration (not yet saved) */
    isNewIntegration?: boolean;
    /** Current sync status for existing integrations */
    syncStatus?: SyncStatus | null;
    /** Callback to trigger manual sync */
    onSyncNow?: () => void;
}

const PlexForm: React.FC<PlexFormProps> = ({
    config,
    onFieldChange,
    onPlexLogin,
    onServerChange,
    onRefreshServers,
    authenticating,
    loadingServers,
    isNewIntegration = false,
    syncStatus,
    onSyncNow
}) => {
    const servers = config.servers || [];

    // Ensure librarySyncEnabled default is persisted to form state
    const librarySyncEnabled = config.librarySyncEnabled ?? true;
    useEffect(() => {
        if (config.librarySyncEnabled === undefined) {
            onFieldChange('librarySyncEnabled', true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one-time init

    return (
        <div className="space-y-2">
            {/* Plex Login */}
            <div className="p-3 rounded-lg border border-theme bg-theme-hover">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {config.token ? (
                            <>
                                <CheckCircle2 size={20} className="text-success" />
                                <div>
                                    <p className="text-sm font-medium text-theme-primary">Connected to Plex</p>
                                    <p className="text-xs text-theme-secondary">Token configured</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={20} className="text-warning" />
                                <div>
                                    <p className="text-sm font-medium text-theme-primary">Not Connected</p>
                                    <p className="text-xs text-theme-secondary">Login with Plex to auto-configure</p>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={onPlexLogin}
                        disabled={authenticating}
                        className="flex items-center gap-2 px-4 py-2 bg-[#e5a00d] hover:bg-[#c88a0b] text-black font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                        {authenticating ? (
                            <>
                                <Loader className="animate-spin" size={16} />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <ExternalLink size={16} />
                                {config.token ? 'Reconnect' : 'Login with Plex'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Server Selection */}
            {config.token && (
                <div>
                    <label className="block text-sm font-medium text-theme-primary mb-2">
                        <Server size={16} className="inline mr-2" />
                        Select Server
                    </label>
                    <div className="flex gap-2">
                        <Select value={config.machineId || ''} onValueChange={(value) => onServerChange(value)}>
                            <Select.Trigger className="flex-1">
                                <Select.Value placeholder="Select a server..." />
                            </Select.Trigger>
                            <Select.Content>
                                {servers.map(server => (
                                    <Select.Item key={server.machineId} value={server.machineId}>
                                        {`${server.name} ${server.owned ? '(Owner)' : '(Shared)'}`}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                        <button
                            onClick={onRefreshServers}
                            disabled={loadingServers}
                            className="px-3 py-2 border border-theme rounded-lg text-theme-secondary hover:bg-theme-hover transition-all"
                            title="Refresh servers"
                        >
                            <RefreshCw size={18} className={loadingServers ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            )}

            {/* Manual URL */}
            <Input
                label="Plex Server URL"
                type="text"
                value={config.url || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('url', e.target.value)}
                placeholder="http://192.168.1.x:32400"
                helperText="Auto-filled from server selection, or enter manually"
            />

            {/* Token */}
            <Input
                label="Plex Token"
                type="text"
                redacted
                value={config.token || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('token', e.target.value)}
                placeholder="Auto-filled via Plex login"
                helperText="Auto-filled when you login with Plex, or enter manually"
            />

            {/* Library Sync */}
            <LibrarySyncSection
                enabled={librarySyncEnabled}
                onToggle={(checked) => onFieldChange('librarySyncEnabled', checked)}
                isNewIntegration={isNewIntegration}
                syncStatus={syncStatus || null}
                onSyncNow={onSyncNow || (() => { })}
            />
        </div>
    );
};

export default PlexForm;

