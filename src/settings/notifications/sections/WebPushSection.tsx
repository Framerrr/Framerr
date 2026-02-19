import React from 'react';
import { Smartphone, Trash2, Send, Shield, ShieldOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { configApi } from '../../../api/endpoints';
import { Button, Switch } from '../../../shared/ui';
import { SettingsSection, SettingsAlert, SettingsItem } from '../../../shared/ui/settings';
import { PushSubscription } from '../types';

// ============================================================================
// Props
// ============================================================================

interface WebPushSectionProps {
    // Push state
    pushSupported: boolean;
    pushPermission: NotificationPermission | 'default';
    pushEnabled: boolean;
    pushSubscriptions: unknown[];
    currentEndpoint: string | null;
    globalPushEnabled: boolean;

    // Loading states  
    pushLoading: boolean;
    notificationsEnabled: boolean;

    // Admin
    hasAdminAccess: boolean;
    globalPushSaving: boolean;

    // Actions
    subscribeToPush: (deviceName?: string) => Promise<boolean>;
    unsubscribeFromPush: () => Promise<void>;
    removePushSubscription: (id: string) => Promise<void>;
    testPushNotification: () => Promise<boolean>;
    fetchGlobalPushStatus: () => Promise<void>;
    setPushLoading: (loading: boolean) => void;
    setGlobalPushSaving: (saving: boolean) => void;
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WebPushSection({
    pushSupported,
    pushPermission,
    pushEnabled,
    pushSubscriptions,
    currentEndpoint,
    globalPushEnabled,
    pushLoading,
    notificationsEnabled,
    hasAdminAccess,
    globalPushSaving,
    subscribeToPush,
    unsubscribeFromPush,
    removePushSubscription,
    testPushNotification,
    fetchGlobalPushStatus,
    setPushLoading,
    setGlobalPushSaving,
    showSuccess,
    showError
}: WebPushSectionProps): React.ReactElement | null {
    // Hide for non-admin if globally disabled
    if (!hasAdminAccess && !globalPushEnabled) {
        return null;
    }

    const typedSubscriptions = pushSubscriptions as PushSubscription[];

    return (
        <SettingsSection
            title="Web Push Notifications"
            icon={Smartphone}
            description="Receive notifications even when Framerr isn't open in your browser."
            headerRight={hasAdminAccess ? (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-theme-secondary">
                        {globalPushEnabled ? 'Enabled for all users' : 'Disabled for all users'}
                    </span>
                    <Switch
                        checked={globalPushEnabled}
                        onCheckedChange={async (checked) => {
                            setGlobalPushSaving(true);
                            try {
                                await configApi.updateSystem({
                                    webPushEnabled: checked
                                });
                                await fetchGlobalPushStatus();
                                showSuccess(
                                    checked ? 'Web Push Enabled' : 'Web Push Disabled',
                                    checked
                                        ? 'Web Push is now enabled for all users'
                                        : 'Web Push is now disabled for all users'
                                );
                            } catch (err) {
                                showError('Error', 'Failed to update Web Push setting');
                            } finally {
                                setGlobalPushSaving(false);
                            }
                        }}
                        disabled={globalPushSaving}
                    />
                </div>
            ) : undefined}
        >

            {!pushSupported ? (
                // Not supported
                <SettingsAlert type="warning" icon={ShieldOff}>
                    <div className="font-medium mb-1">Not Supported</div>
                    <p className="text-xs text-theme-secondary">
                        {navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
                            ? 'Safari on iOS requires this app to be added to your home screen first. On macOS Safari 16+, push should work natively.'
                            : 'Web Push notifications require HTTPS and a modern browser. Push is not available in this environment.'}
                    </p>
                </SettingsAlert>
            ) : pushPermission === 'denied' ? (
                // Permission denied
                <SettingsAlert type="error" icon={ShieldOff}>
                    <div className="font-medium mb-1">Notifications Blocked</div>
                    <p className="text-xs text-theme-secondary mb-3">
                        {navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
                            ? 'Safari: Open Safari Preferences → Websites → Notifications → Find this site and allow.'
                            : 'Click the lock/site info icon in your address bar, find Notifications, and change to "Allow".'}
                    </p>
                    <Button
                        onClick={() => {
                            const currentPerm = Notification.permission;
                            if (currentPerm !== 'denied') {
                                window.location.reload();
                            } else {
                                showError('Still Blocked', 'Please update your browser notification settings first, then try again.');
                            }
                        }}
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                    >
                        Check Again
                    </Button>
                </SettingsAlert>
            ) : (
                // Supported and permission not denied
                <div className="space-y-4">
                    {/* This Device Enable/Disable Toggle */}
                    <SettingsItem
                        label="Push Notifications on This Device"
                        description={pushEnabled
                            ? 'This device will receive push notifications'
                            : 'Enable to receive push notifications when Framerr is closed'}
                        icon={pushEnabled ? ShieldCheck : Shield}
                        iconColor={pushEnabled ? 'text-success' : 'text-theme-tertiary'}
                    >
                        <Button
                            onClick={async () => {
                                setPushLoading(true);
                                try {
                                    if (pushEnabled) {
                                        await unsubscribeFromPush();
                                        showSuccess('Push Disabled', 'This device will no longer receive push notifications');
                                    } else {
                                        await subscribeToPush();
                                        showSuccess('Push Enabled', 'This device will now receive push notifications');
                                    }
                                } catch (err) {
                                    showError('Error', (err as Error).message || 'Failed to update push settings');
                                } finally {
                                    setPushLoading(false);
                                }
                            }}
                            variant={pushEnabled ? 'danger' : 'primary'}
                            disabled={pushLoading || !notificationsEnabled}
                            icon={pushLoading ? undefined : (pushEnabled ? ShieldOff : Shield)}
                            size="sm"
                        >
                            {pushLoading ? (pushEnabled ? 'Disabling...' : 'Enabling...') : (pushEnabled ? 'Disable' : 'Enable')}
                        </Button>
                    </SettingsItem>

                    {/* Test Push - Only show when enabled */}
                    {pushEnabled && typedSubscriptions.length > 0 && (
                        <SettingsItem
                            label="Test Push on This Device"
                            description="Force a push notification to verify this device receives them"
                            icon={Send}
                            iconColor="text-accent"
                        >
                            <Button
                                onClick={async () => {
                                    try {
                                        await testPushNotification();
                                        // No success toast — the push arriving IS the confirmation
                                    } catch (err) {
                                        showError('Push Failed', (err as Error).message || 'Failed to send test push');
                                    }
                                }}
                                variant="secondary"
                                size="sm"
                            >
                                Test Push
                            </Button>
                        </SettingsItem>
                    )}

                    {/* Subscribed Devices */}
                    {typedSubscriptions.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                                <Smartphone size={16} />
                                Subscribed Devices ({typedSubscriptions.length})
                            </h4>
                            <div className="space-y-2">
                                {typedSubscriptions.map((sub) => {
                                    const isThisDevice = sub.endpoint === currentEndpoint;
                                    return (
                                        <div
                                            key={sub.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${isThisDevice
                                                ? 'bg-accent/5 border-accent/30'
                                                : 'bg-theme-primary border-theme'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Smartphone size={18} className={isThisDevice ? 'text-accent' : 'text-theme-secondary'} />
                                                <div>
                                                    <div className="text-sm font-medium text-theme-primary flex items-center gap-2">
                                                        {sub.deviceName || 'Unknown Device'}
                                                        {isThisDevice && (
                                                            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                                                                This Device
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-theme-tertiary">
                                                        {sub.lastUsed
                                                            ? `Last used: ${new Date(typeof sub.lastUsed === 'number' ? sub.lastUsed * 1000 : sub.lastUsed).toLocaleDateString()}`
                                                            : `Added: ${new Date(typeof sub.createdAt === 'number' ? sub.createdAt * 1000 : sub.createdAt).toLocaleDateString()}`
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await removePushSubscription(sub.id);
                                                        showSuccess('Removed', isThisDevice
                                                            ? 'Push notifications disabled for this device'
                                                            : 'Device removed from push notifications'
                                                        );
                                                    } catch (err) {
                                                        showError('Error', 'Failed to remove device');
                                                    }
                                                }}
                                                className="p-2 text-theme-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                                                title={isThisDevice ? 'Disable push on this device' : 'Remove device'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </SettingsSection>
    );
}
