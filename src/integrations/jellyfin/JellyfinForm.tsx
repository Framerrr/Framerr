/**
 * JellyfinForm - Configuration form for Jellyfin integration
 * 
 * Simple form with URL, API Key, User ID, and Library Sync section.
 */

import React, { useEffect } from 'react';
import { Input } from '../../components/common/Input';
import { LibrarySyncSection, type SyncStatus } from '../shared';

interface JellyfinConfig {
    url?: string;
    apiKey?: string;
    userId?: string;
    webUrl?: string;
    librarySyncEnabled?: boolean;
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

            {/* API Key */}
            <Input
                label="API Key"
                type="text"
                redacted
                value={config.apiKey || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('apiKey', e.target.value)}
                placeholder="Enter your API key"
                helperText="Found in Dashboard → API Keys"
            />

            {/* User ID */}
            <Input
                label="User ID"
                type="text"
                value={config.userId || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('userId', e.target.value)}
                placeholder="Enter your user ID"
                helperText={
                    <span>
                        Found in Dashboard → Users → select user → copy from URL
                        <br />
                        <span style={{ opacity: 0.7 }}>…/users/profile?userId=</span>
                        <strong>abc123def456</strong>
                    </span>
                }
            />

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
                isNewIntegration={isNewIntegration}
                syncStatus={syncStatus || null}
                onSyncNow={onSyncNow || (() => { })}
            />
        </div>
    );
};

export default JellyfinForm;
