/**
 * IntegrationNotificationsTab - Notification configuration for integration instances
 * 
 * Shared component supporting multiple modes:
 * - 'webhook': External services (Sonarr/Radarr) - shows URL, token, events
 * - 'local': Internal services (Monitor/UK) - shows events only
 * - 'none': No notifications (Plex) - not rendered
 */

import React, { useMemo, useState } from 'react';
import { Copy, RefreshCw, Bell, Webhook, ExternalLink, Check, BellRing } from 'lucide-react';
import { Button, Switch, MultiSelectDropdown } from '..';

// ============================================================================
// Types
// ============================================================================

export type NotificationMode = 'webhook' | 'local' | 'none';

export interface NotificationEvent {
    key: string;
    label: string;
    category?: string;
    adminOnly?: boolean;
    defaultAdmin?: boolean;
    defaultUser?: boolean;
}

export interface NotificationConfigData {
    webhookEnabled?: boolean;
    webhookToken?: string;
    enabledEvents?: string[];
    adminEvents?: string[];
    userEvents?: string[];
}

interface IntegrationNotificationsTabProps {
    instanceId: string;
    instanceType: string;
    config: NotificationConfigData;
    events: NotificationEvent[];
    onConfigChange: (config: NotificationConfigData) => void;
    disabled?: boolean;

    // Mode determines what's rendered
    mode: NotificationMode;

    // Webhook mode only
    webhookBaseUrl?: string;
    onGenerateToken?: () => void;
    onCopyUrl?: (url: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const IntegrationNotificationsTab: React.FC<IntegrationNotificationsTabProps> = ({
    instanceId,
    instanceType,
    config,
    events,
    onConfigChange,
    disabled = false,
    mode,
    webhookBaseUrl,
    onGenerateToken,
    onCopyUrl
}) => {
    // Don't render if mode is 'none'
    if (mode === 'none') {
        return null;
    }

    const webhookEnabled = config?.webhookEnabled ?? false;
    const webhookToken = config?.webhookToken;
    const adminEvents = config?.adminEvents ?? [];
    const userEvents = config?.userEvents ?? [];

    // Copy feedback state (webhook mode only)
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Check if we're in a secure context (HTTPS or localhost)
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;

    // Build the webhook URL (webhook mode only)
    const webhookUrl = useMemo(() => {
        if (mode !== 'webhook' || !webhookToken) return null;
        const baseUrl = webhookBaseUrl || window.location.origin;
        return `${baseUrl}/api/webhooks/${instanceType}/${instanceId}/${webhookToken}`;
    }, [mode, webhookBaseUrl, instanceType, instanceId, webhookToken]);

    // Truncated URL for display
    const displayUrl = useMemo(() => {
        if (!webhookUrl || !webhookToken) return null;
        return webhookUrl.replace(webhookToken, webhookToken.substring(0, 8) + '...');
    }, [webhookUrl, webhookToken]);

    const handleCopy = () => {
        if (!webhookUrl || !onCopyUrl) return;

        if (isSecure && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(webhookUrl)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => {
                    setExpanded(true);
                });
        } else {
            setExpanded(!expanded);
        }
    };

    const handleToggleEnabled = () => {
        onConfigChange({
            ...config,
            webhookEnabled: !webhookEnabled
        });
    };

    const handleAdminEventsChange = (newEvents: string[]) => {
        onConfigChange({
            ...config,
            adminEvents: newEvents
        });
    };

    const handleUserEventsChange = (newEvents: string[]) => {
        onConfigChange({
            ...config,
            userEvents: newEvents
        });
    };

    // Filter events for user dropdown (non-admin-only events)
    const userReachableEvents = events.filter(e => !e.adminOnly);

    // For local mode, notifications are always considered "enabled"
    const isNotificationsActive = mode === 'local' || webhookEnabled;

    return (
        <div className="p-4 space-y-6">
            {/* Header Section - Different for webhook vs local */}
            {mode === 'webhook' ? (
                // Webhook mode: Enable/Disable toggle
                <div className="flex items-center justify-between p-4 bg-theme-tertiary rounded-lg border border-theme">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent/10">
                            <Webhook size={20} className="text-accent" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-theme-primary">
                                Webhook Notifications
                            </h4>
                            <p className="text-xs text-theme-tertiary">
                                Receive real-time notifications from this service
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={webhookEnabled}
                        onCheckedChange={handleToggleEnabled}
                        disabled={disabled}
                    />
                </div>
            ) : (
                // Local mode: Info header (no toggle, notifications are automatic)
                <div className="flex items-center gap-3 p-4 bg-theme-tertiary rounded-lg border border-theme">
                    <div className="p-2 rounded-lg bg-accent/10">
                        <BellRing size={20} className="text-accent" />
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-theme-primary">
                            Status Notifications
                        </h4>
                        <p className="text-xs text-theme-tertiary">
                            Configure which status changes trigger notifications
                        </p>
                    </div>
                </div>
            )}

            {isNotificationsActive && (
                <>
                    {/* Webhook URL Section (webhook mode only) */}
                    {mode === 'webhook' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <ExternalLink size={16} className="text-theme-secondary" />
                                <label className="text-sm font-medium text-theme-primary">
                                    Webhook URL
                                </label>
                            </div>

                            {webhookToken ? (
                                <div className="space-y-2">
                                    {!expanded ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2.5 bg-theme-primary border border-theme rounded-lg text-xs font-mono text-theme-secondary truncate">
                                                {displayUrl}
                                            </div>
                                            <Button
                                                onClick={handleCopy}
                                                variant="secondary"
                                                size="sm"
                                                icon={copied ? Check : Copy}
                                                title={copied ? 'Copied!' : (isSecure ? 'Copy full URL' : 'Show full URL')}
                                                className={copied ? 'border-success bg-success/10 text-success' : ''}
                                            />
                                            <Button
                                                onClick={onGenerateToken}
                                                variant="secondary"
                                                size="sm"
                                                icon={RefreshCw}
                                                title="Regenerate token"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={webhookUrl || ''}
                                                className="w-full px-3 py-2.5 bg-theme-primary border border-accent rounded-lg text-xs font-mono text-theme-primary select-all focus:outline-none focus:ring-2 focus:ring-accent"
                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                                autoFocus
                                            />
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-theme-secondary">
                                                    Select the URL above and copy (Ctrl+C)
                                                </p>
                                                <Button
                                                    onClick={() => setExpanded(false)}
                                                    variant="secondary"
                                                    size="sm"
                                                >
                                                    Collapse
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-theme-tertiary">
                                        Configure this URL in your service's Webhook settings. Enable all notification types in the service.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-theme-tertiary rounded-lg border border-dashed border-theme">
                                    <Webhook size={32} className="mx-auto text-theme-tertiary mb-3" />
                                    <p className="text-sm text-theme-secondary mb-3">
                                        Generate a webhook token to receive notifications
                                    </p>
                                    <Button
                                        onClick={onGenerateToken}
                                        variant="primary"
                                        size="sm"
                                        icon={Bell}
                                    >
                                        Generate Webhook Token
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Event Selection - Show when token exists (webhook) or always (local) */}
                    {(mode === 'local' || webhookToken) && (
                        <div className="space-y-4">
                            {/* Admin Events */}
                            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                <span className="text-sm font-medium text-theme-primary">Admin Receives</span>
                                <MultiSelectDropdown
                                    options={events.map(e => ({ id: e.key, label: e.label }))}
                                    selectedIds={adminEvents}
                                    onChange={handleAdminEventsChange}
                                    disabled={disabled}
                                    placeholder="Select events..."
                                    size="md"
                                />
                            </div>

                            {/* User Events */}
                            {userReachableEvents.length > 0 && (
                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                    <span className="text-sm font-medium text-theme-primary">Users Can Receive</span>
                                    <MultiSelectDropdown
                                        options={userReachableEvents.map(e => ({ id: e.key, label: e.label }))}
                                        selectedIds={userEvents}
                                        onChange={handleUserEventsChange}
                                        disabled={disabled}
                                        placeholder="Select events..."
                                        size="md"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default IntegrationNotificationsTab;
